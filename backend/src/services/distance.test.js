const test = require("node:test");
const assert = require("node:assert");
const { roundCoord, isValidPosition, haversineKm, distanceBucket } = require("./distance");

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

test("distances are rounded up to coarse steps", () => {
    assert.deepStrictEqual(distanceBucket(0), { km: 0.9, label: "à moins de 1 km de toi" });
    assert.deepStrictEqual(distanceBucket(0.99), { km: 0.9, label: "à moins de 1 km de toi" });
    assert.deepStrictEqual(distanceBucket(1), { km: 2, label: "à 2 km de toi" });
    assert.deepStrictEqual(distanceBucket(2.4), { km: 3, label: "à 3 km de toi" });
    assert.deepStrictEqual(distanceBucket(4.2), { km: 5, label: "à 5 km de toi" });
    assert.deepStrictEqual(distanceBucket(14), { km: 15, label: "à 15 km de toi" });
    assert.deepStrictEqual(distanceBucket(147), { km: 150, label: "à 150 km de toi" });
    assert.deepStrictEqual(distanceBucket(2000), { km: 501, label: "à plus de 500 km de toi" });
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
