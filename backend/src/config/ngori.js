// Ngori — the in-app coin. One is collected per day on opening the app, with
// a bonus every STREAK_LENGTH days in a row, and spent on time-limited
// tastes of subscriber features. frontend-web/src/lib/ngori.js mirrors the
// rewards for display only: keep both in sync.
//
// Everything lives on users/{uid} and is written only by the Admin SDK (see
// firestore.rules): ngori (balance), ngoriStreak, ngoriLastClaimDay
// ("2026-10-01", UTC) and perks.{unlimitedLikesUntil, seeLikesUntil,
// callsUntil} (Timestamps).

const { periodKey, planFor, toMillis } = require("./plans");

const DAILY_REWARD = 1;
const STREAK_LENGTH = 7;
const STREAK_BONUS = 3;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// `perk` is the users/{uid}.perks field the reward extends; `planFlag` the
// plan feature it stands in for (redeeming is refused when the plan already
// includes it). The boost reuses profiles/{uid}.boostedUntil instead.
const REWARDS = {
    unlimited_likes: { cost: 10, durationMs: 30 * MINUTE, perk: "unlimitedLikesUntil", label: "Likes illimités" },
    boost: { cost: 25, durationMs: 30 * MINUTE, label: "Boost du profil" },
    see_likes: { cost: 35, durationMs: 24 * HOUR, perk: "seeLikesUntil", planFlag: "seeLikes", label: "Voir qui vous aime" },
    calls: { cost: 50, durationMs: 24 * HOUR, perk: "callsUntil", planFlag: "calls", label: "Appels audio & vidéo" },
};

// NGORI RUN (the mini-game) — tune here, the server enforces all of it.
const NGORI_RUN = {
    dailyCap: 5, // Ngori a player can earn from the game per day (UTC)
    maxStartsPerDay: 40,
    minStartIntervalMs: 3000,
    maxRunMs: 30 * 60 * 1000, // a run left open longer than this pays nothing
    // Real time must be at least this share of the simulated time (pauses
    // only make it longer; a replay "played" faster than real time is forged).
    minTimeRatio: 0.9,
};

// 🔥 badge shown on the profile for a login streak of at least N days.
const STREAK_BADGES = [30, 14, 7, 3];

function streakBadgeFor(streak) {
    return STREAK_BADGES.find((days) => streak >= days) || null;
}

function previousDay(day) {
    return new Date(Date.parse(`${day}T00:00:00Z`) - 24 * HOUR).toISOString().slice(0, 10);
}

// What opening the app today is worth, given the stored claim state.
// → null when today was already claimed.
function dailyClaim(userData, now = Date.now()) {
    const today = periodKey("day", now);
    const last = userData?.ngoriLastClaimDay || null;
    if (last === today) return null;
    const streak = last === previousDay(today) ? (userData.ngoriStreak || 0) + 1 : 1;
    const bonus = streak % STREAK_LENGTH === 0 ? STREAK_BONUS : 0;
    return { day: today, streak, gained: DAILY_REWARD + bonus, bonus };
}

function perkActive(userData, field, now = Date.now()) {
    return toMillis(userData?.perks?.[field]) > now;
}

// A plan with the Ngori perks in force folded in — what every server-side
// check (likes quota, "voir qui vous aime") should use.
function withPerks(plan, userData, now = Date.now()) {
    const perked = { ...plan };
    if (perkActive(userData, "unlimitedLikesUntil", now)) perked.likesPerDay = Infinity;
    if (perkActive(userData, "seeLikesUntil", now)) perked.seeLikes = true;
    if (perkActive(userData, "callsUntil", now)) perked.calls = true;
    return perked;
}

function effectivePlanFor(userData, now = Date.now()) {
    return withPerks(planFor(userData, now), userData, now);
}

module.exports = { DAILY_REWARD, STREAK_LENGTH, STREAK_BONUS, REWARDS, NGORI_RUN, streakBadgeFor, dailyClaim, perkActive, withPerks, effectivePlanFor, previousDay };
