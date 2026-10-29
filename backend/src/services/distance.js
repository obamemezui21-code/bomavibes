// Distance between members, computed on the server only. Members' positions
// (locations/{uid}, Admin SDK only: firestore.rules opens nothing there) never
// leave the server: other members only ever get a rounded distance, "à 5 km
// de toi", never coordinates.

// Stored to 3 decimals (about 110 m): enough for "moins de 1 km", and an
// exact address is never kept.
const COORD_DECIMALS = 3;

// Distances are rounded UP to one of these steps (km): "à 5 km" means 3 to
// 5 km. Coarse on purpose, so a few distances can't pin anyone down.
const STEPS_KM = [2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500];

function roundCoord(value) {
    const f = 10 ** COORD_DECIMALS;
    return Math.round(value * f) / f;
}

function isValidPosition(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Great-circle distance in km (Haversine).
function haversineKm(a, b) {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The rounded distance shown to members.
 * @returns {{ km: number, label: string }} km: the step's upper bound (0.9 for
 *   "moins de 1 km", 501 beyond the last step) — what filters compare with.
 */
function distanceBucket(km) {
    if (km < 1) return { km: 0.9, label: "à moins de 1 km de toi" };
    const step = STEPS_KM.find((s) => km <= s);
    if (!step) return { km: STEPS_KM[STEPS_KM.length - 1] + 1, label: `à plus de ${STEPS_KM[STEPS_KM.length - 1]} km de toi` };
    return { km: step, label: `à ${step} km de toi` };
}

module.exports = { COORD_DECIMALS, STEPS_KM, roundCoord, isValidPosition, haversineKm, distanceBucket };
