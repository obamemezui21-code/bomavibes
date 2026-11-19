const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { PLANS, PAID_PLANS, PLAN_DURATIONS, toMillis } = require("../config/plans");
const { hasFullAdminAccess } = require("../config/roles");
const singpay = require("../services/singpayService");
const monerails = require("../services/monerailsService");
const { grantPlan } = require("../services/subscriptionService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// Online plan payments, by Mobile Money (Airtel Money / Moov Money, Gabon),
// through Monerails — or SingPay, the previous provider, still able to settle
// the payments it started and to take over again (PAYMENT_PROVIDER=singpay).
//
// One payments/{reference} doc per attempt (Admin SDK only — no client rules):
//   pending    → request sent to the phone, waiting for the customer's PIN
//   confirming → the provider confirmed, the plan is being granted
//   paid       → plan granted (planExpiresAt recorded)
//   failed     → refused / cancelled / insufficient balance / gateway error
//   expired    → never settled in time
//
// Nothing the browser, the callback or the webhook sends is trusted: every
// settlement is re-read from the provider's API with our own credentials, and
// the amount is checked against the plan price fixed here.

const REQUEST_COOLDOWN_MS = 30 * 1000;
const CONFIRMING_STALE_MS = 2 * 60 * 1000;
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

const payments = db.collection("payments");
const DURATION_LABELS = { week: "1 semaine", month: "1 mois", semester: "6 mois", year: "1 an" };

const PROVIDERS = {
    monerails: { configured: () => monerails.isConfigured() },
    singpay: { configured: () => singpay.isConfigured() },
};

// The provider new payments go through: PAYMENT_PROVIDER if set and ready,
// else Monerails once its key is there, else SingPay, else none (WhatsApp).
function activeProvider() {
    const wanted = (process.env.PAYMENT_PROVIDER || "").trim().toLowerCase();
    if (PROVIDERS[wanted]?.configured()) return wanted;
    if (wanted && wanted !== "auto") return null;
    return ["monerails", "singpay"].find((p) => PROVIDERS[p].configured()) || null;
}

// With a Monerails test key, Monerails' test numbers always "succeed": only
// admins may pay then, so nobody gets a plan for free.
const testMode = (provider) => provider === "monerails" && monerails.isTestMode();

function newReference() {
    return `BV${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function publicView(p) {
    return {
        reference: p.reference,
        plan: p.plan,
        duration: p.duration || "month",
        amount: p.amount,
        operator: p.operator,
        status: p.status === "confirming" ? "pending" : p.status,
        message: p.failureReason || null,
        // What to do on the phone, when the provider says (Monerails).
        instruction: p.status === "pending" ? p.instruction || null : null,
        planExpiresAt: p.planExpiresAt || null,
        testMode: !!p.testMode,
    };
}

// Each provider's view of a payment, in one shape:
//   { verdict: pending|succeeded|failed|expired, providerStatus, amount,
//     reference, currency, livemode, failureReason, instruction, transactionId }
async function checkSingPay(p) {
    const payload = p.transactionId ? await singpay.getTransactionStatus(p.transactionId) : await singpay.findByReference(p.reference);
    const tx = singpay.transactionOf(payload);
    const verdict = singpay.classify(payload);
    return {
        verdict,
        providerStatus: [tx?.status, tx?.result].filter(Boolean).join(" · ") || null,
        amount: Number(tx?.amount),
        reference: tx?.reference || null,
        currency: "XAF",
        livemode: true,
        failureReason: verdict === "failed" ? singpay.failureMessage(tx?.result) : null,
    };
}

async function checkMonerails(p) {
    const c = p.transactionId ? await monerails.getCollection(p.transactionId) : await monerails.findByReference(p.reference);
    if (!c) return { verdict: "pending", providerStatus: null };
    const verdict = monerails.classify(c);
    return {
        verdict,
        providerStatus: [c.status, c.failure_code].filter(Boolean).join(" · "),
        amount: Number(c.amount),
        reference: c.client_reference || null,
        currency: c.currency,
        livemode: c.livemode === true,
        failureReason: verdict === "failed" || verdict === "expired" ? monerails.failureMessage(c) : null,
        instruction: monerails.instructionOf(c),
        transactionId: c.id,
    };
}

const CHECKS = { singpay: checkSingPay, monerails: checkMonerails };

// Re-reads the payment from its provider and moves it forward. Safe to call
// any number of times, from any path (poll, callback, webhook, sweep).
async function reconcile(reference) {
    const ref = payments.doc(reference);
    const p = (await ref.get()).data();
    if (!p) return null;
    const stale = p.status === "confirming" && Date.now() - toMillis(p.updatedAt) > CONFIRMING_STALE_MS;
    if (p.status !== "pending" && !stale) return p;

    const provider = p.provider || "singpay";
    let check;
    try {
        check = await CHECKS[provider](p);
    } catch (err) {
        console.error(`[${provider}] statut illisible pour ${reference}:`, err.message);
        return p;
    }
    const { verdict, providerStatus } = check;
    console.log(`[${provider}] ${reference} → ${verdict} (${providerStatus})`);
    const base = { providerStatus, updatedAt: FieldValue.serverTimestamp() };
    if (provider === "singpay") base.singpayStatus = providerStatus;
    if (check.transactionId && !p.transactionId) base.transactionId = check.transactionId;

    if (verdict === "pending") {
        const updates = { ...base, instruction: check.instruction || null };
        if (Date.now() - toMillis(p.createdAt) > PENDING_MAX_AGE_MS) {
            Object.assign(updates, { status: "expired", failureReason: "Le paiement n'a pas été validé à temps." });
        }
        await ref.update(updates);
        return (await ref.get()).data();
    }

    if (verdict === "failed" || verdict === "expired") {
        await ref.update({ ...base, status: verdict, failureReason: check.failureReason || "Le paiement n'a pas abouti." });
        return (await ref.get()).data();
    }

    // Succeeded — make sure it's really this payment, for the full price, in
    // real money (test money only for a payment started in test mode).
    const wrong =
        (check.reference && check.reference !== reference) ||
        !(check.amount >= p.amount) ||
        (check.currency && check.currency !== "XAF") ||
        (!check.livemode && !p.testMode);
    if (wrong) {
        console.error(`[${provider}] ${reference} : paiement inattendu`, { amount: check.amount, reference: check.reference, currency: check.currency, livemode: check.livemode });
        await ref.update({ ...base, status: "failed", failureReason: "Montant reçu incorrect — contactez le support." });
        return (await ref.get()).data();
    }

    // Claim before granting so two concurrent paths can't both extend the plan.
    const claimed = await db.runTransaction(async (t) => {
        const cur = (await t.get(ref)).data();
        const curStale = cur.status === "confirming" && Date.now() - toMillis(cur.updatedAt) > CONFIRMING_STALE_MS;
        if (cur.status !== "pending" && !curStale) return false;
        t.update(ref, { ...base, status: "confirming" });
        return true;
    });
    if (!claimed) return (await ref.get()).data();

    const planExpiresAt = await grantPlan(p.uid, p.plan, p.days, `${provider}${p.testMode ? "-test" : ""}:${reference}`);
    await ref.update({
        status: "paid",
        planExpiresAt,
        instruction: null,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return (await ref.get()).data();
}

async function isAdmin(uid) {
    const snap = await db.collection("users").doc(uid).get();
    return hasFullAdminAccess(snap.data()?.role);
}

// The signed-in member, when the request carries a valid token (optional).
async function optionalUid(req) {
    const token = (req.get("Authorization") || "").match(/^Bearer (.+)$/)?.[1];
    if (!token) return null;
    try {
        return (await admin.auth().verifyIdToken(token)).uid;
    } catch {
        return null;
    }
}

// GET /api/payments/config — whether the pricing page offers in-app Mobile
// Money (else WhatsApp). In test mode, to admins only.
async function getPaymentConfig(req, res) {
    const provider = activeProvider();
    let mobileMoney = !!provider;
    if (provider && testMode(provider)) {
        const uid = await optionalUid(req);
        mobileMoney = !!uid && (await isAdmin(uid).catch(() => false));
    }
    // `singpay` kept for app versions still cached on phones.
    res.json({ mobileMoney, singpay: mobileMoney, provider: mobileMoney ? provider : null, testMode: mobileMoney && testMode(provider) });
}

// POST /api/payments/mobile-money { plan, duration, phone } — duration:
// week | month | semester | year. (/api/payments/singpay: same, for old app versions.)
async function startPayment(req, res) {
    const provider = activeProvider();
    if (!provider) return res.status(503).json({ message: "Le paiement Mobile Money n'est pas encore disponible." });
    const uid = req.firebaseUser.uid;
    const test = testMode(provider);
    if (test && !(await isAdmin(uid))) {
        return res.status(503).json({ message: "Le paiement Mobile Money n'est pas encore disponible." });
    }
    const { plan, phone, duration = "month" } = req.body || {};
    if (!PAID_PLANS.includes(plan)) return res.status(400).json({ message: "Forfait invalide" });
    if (!Object.hasOwn(PLAN_DURATIONS, duration)) return res.status(400).json({ message: "Durée invalide" });

    let msisdn;
    let operator;
    if (provider === "monerails") {
        const parsed = monerails.parsePhone(phone);
        msisdn = parsed?.phone;
        operator = parsed?.operator;
    } else {
        msisdn = singpay.normalizeMsisdn(phone);
        operator = msisdn && singpay.operatorFor(msisdn);
    }
    if (!operator) {
        return res.status(400).json({ message: "Numéro Airtel Money ou Moov Money (Gabon) invalide." });
    }

    try {
        // One request at a time per user — it is a real prompt on a phone.
        const usageRef = db.collection("usage").doc(uid);
        const tooSoon = await db.runTransaction(async (t) => {
            const last = toMillis((await t.get(usageRef)).data()?.paymentRequestedAt);
            if (Date.now() - last < REQUEST_COOLDOWN_MS) return true;
            t.set(usageRef, { paymentRequestedAt: FieldValue.serverTimestamp() }, { merge: true });
            return false;
        });
        if (tooSoon) {
            return res.status(429).json({ message: "Une demande de paiement vient d'être envoyée. Patientez quelques secondes." });
        }

        const reference = newReference();
        const ref = payments.doc(reference);
        const payment = {
            reference,
            uid,
            plan,
            duration,
            days: PLAN_DURATIONS[duration].days,
            amount: PLANS[plan].prices[duration],
            currency: "XAF",
            provider,
            operator,
            msisdn,
            status: "pending",
            transactionId: null,
            ...(test ? { testMode: true } : {}),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        await ref.set(payment);

        if (provider === "monerails") {
            let collection;
            try {
                const profile = (await db.collection("profiles").doc(uid).get()).data();
                collection = await monerails.createCollection({
                    reference,
                    amount: payment.amount,
                    phone: msisdn,
                    operator,
                    name: profile?.firstName,
                    description: `BomaVibes ${PLANS[plan].label || plan} · ${DURATION_LABELS[duration] || duration}`,
                    metadata: { uid, plan, duration },
                });
            } catch (err) {
                // A timeout may hide a collection Monerails did create: the
                // sweep looks it up by reference before calling it failed.
                if (err.name === "TimeoutError" || err.name === "AbortError") {
                    console.error(`[monerails] ${reference} : pas de réponse, vérification par la référence`);
                    return res.status(201).json(publicView(payment));
                }
                console.error(`[monerails] envoi refusé pour ${reference}:`, err.message, err.code || "", JSON.stringify(err.body || null));
                const message = err.code === "test_phone_required" ? "En mode test, utilisez le numéro de test 24100000001." : "La demande de paiement n'a pas pu être envoyée. Réessayez.";
                await ref.update({ status: "failed", failureReason: err.message, updatedAt: FieldValue.serverTimestamp() });
                return res.status(502).json({ message });
            }
            console.log(`[monerails] ${reference} envoyé`, JSON.stringify({ id: collection?.id, status: collection?.status, livemode: collection?.livemode }));
            const verdict = monerails.classify(collection);
            if (verdict === "failed" || verdict === "expired") {
                const reason = monerails.failureMessage(collection);
                await ref.update({ status: verdict, transactionId: collection?.id || null, failureReason: reason, updatedAt: FieldValue.serverTimestamp() });
                return res.status(402).json({ message: reason });
            }
            const instruction = monerails.instructionOf(collection);
            await ref.update({ transactionId: collection?.id || null, instruction, providerStatus: collection?.status || null, updatedAt: FieldValue.serverTimestamp() });
            // Already succeeded (some test numbers do): settle it now.
            const settled = verdict === "succeeded" ? await reconcile(reference) : null;
            return res.status(201).json(publicView(settled || { ...payment, instruction }));
        }

        let result;
        try {
            result = await singpay.requestPayment({ operator, msisdn, amount: payment.amount, reference });
        } catch (err) {
            console.error(`[singpay] envoi refusé pour ${reference}:`, err.message, JSON.stringify(err.singpay || null));
            await ref.update({ status: "failed", failureReason: err.message, updatedAt: FieldValue.serverTimestamp() });
            return res.status(502).json({ message: "SingPay n'a pas pu envoyer la demande de paiement. Réessayez." });
        }
        const tx = singpay.transactionOf(result);
        console.log(`[singpay] ${reference} envoyé`, JSON.stringify({ status: result?.status, tx: { id: tx?.id, status: tx?.status, result: tx?.result } }));
        if (result?.status?.success === false || singpay.classify(result) === "failed") {
            const reason = singpay.failureMessage(tx?.result || result?.status?.message);
            await ref.update({ status: "failed", failureReason: reason, updatedAt: FieldValue.serverTimestamp() });
            return res.status(402).json({ message: reason });
        }
        await ref.update({ transactionId: tx?.id || tx?._id || null, updatedAt: FieldValue.serverTimestamp() });

        res.status(201).json(publicView({ ...payment, status: "pending" }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de lancer le paiement" });
    }
}

// GET /api/payments/:reference — polled by the checkout sheet.
async function getPayment(req, res) {
    try {
        const snap = await payments.doc(String(req.params.reference)).get();
        if (!snap.exists || snap.data().uid !== req.firebaseUser.uid) {
            return res.status(404).json({ message: "Paiement introuvable" });
        }
        const p = (await reconcile(snap.id)) || snap.data();
        res.json(publicView(p));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de vérifier le paiement" });
    }
}

// POST /api/payments/singpay/callback — set as the wallet's callbackURL in
// SingPay Workspace. The body only tells us *which* payment to re-check.
async function singPayCallback(req, res) {
    res.json({ received: true });
    try {
        const body = req.body || {};
        const tx = body.transaction || body;
        let reference = typeof tx.reference === "string" ? tx.reference : null;
        if (!reference || !(await payments.doc(reference).get()).exists) {
            const txId = tx.id || tx._id;
            if (!txId) return;
            const snap = await payments.where("transactionId", "==", String(txId)).limit(1).get();
            if (snap.empty) return;
            reference = snap.docs[0].id;
        }
        await reconcile(reference);
    } catch (err) {
        console.error("[singpay] callback", err);
    }
}

// POST /api/payments/monerails/webhook — raw body (app.js), signed with
// MONERAILS_WEBHOOK_SECRET. Only says which payment to re-check: the outcome
// is read back from the API (reconcile). Events can repeat or come out of
// order: reconcile is idempotent and goes by the current status.
async function monerailsWebhook(req, res) {
    if (!monerails.verifySignature(req.body, req.get("Monerail-Signature"))) {
        return res.status(400).json({ message: "Signature invalide" });
    }
    let event;
    try {
        event = JSON.parse(req.body.toString("utf8"));
    } catch {
        return res.status(400).json({ message: "Corps invalide" });
    }
    res.json({ received: true });
    try {
        const object = event?.data?.object;
        if (!String(event?.type || "").startsWith("collection.") || object?.object !== "collection") return;
        let reference = typeof object.client_reference === "string" ? object.client_reference : null;
        if (!reference || !(await payments.doc(reference).get()).exists) {
            if (!object.id) return;
            const snap = await payments.where("transactionId", "==", String(object.id)).limit(1).get();
            if (snap.empty) return;
            reference = snap.docs[0].id;
        }
        await reconcile(reference);
    } catch (err) {
        console.error("[monerails] webhook", err);
    }
}

// Safety net for customers who close the page and notifications that never
// come. Each payment is checked with its own provider, if still configured.
async function sweepPendingPayments() {
    try {
        const snap = await payments.where("status", "in", ["pending", "confirming"]).limit(50).get();
        for (const doc of snap.docs) {
            const provider = doc.data().provider || "singpay";
            if (!PROVIDERS[provider]?.configured()) continue;
            await reconcile(doc.id).catch((err) => console.error(`[${provider}] sweep ${doc.id}`, err));
        }
    } catch (err) {
        console.error("[payments] sweep impossible", err);
    }
}

function startPaymentSweepScheduler() {
    setInterval(sweepPendingPayments, SWEEP_INTERVAL_MS);
}

module.exports = {
    getPaymentConfig,
    startPayment,
    startSingPayPayment: startPayment,
    getPayment,
    singPayCallback,
    monerailsWebhook,
    startPaymentSweepScheduler,
    reconcile,
    activeProvider,
};
