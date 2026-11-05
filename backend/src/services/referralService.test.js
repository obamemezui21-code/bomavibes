const test = require("node:test");
const assert = require("node:assert/strict");
const { createReferralService, isValidCode, newCode } = require("./referralService");

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 5, 12);
const config = { reward: 25, monthlyCap: 3, claimWindowMs: 7 * DAY };

// Just enough of Firestore: documents in a Map, transactions run straight
// through (and are retried by nothing: these tests have no concurrency).
function fakeDb(initial = {}) {
    const store = new Map(Object.entries(initial));
    const snap = (path) => ({
        exists: store.has(path),
        data: () => (store.has(path) ? { ...store.get(path) } : undefined),
    });
    const apply = (path, data) => {
        const next = { ...(store.get(path) || {}) };
        for (const [key, value] of Object.entries(data)) next[key] = value?.increment ? (next[key] || 0) + value.increment : value;
        store.set(path, next);
    };
    const doc = (path) => ({
        path,
        get: async () => snap(path),
    });
    const db = {
        store,
        collection: (name) => ({
            doc: (id) => doc(`${name}/${id}`),
            where: (field, _op, value) => ({
                get: async () => ({
                    docs: [...store.keys()]
                        .filter((key) => key.startsWith(`${name}/`) && store.get(key)[field] === value)
                        .map((key) => snap(key)),
                }),
            }),
        }),
        runTransaction: async (fn) =>
            fn({
                get: async (ref) => snap(ref.path),
                set: (ref, data) => apply(ref.path, data),
                update: (ref, data) => apply(ref.path, data),
            }),
    };
    return db;
}

function setup(initial = {}, { createdAt = NOW - DAY, at = NOW } = {}) {
    const db = fakeDb({ "users/parrain": { ngori: 5 }, "users/ami": {}, ...initial });
    let clock = at;
    const service = createReferralService({
        db,
        config,
        increment: (n) => ({ increment: n }),
        accountCreatedAt: async () => createdAt,
        now: () => clock,
    });
    return { db, service, setClock: (ms) => (clock = ms), ngori: () => db.store.get("users/parrain").ngori };
}

test("codes are readable, and only those are accepted", () => {
    for (let i = 0; i < 200; i++) assert.equal(isValidCode(newCode()), true);
    for (const code of ["", "abcdefgh", "ABCDEFG", "ABCDEFGHJ", "ABCDEFG0", "ABCD EFG", null, undefined, 12345678, {}]) {
        assert.equal(isValidCode(code), false, String(code));
    }
});

test("a member keeps the same code", async () => {
    const { service } = setup();
    const code = await service.codeOf("parrain");
    assert.equal(isValidCode(code), true);
    assert.equal(await service.codeOf("parrain"), code);
});

test("a friend who joins and gets verified pays the inviter once", async () => {
    const { service, ngori } = setup();
    const code = await service.codeOf("parrain");
    assert.equal(await service.claim("ami", code), true);
    assert.equal(ngori(), 5, "nothing for just signing up");

    assert.equal(await service.reward("ami"), "parrain");
    assert.equal(ngori(), 30);
    assert.equal(await service.reward("ami"), null);
    assert.equal(ngori(), 30, "a second approval pays nothing");

    assert.deepEqual(
        (({ pending, verified, earned }) => ({ pending, verified, earned }))(await service.summary("parrain")),
        { pending: 0, verified: 1, earned: 25 },
    );
});

test("a friend waiting for verification shows as pending", async () => {
    const { service } = setup();
    await service.claim("ami", await service.codeOf("parrain"));
    const summary = await service.summary("parrain");
    assert.equal(summary.pending, 1);
    assert.equal(summary.reward, 25);
    assert.equal(summary.monthlyCap, 3);
});

test("nobody can invite themselves", async () => {
    const { service, ngori } = setup();
    const code = await service.codeOf("parrain");
    assert.equal(await service.claim("parrain", code), false);
    assert.equal(await service.reward("parrain"), null);
    assert.equal(ngori(), 5);
});

test("a friend can't change who invited them", async () => {
    const { service, db } = setup({ "users/autre": {} });
    const first = await service.codeOf("parrain");
    const second = await service.codeOf("autre");
    assert.equal(await service.claim("ami", first), true);
    assert.equal(await service.claim("ami", second), false);
    assert.equal(db.store.get("referrals/ami").referrerUid, "parrain");
});

test("unknown or malformed codes record nothing", async () => {
    const { service, db } = setup();
    assert.equal(await service.claim("ami", "ABCDEFGH"), false);
    assert.equal(await service.claim("ami", "../../etc"), false);
    assert.equal(await service.claim("ami", null), false);
    assert.equal(db.store.has("referrals/ami"), false);
});

test("an old account can't be claimed as a new member", async () => {
    const { service, db } = setup({}, { createdAt: NOW - 8 * DAY });
    assert.equal(await service.claim("ami", await service.codeOf("parrain")), false);
    assert.equal(db.store.has("referrals/ami"), false);
    const unknown = setup({}, { createdAt: null });
    assert.equal(await unknown.service.claim("ami", await unknown.service.codeOf("parrain")), false);
});

test("an already verified member earns nothing for anyone", async () => {
    const { service } = setup({ "users/ami": { verificationBonusAt: NOW - DAY } });
    assert.equal(await service.claim("ami", await service.codeOf("parrain")), false);
});

test("members who weren't invited pay nobody", async () => {
    const { service } = setup();
    assert.equal(await service.reward("ami"), null);
});

test("stops paying at the monthly cap, and starts again next month", async () => {
    const { service, db, ngori, setClock } = setup();
    const code = await service.codeOf("parrain");
    const friends = ["a", "b", "c", "d"];
    for (const friend of friends) {
        db.store.set(`users/${friend}`, {});
        await service.claim(friend, code);
    }
    const paid = [];
    for (const friend of friends) paid.push(await service.reward(friend));
    assert.deepEqual(paid, ["parrain", "parrain", "parrain", null]);
    assert.equal(ngori(), 5 + 3 * 25);
    assert.equal(db.store.get("referrals/d").status, "capped");

    db.store.set("users/e", {});
    await service.claim("e", code);
    setClock(Date.UTC(2026, 11, 2));
    assert.equal(await service.reward("e"), "parrain");
    assert.equal(ngori(), 5 + 4 * 25);
    const summary = await service.summary("parrain");
    assert.equal(summary.verified, 4);
    assert.equal(summary.earned, 100);
});

test("an inviter whose account is gone is never paid", async () => {
    const { service, db } = setup();
    await service.claim("ami", await service.codeOf("parrain"));
    db.store.set("users/parrain", { deleted: true });
    assert.equal(await service.reward("ami"), null);
    assert.equal(db.store.get("referrals/ami").status, "void");
    assert.equal(db.store.get("users/parrain").ngori, undefined);
});
