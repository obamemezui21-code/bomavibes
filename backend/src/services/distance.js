// Distance between members, computed on the server only. Members' positions
// (locations/{uid}, Admin SDK only: firestore.rules opens nothing there) never
// leave the server: other members only ever get a distance in km, "à 7 km
// de toi", never coordinates.

// Stored to 3 decimals (about 110 m): enough for "moins de 1 km", and an
// exact address is never kept.
const COORD_DECIMALS = 3;

// Before measuring, both positions are snapped to a grid of 0.01° (about
// 1.1 km). The km shown is then exact to the kilometre, but moving one's own
// position around and measuring again (trilateration) can only ever find the
// grid square someone is in, never where they actually are.
const GRID_DEG = 0.01;

function roundCoord(value) {
    const f = 10 ** COORD_DECIMALS;
    return Math.round(value * f) / f;
}

function snapToGrid({ lat, lng }) {
    const snap = (v) => Math.round(Math.round(v / GRID_DEG) * GRID_DEG * 1e6) / 1e6;
    return { lat: snap(lat), lng: snap(lng) };
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

// "1 234" with a French thin space between thousands.
function formatKm(km) {
    return String(km).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/**
 * The distance shown to members, to the kilometre.
 * @returns {{ km: number, label: string }} km: what filters and the sort by
 *   distance compare with (0.5 for "moins de 1 km").
 */
function distanceLabel(km) {
    if (km < 1) return { km: 0.5, label: "à moins de 1 km de toi" };
    const whole = Math.round(km);
    return { km: whole, label: `à ${formatKm(whole)} km de toi` };
}

// Distance between two members' stored positions, both snapped to the grid.
function distanceBetween(a, b) {
    return distanceLabel(haversineKm(snapToGrid(a), snapToGrid(b)));
}

module.exports = { COORD_DECIMALS, GRID_DEG, roundCoord, snapToGrid, isValidPosition, haversineKm, distanceLabel, distanceBetween };
