const test = require("node:test");
const assert = require("node:assert");
const { roundCoord, snapToGrid, isValidPosition, haversineKm, distanceLabel, distanceBetween } = require("./distance");

const LIBREVILLE = { lat: 0.4162, lng: 9.4673 };
const OWENDO = { lat: 0.2917, lng: 9.5044 };
const PORT_GENTIL = { lat: -0.7193, lng: 8.7815 };

test("Haversine gives real distances", () => {
    assert.strictEqual(haversineKm(LIBREVILLE, LIBREVILLE), 0);
    const owendo = haversineKm(LIBREVILLE, OWENDO);
    assert.ok(owendo > 13 && owendo < 15, `Libreville–Owendo ≈ 14 km, got ${owendo}`);
    const pog = haversineKm(LIBREVILLE, PORT_GENTIL);
    assert.ok(pog > 145 && pog < 150, `Libreville–Port-Gentil ≈ 147 km, got ${pog}`);
    assert.strictEqual(Math.round(haversineKm(LIBREVILLE, OWENDO) * 1000), Math.round(haversineKm(OWENDO, LIBREVILLE) * 1000));
});

test("distances are shown to the kilometre", () => {
    assert.deepStrictEqual(distanceLabel(0), { km: 0.5, label: "à moins de 1 km de toi" });
    assert.deepStrictEqual(distanceLabel(0.99), { km: 0.5, label: "à moins de 1 km de toi" });
    assert.deepStrictEqual(distanceLabel(1), { km: 1, label: "à 1 km de toi" });
    assert.deepStrictEqual(distanceLabel(7.4), { km: 7, label: "à 7 km de toi" });
    assert.deepStrictEqual(distanceLabel(147.6), { km: 148, label: "à 148 km de toi" });
    assert.deepStrictEqual(distanceLabel(2345.2), { km: 2345, label: "à 2 345 km de toi" });
});

test("positions are snapped to a ~1 km grid before measuring", () => {
    assert.deepStrictEqual(snapToGrid({ lat: 0.4162, lng: 9.4673 }), { lat: 0.42, lng: 9.47 });
    assert.deepStrictEqual(snapToGrid({ lat: -0.7193, lng: 8.7815 }), { lat: -0.72, lng: 8.78 });
    // Moving within the same square gives the same distance: nothing to triangulate.
    assert.deepStrictEqual(distanceBetween({ lat: 0.4162, lng: 9.4673 }, OWENDO), distanceBetween({ lat: 0.4189, lng: 9.4651 }, OWENDO));
    const d = distanceBetween(LIBREVILLE, PORT_GENTIL);
    assert.ok(d.km >= 145 && d.km <= 150, `Libreville–Port-Gentil ≈ 147 km, got ${d.km}`);
});

test("positions are kept to about 100 m, never more precise", () => {
    assert.strictEqual(roundCoord(0.416234567), 0.416);
    assert.strictEqual(roundCoord(-0.71938), -0.719);
});

test("rejects impossible positions", () => {
    assert.ok(isValidPosition(0.4, 9.4));
    assert.ok(!isValidPosition(91, 0));
    assert.ok(!isValidPosition(0, 181));
    assert.ok(!isValidPosition(NaN, 0));
    assert.ok(!isValidPosition("0.4", 9));
});
