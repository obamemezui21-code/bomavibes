const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { PLANS, PAID_PLANS, PLAN_PERIOD_DAYS, toMillis } = require("../config/plans");
const singpay = require("../services/singpayService");
const { grantPlan } = require("../services/subscriptionService");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// Online plan payments. One payments/{reference} doc per attempt (Admin SDK
// only — no client rules):
//   pending    → USSD Push sent, waiting for the customer's PIN
//   confirming → SingPay confirmed, the plan is being granted
//   paid       → plan granted (planExpiresAt recorded)
//   failed     → refused / cancelled / insufficient balance / gateway error
//   expired    → never settled within PENDING_MAX_AGE_MS
//
// Nothing the browser or the callback sends is trusted: every settlement is
// re-read from SingPay's status API with our own credentials, and the amount
// is checked against the plan price fixed here.

const REQUEST_COOLDOWN_MS = 30 * 1000;
const CONFIRMING_STALE_MS = 2 * 60 * 1000;
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

const payments = db.collection("payments");

function newReference() {
    return `BV${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function publicView(p) {
    return {
        reference: p.reference,
        plan: p.plan,
        amount: p.amount,
        operator: p.operator,
        status: p.status === "confirming" ? "pending" : p.status,
        message: p.failureReason || null,
        planExpiresAt: p.planExpiresAt || null,
    };
}

// Re-reads the transaction from SingPay and moves the payment forward.
// Safe to call any number of times, from any path (poll, callback, sweep).
async function reconcile(reference) {
    const ref = payments.doc(reference);
    const p = (await ref.get()).data();
    if (!p) return null;
    const stale = p.status === "confirming" && Date.now() - toMillis(p.updatedAt) > CONFIRMING_STALE_MS;
    if (p.status !== "pending" && !stale) return p;

    let payload;
    try {
        payload = p.transactionId ? await singpay.getTransactionStatus(p.transactionId) : await singpay.findByReference(reference);
    } catch (err) {
        console.error(`[singpay] statut illisible pour ${reference}:`, err.message);
        return p;
    }
    const tx = singpay.transactionOf(payload);
    const verdict = singpay.classify(payload);
    const singpayStatus = [tx?.status, tx?.result].filter(Boolean).join(" · ") || null;
    console.log(`[singpay] ${reference} → ${verdict} (${singpayStatus})`);

    if (verdict === "pending") {
        const updates = { singpayStatus, updatedAt: FieldValue.serverTimestamp() };
        if (Date.now() - toMillis(p.createdAt) > PENDING_MAX_AGE_MS) {
            Object.assign(updates, { status: "expired", failureReason: "Le paiement n'a pas été validé à temps." });
        }
        await ref.update(updates);
        return (await ref.get()).data();
    }

    if (verdict === "failed") {
        await ref.update({
            status: "failed",
            singpayStatus,
            failureReason: singpay.failureMessage(tx?.result),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return (await ref.get()).data();
    }

    // Succeeded — make sure it's really this payment, for the full price.
    const paidAmount = Number(tx?.amount);
    if ((tx?.reference && tx.reference !== reference) || !(paidAmount >= p.amount)) {
        console.error(`[singpay] ${reference} : montant/référence inattendus`, { amount: tx?.amount, reference: tx?.reference });
        await ref.update({
            status: "failed",
            singpayStatus,
            failureReason: "Montant reçu incorrect — contactez le support.",
            updatedAt: FieldValue.serverTimestamp(),
        });
        return (await ref.get()).data();
    }

    // Claim before granting so two concurrent paths can't both extend the plan.
    const claimed = await db.runTransaction(async (t) => {
        const cur = (await t.get(ref)).data();
        const curStale = cur.status === "confirming" && Date.now() - toMillis(cur.updatedAt) > CONFIRMING_STALE_MS;
        if (cur.status !== "pending" && !curStale) return false;
        t.update(ref, { status: "confirming", singpayStatus, updatedAt: FieldValue.serverTimestamp() });
        return true;
    });
    if (!claimed) return (await ref.get()).data();

    const planExpiresAt = await grantPlan(p.uid, p.plan, p.days, `singpay:${reference}`);
    await ref.update({
        status: "paid",
        planExpiresAt,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return (await ref.get()).data();
}

// GET /api/payments/config — lets the pricing page know whether to offer
// in-app Mobile Money or fall back to WhatsApp.
function getPaymentConfig(req, res) {
    res.json({ singpay: singpay.isConfigured() });
}

// POST /api/payments/singpay { plan, phone }
async function startSingPayPayment(req, res) {
    if (!singpay.isConfigured()) {
        return res.status(503).json({ message: "Le paiement Mobile Money n'est pas encore disponible." });
    }
    const uid = req.firebaseUser.uid;
    const { plan, phone } = req.body || {};
    if (!PAID_PLANS.includes(plan)) return res.status(400).json({ message: "Forfait invalide" });
    const msisdn = singpay.normalizeMsisdn(phone);
    const operator = msisdn && singpay.operatorFor(msisdn);
    if (!operator) {
        return res.status(400).json({ message: "Numéro Airtel Money ou Moov Money (Gabon) invalide." });
    }

    try {
        // One request at a time per user — a USSD Push is a real phone prompt.
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
            days: PLAN_PERIOD_DAYS,
            amount: PLANS[plan].price,
            currency: "XAF",
            provider: "singpay",
            operator,
            msisdn,
            status: "pending",
            transactionId: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        await ref.set(payment);

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

// Safety net for customers who close the page and callbacks that never come.
async function sweepPendingPayments() {
    if (!singpay.isConfigured()) return;
    try {
        const snap = await payments.where("status", "in", ["pending", "confirming"]).limit(50).get();
        for (const doc of snap.docs) {
            await reconcile(doc.id).catch((err) => console.error(`[singpay] sweep ${doc.id}`, err));
        }
    } catch (err) {
        console.error("[singpay] sweep impossible", err);
    }
}

function startPaymentSweepScheduler() {
    setInterval(sweepPendingPayments, SWEEP_INTERVAL_MS);
}

module.exports = { getPaymentConfig, startSingPayPayment, getPayment, singPayCallback, startPaymentSweepScheduler };
