const admin = require("../config/firebaseAdmin");
const { PLANS, PAID_PLANS, toMillis } = require("../config/plans");
const { failureMessage } = require("../services/singpayService");

const db = admin.firestore();
const { Timestamp } = admin.firestore;

const DAY_MS = 24 * 60 * 60 * 1000;
// Day/month buckets follow Libreville time (UTC+1, no DST).
const TZ_OFFSET_MS = 60 * 60 * 1000;
const PERIODS = { 7: 7, 30: 30, 90: 90, 365: 365 };
const MAX_DOCS = 5000;
const LIST_LIMIT = 300;

// Payments recorded before French messages existed kept SingPay's raw code
// ("BalanceError"); anything without a space is one of those.
const reasonOf = (p) => (p.failureReason && / /.test(p.failureReason) ? p.failureReason : failureMessage(p.failureReason || p.singpayStatus));

const dayKey = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
const monthKey = (ms) => dayKey(ms).slice(0, 7);

// Midnight (Libreville) of the day containing `ms`, as a UTC timestamp.
function startOfDay(ms) {
    return Date.parse(`${dayKey(ms)}T00:00:00Z`) - TZ_OFFSET_MS;
}

function startOfMonth(ms) {
    return Date.parse(`${monthKey(ms)}-01T00:00:00Z`) - TZ_OFFSET_MS;
}

function emptyBreakdown(keys) {
    return Object.fromEntries(keys.map((k) => [k, { paid: 0, revenue: 0, failed: 0 }]));
}

