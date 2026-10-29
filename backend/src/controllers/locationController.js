const admin = require("../config/firebaseAdmin");
const { periodKey } = require("../config/plans");
const { roundCoord, isValidPosition, haversineKm, distanceBucket } = require("../services/distance");

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// Members' positions, for "à 5 km de toi" (services/distance.js).
//
// Firestore (Admin SDK only — no client rule opens it):
//   locations/{uid}   lat, lng (3 decimals), updatedAt, day, updates (that day)
//
// A position can't be updated too often: moving one's own position around is
// how someone would try to triangulate another member from the rounded
// distances.

const MIN_UPDATE_MS = 2 * 60 * 1000;
const MAX_UPDATES_PER_DAY = 30;
// An old position says nothing about where someone is now.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_UIDS = 60;

function usable(loc, now) {
    return loc && isValidPosition(loc.lat, loc.lng) && now - (loc.updatedAt?.toMillis?.() || 0) < MAX_AGE_MS;
}

// POST /api/location { lat, lng } → { ok: true } | 429 when updated too often
async function saveLocation(req, res) {
    const uid = req.firebaseUser.uid;
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (typeof req.body?.lat !== "number" || typeof req.body?.lng !== "number" || !isValidPosition(lat, lng)) {
        return res.status(400).json({ message: "Position invalide" });
    }
    const ref = db.collection("locations").doc(uid);
    const now = Date.now();
    const today = periodKey("day", now);
    try {
        const saved = await db.runTransaction(async (tx) => {
            const current = (await tx.get(ref)).data();
            const updates = current?.day === today ? current.updates || 0 : 0;
            if (current && (now - (current.updatedAt?.toMillis?.() || 0) < MIN_UPDATE_MS || updates >= MAX_UPDATES_PER_DAY)) return false;
            tx.set(ref, { lat: roundCoord(lat), lng: roundCoord(lng), updatedAt: FieldValue.serverTimestamp(), day: today, updates: updates + 1 });
            return true;
        });
        if (!saved) return res.status(429).json({ message: "Position déjà mise à jour récemment" });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer la position" });
    }
}

// DELETE /api/location — forget the member's position
async function deleteLocation(req, res) {
    try {
        await db.collection("locations").doc(req.firebaseUser.uid).delete();
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'effacer la position" });
    }
}

// POST /api/location/distances { uids: string[] }
//   → { located, distances: { [uid]: { km, label } } }
// located: whether the viewer has a position at all. A member who hides their
// distance, or has no recent position, is simply left out.
async function getDistances(req, res) {
    const uid = req.firebaseUser.uid;
    const uids = req.body?.uids;
    if (!Array.isArray(uids) || uids.length > MAX_UIDS || !uids.every((u) => typeof u === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(u))) {
        return res.status(400).json({ message: "Liste de profils invalide" });
    }
    const others = [...new Set(uids)].filter((u) => u !== uid);
    const now = Date.now();
    try {
        const mine = (await db.collection("locations").doc(uid).get()).data();
        if (!usable(mine, now)) return res.json({ located: false, distances: {} });
        if (!others.length) return res.json({ located: true, distances: {} });

        const [locs, profiles] = await Promise.all([
            db.getAll(...others.map((u) => db.collection("locations").doc(u))),
            db.getAll(...others.map((u) => db.collection("profiles").doc(u)), { fieldMask: ["hideDistance"] }),
        ]);
        const distances = {};
        others.forEach((other, i) => {
            const loc = locs[i].data();
            if (!usable(loc, now) || profiles[i].data()?.hideDistance) return;
            distances[other] = distanceBucket(haversineKm(mine, loc));
        });
        res.json({ located: true, distances });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de calculer les distances" });
    }
}

module.exports = { saveLocation, deleteLocation, getDistances, MAX_UIDS };
