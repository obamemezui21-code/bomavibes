// Subscription plans — what each tier unlocks. The source of truth for every
// server-side check (likes, super likes, boosts, calls, "voir qui vous
// aime", invisible mode). frontend-web/src/lib/plans.js mirrors these numbers
// for display only: keep both in sync when a tier changes.
//
// A user's plan lives on users/{uid}: plan ('vip' | 'diamant' | 'jade') and
// planExpiresAt (Timestamp). Only the Admin SDK can write them (see
// firestore.rules); an expired plan counts as free.

const UNLIMITED = Infinity;

// Calls temporarily open to everyone, free plan included. Set back to
// false (with FREE_CALLS in frontend-web/src/lib/plans.js and freeCalls in
// firestore.rules) to make them subscriber-only again.
const FREE_CALLS = true;

const PLANS = {
    free: {
        label: "Gratuit",
        likesPerDay: 20,
        superlikes: { count: 1, period: "week" },
        boosts: null,
        visibility: 0,
        calls: FREE_CALLS,
        seeLikes: false,
        invisible: false,
    },
    vip: {
        label: "VIP",
        price: 2000,
        likesPerDay: UNLIMITED,
        superlikes: { count: 5, period: "week" },
        boosts: { count: 1, period: "week" },
        visibility: 1,
        calls: true,
        seeLikes: true,
        invisible: false,
    },
    diamant: {
        label: "Diamant Rouge",
        price: 3500,
        likesPerDay: UNLIMITED,
        superlikes: { count: 3, period: "day" },
        boosts: { count: 3, period: "week" },
        visibility: 2,
        calls: true,
        seeLikes: true,
        invisible: false,
    },
    jade: {
        label: "Jadéite Impériale",
        price: 5500,
        likesPerDay: UNLIMITED,
        superlikes: { count: 10, period: "day" },
        boosts: { count: 1, period: "day" },
        visibility: 3,
        calls: true,
        seeLikes: true,
        invisible: true,
    },
};

const PAID_PLANS = ["vip", "diamant", "jade"];
const BOOST_DURATION_MS = 30 * 60 * 1000;
// A paid plan's price (FCFA) buys this many days.
const PLAN_PERIOD_DAYS = 30;

function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return Number(value) || 0;
}

// The plan id currently in force for a users/{uid} document.
function activePlanId(userData, now = Date.now()) {
    const plan = userData?.plan;
    if (!PAID_PLANS.includes(plan)) return "free";
    return toMillis(userData.planExpiresAt) > now ? plan : "free";
}

function planFor(userData, now = Date.now()) {
    return PLANS[activePlanId(userData, now)];
}

// Quota window keys (UTC): "2026-09-30" for a day, "2026-W40" for an ISO week.
function periodKey(period, now = Date.now()) {
    const d = new Date(now);
    if (period === "day") return d.toISOString().slice(0, 10);
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

module.exports = { PLANS, PAID_PLANS, UNLIMITED, BOOST_DURATION_MS, PLAN_PERIOD_DAYS, activePlanId, planFor, periodKey, toMillis };