// GET /api/admin/payments?period=7|30|90|365|all
// Everything the Paiements dashboard shows, computed from payments/{ref}
// in one pass: revenue totals, a revenue series, breakdowns, failure
// reasons, active subscribers and the latest transactions.
async function getPaymentsDashboard(req, res) {
    const now = Date.now();
    const periodDays = PERIODS[req.query.period] || (req.query.period === "all" ? null : 30);
    const periodStart = periodDays ? startOfDay(now - (periodDays - 1) * DAY_MS) : 0;
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    // One query covers the period plus "today" and "this month" cards.
    const fetchFrom = Math.min(periodStart, monthStart);

    try {
        const [paymentsSnap, subscribersSnap] = await Promise.all([
            db.collection("payments").where("createdAt", ">=", Timestamp.fromMillis(fetchFrom)).orderBy("createdAt", "desc").limit(MAX_DOCS).get(),
            db.collection("users").where("planExpiresAt", ">", Timestamp.fromMillis(now)).get(),
        ]);

        const all = paymentsSnap.docs.map((d) => {
            const p = d.data();
            return { ...p, reference: d.id, createdAtMs: toMillis(p.createdAt), paidAtMs: toMillis(p.paidAt) };
        });
        const inPeriod = all.filter((p) => p.createdAtMs >= periodStart);
        // Revenue is dated when the money arrived.
        const paidAt = (p) => p.paidAtMs || p.createdAtMs;
        const paidAll = all.filter((p) => p.status === "paid");

        const counts = { paid: 0, failed: 0, pending: 0, expired: 0 };
        const byPlan = emptyBreakdown(PAID_PLANS);
        const byOperator = emptyBreakdown(["airtel", "moov"]);
        const failureReasons = {};
        const payers = new Set();
        let revenue = 0;
        for (const p of inPeriod) {
            const status = p.status === "confirming" ? "pending" : p.status;
            counts[status] = (counts[status] || 0) + 1;
            const plan = byPlan[p.plan];
            const op = byOperator[p.operator];
            if (status === "paid") {
                revenue += p.amount;
                payers.add(p.uid);
                if (plan) Object.assign(plan, { paid: plan.paid + 1, revenue: plan.revenue + p.amount });
                if (op) Object.assign(op, { paid: op.paid + 1, revenue: op.revenue + p.amount });
            } else if (status === "failed" || status === "expired") {
                if (plan) plan.failed += 1;
                if (op) op.failed += 1;
                const reason = reasonOf(p);
                failureReasons[reason] = (failureReasons[reason] || 0) + 1;
            }
        }
        const settled = counts.paid + counts.failed + counts.expired;

        // Revenue series: daily up to 90 days, monthly beyond.
        const firstMs = periodDays ? periodStart : Math.min(now, ...inPeriod.map((p) => p.createdAtMs));
        const monthly = !periodDays ? now - firstMs > 90 * DAY_MS : periodDays > 90;
        const keyOf = monthly ? monthKey : dayKey;
        const buckets = new Map();
        for (let t = monthly ? startOfMonth(firstMs) : startOfDay(firstMs); t <= now; ) {
            buckets.set(keyOf(t), { date: keyOf(t), revenue: 0, paid: 0 });
            t = monthly ? startOfMonth(t + 32 * DAY_MS) : t + DAY_MS;
        }
        for (const p of inPeriod) {
            if (p.status !== "paid") continue;
            const b = buckets.get(keyOf(paidAt(p)));
            if (b) Object.assign(b, { revenue: b.revenue + p.amount, paid: b.paid + 1 });
        }

        const sumSince = (from) => paidAll.filter((p) => paidAt(p) >= from).reduce((s, p) => s + p.amount, 0);

        const activeByPlan = Object.fromEntries(PAID_PLANS.map((id) => [id, 0]));
        for (const d of subscribersSnap.docs) {
            const plan = d.data().plan;
            if (plan in activeByPlan) activeByPlan[plan] += 1;
        }
        const activeSubscribers = Object.values(activeByPlan).reduce((a, b) => a + b, 0);
        const monthlyRecurring = PAID_PLANS.reduce((s, id) => s + activeByPlan[id] * PLANS[id].price, 0);

        // Latest transactions, with who paid.
        const list = inPeriod.slice(0, LIST_LIMIT);
        const uids = [...new Set(list.map((p) => p.uid))];
        const people = {};
        if (uids.length) {
            const [users, profiles] = await Promise.all([
                db.getAll(...uids.map((u) => db.collection("users").doc(u))),
                db.getAll(...uids.map((u) => db.collection("profiles").doc(u))),
            ]);
            uids.forEach((uid, i) => {
                const u = users[i].data() || {};
                const pr = profiles[i].data() || {};
                people[uid] = { email: u.email || null, firstName: u.firstName || pr.firstName || null };
            });
        }

        res.json({
            period: periodDays ? String(periodDays) : "all",
            summary: {
                revenue,
                revenueToday: sumSince(todayStart),
                revenueThisMonth: sumSince(monthStart),
                ...counts,
                total: inPeriod.length,
                successRate: settled ? counts.paid / settled : null,
                averageBasket: counts.paid ? Math.round(revenue / counts.paid) : 0,
                payingUsers: payers.size,
                activeSubscribers,
                activeByPlan,
                monthlyRecurring,
            },
            series: { granularity: monthly ? "month" : "day", points: [...buckets.values()] },
            byPlan: PAID_PLANS.map((id) => ({ id, label: PLANS[id].label, price: PLANS[id].price, ...byPlan[id] })),
            byOperator: Object.entries(byOperator).map(([id, v]) => ({ id, ...v })),
            failureReasons: Object.entries(failureReasons)
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count),
            payments: list.map((p) => ({
                reference: p.reference,
                uid: p.uid,
                ...(people[p.uid] || {}),
                plan: p.plan,
                amount: p.amount,
                operator: p.operator,
                msisdn: p.msisdn,
                status: p.status === "confirming" ? "pending" : p.status,
                failureReason: p.status === "failed" || p.status === "expired" ? reasonOf(p) : null,
                singpayStatus: p.singpayStatus || null,
                createdAt: p.createdAtMs || null,
                paidAt: p.paidAtMs || null,
            })),
            truncated: paymentsSnap.size >= MAX_DOCS,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de charger les paiements" });
    }
}

module.exports = { getPaymentsDashboard };
