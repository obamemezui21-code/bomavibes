const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { profileCanInteract } = require("../services/identityAccess");
const { applySwipe, sendSwipeError } = require("./swipeController");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// CrushTime (as on happn): among 4 profiles, one has liked you — find which.
// Right guess: it's a like back, so a match. Free accounts get a way to meet
// the people waiting in "Qui t'a aimé·e" without seeing the list.
//
// Firestore (Admin SDK only):
//   crushTime/{uid}  day, plays (today), round { likerId, optionIds } | null,
//                    playedLikers [ids] — each like gets one round only, so
//                    the liker can't be found by elimination over rounds.

const PLAYS_PER_DAY = 3;
const DECOYS = 3;
const SYSTEM_ACCOUNT_ID = "bomavibes-team";
const LIKE_DIRECTIONS = ["like", "superlike"];

class CrushError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function summary(id, p) {
    return {
        id,
        firstName: p.firstName || "",
        age: p.hideAge ? null : p.age || null,
        city: p.city || null,
        photo: p.photos?.[0] || null,
        verified: !!p.verified,
    };
}

// Who liked uid and still waits for an answer, minus blocks; plus every id
// uid has already swiped (never a decoy) and the blocked ones.
async function loadContext(uid) {
    const [likesSnap, mySwipesSnap, blockedByMe, blockingMe] = await Promise.all([
        db.collection("swipes").where("targetId", "==", uid).where("direction", "in", LIKE_DIRECTIONS).get(),
        db.collection("swipes").where("swiperId", "==", uid).get(),
        db.collection("blocks").where("blockerId", "==", uid).get(),
        db.collection("blocks").where("blockedId", "==", uid).get(),
    ]);
    const swiped = new Set(mySwipesSnap.docs.map((d) => d.data().targetId));
    const blocked = new Set([...blockedByMe.docs.map((d) => d.data().blockedId), ...blockingMe.docs.map((d) => d.data().blockerId)]);
    const likers = likesSnap.docs.map((d) => d.data().swiperId).filter((id) => !swiped.has(id) && !blocked.has(id));
    return { likers, swiped, blocked };
}

async function newRound(uid, ctx, playedLikers) {
    const candidates = shuffle(ctx.likers.filter((id) => !playedLikers.includes(id)));
    for (const likerId of candidates) {
        const liker = (await db.collection("profiles").doc(likerId).get()).data();
        if (!liker?.photos?.length) continue;
        // Decoys of the same gender as the liker, so the answer isn't obvious.
        let q = db.collection("profiles");
        if (liker.gender) q = q.where("gender", "==", liker.gender);
        const snap = await q.limit(80).get();
        const likerSet = new Set(ctx.likers);
        const decoys = shuffle(
            snap.docs.filter((d) => {
                const p = d.data();
                return (
                    d.id !== uid &&
                    d.id !== SYSTEM_ACCOUNT_ID &&
                    !likerSet.has(d.id) &&
                    !ctx.swiped.has(d.id) &&
                    !ctx.blocked.has(d.id) &&
                    p.photos?.length &&
                    !p.invisible &&
                    profileCanInteract(p)
                );
            }),
        ).slice(0, DECOYS);
        if (decoys.length < DECOYS) continue;
        return { likerId, optionIds: shuffle([likerId, ...decoys.map((d) => d.id)]) };
    }
    return null;
}

async function roundView(round) {
    const snaps = await Promise.all(round.optionIds.map((id) => db.collection("profiles").doc(id).get()));
    return { options: snaps.map((s) => summary(s.id, s.data() || {})) };
}

// GET /api/crush-time → { playsLeft, waiting, round: { options } | null }
async function getCrushTime(req, res) {
    const uid = req.firebaseUser.uid;
    const day = periodKey("day");
    try {
        const ref = db.collection("crushTime").doc(uid);
        const [stateSnap, ctx] = await Promise.all([ref.get(), loadContext(uid)]);
        const state = stateSnap.data() || {};
        const plays = state.day === day ? state.plays || 0 : 0;
        const playedLikers = state.playedLikers || [];
        let round = state.round || null;

        // A round whose liker has since been answered (or blocked) is dropped.
        if (round && !ctx.likers.includes(round.likerId)) round = null;
        if (!round && plays < PLAYS_PER_DAY) {
            round = await newRound(uid, ctx, playedLikers);
            if (round) await ref.set({ day, plays, round, playedLikers }, { merge: true });
        }
        const waiting = ctx.likers.filter((id) => !playedLikers.includes(id)).length;
        res.json({
            playsLeft: Math.max(0, PLAYS_PER_DAY - plays),
            waiting,
            round: round ? await roundView(round) : null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

// POST /api/crush-time/guess { targetId } → { correct, matchId, crush }
async function guessCrush(req, res) {
    const uid = req.firebaseUser.uid;
    const { targetId } = req.body || {};
    const day = periodKey("day");
    try {
        const ref = db.collection("crushTime").doc(uid);
        const state = (await ref.get()).data() || {};
        const round = state.round;
        if (!round || typeof targetId !== "string" || !round.optionIds.includes(targetId)) {
            throw new CrushError(400, "Cette manche n'est plus disponible.");
        }
        const plays = state.day === day ? state.plays || 0 : 0;
        if (plays >= PLAYS_PER_DAY) throw new CrushError(429, "Tu as utilisé tes essais du jour. Reviens demain !");

        const correct = targetId === round.likerId;
        let matchId = null;
        // A right guess is a like back (quotas apply): done before using up
        // the round, so a refused like leaves it playable.
        if (correct) ({ matchId } = await applySwipe(uid, round.likerId, "like"));

        await ref.set(
            { day, plays: plays + 1, round: null, playedLikers: FieldValue.arrayUnion(round.likerId), updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
        );
        const crush = correct ? summary(round.likerId, (await db.collection("profiles").doc(round.likerId).get()).data() || {}) : null;
        res.json({ correct, matchId, crush });
    } catch (err) {
        if (err instanceof CrushError) return res.status(err.status).json({ message: err.message });
        sendSwipeError(res, err);
    }
}

module.exports = { getCrushTime, guessCrush };
