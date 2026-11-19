const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Monerails payments, end to end, against an in-memory Firestore and a fake
// Monerails API. Installed before the controller is loaded: nothing here
// reaches the real database, Monerails or any phone.
process.env.MONERAILS_API_KEY = "mr_live_testkey";
process.env.MONERAILS_WEBHOOK_SECRET = "whsec_unit";
delete process.env.SINGPAY_CLIENT_ID;
delete process.env.PAYMENT_PROVIDER;

const store = new Map();
const docRef = (p) => ({
    id: p.split("/").at(-1),
    path: p,
    get: async () => ({ exists: store.has(p), id: p.split("/").at(-1), data: () => (store.has(p) ? { ...store.get(p) } : undefined) }),
    set: async (d, opt) => store.set(p, opt?.merge ? { ...(store.get(p) || {}), ...d } : { ...d }),
    update: async (d) => store.set(p, { ...store.get(p), ...d }),
});
const query = (name, filters = []) => ({
    where: (f, op, v) => query(name, [...filters, [f, op, v]]),
    limit: () => query(name, filters),
    get: async () => {
        const docs = [...store.entries()]
            .filter(([k]) => k.startsWith(`${name}/`) && k.split("/").length === 2)
            .filter(([, d]) => filters.every(([f, op, v]) => (op === "in" ? v.includes(d[f]) : d[f] === v)))
            .map(([k, d]) => ({ id: k.split("/")[1], data: () => ({ ...d }) }));
        return { docs, empty: !docs.length, size: docs.length };
    },
});
const fakeDb = {
    collection: (name) => Object.assign(query(name), { doc: (id) => docRef(`${name}/${id}`) }),
    runTransaction: async (fn) => fn({ get: (ref) => ref.get(), update: (ref, d) => ref.update(d), set: (ref, d, o) => ref.set(d, o) }),
};
const fakeAdmin = {
    firestore: Object.assign(() => fakeDb, { FieldValue: { serverTimestamp: () => new Date() } }),
    auth: () => ({ verifyIdToken: async (t) => ({ uid: t }) }),
};
require.cache[require.resolve("../config/firebaseAdmin")] = { id: "fa", filename: "fa", loaded: true, exports: fakeAdmin };
const grants = [];
require.cache[require.resolve("../services/subscriptionService")] = {
    id: "ss",
    filename: "ss",
    loaded: true,
    exports: { grantPlan: async (uid, plan, days, by) => (grants.push({ uid, plan, days, by }), new Date(Date.now() + days * 864e5)) },
};

// The fake Monerails API: operators for Gabon, and collections we control.
const api = { collections: new Map(), requests: [] };
global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    api.requests.push({ method: init.method || "GET", path: u.pathname + u.search, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (u.pathname === "/v1/operators") {
        return json(200, { object: "list", data: [{ code: "AIRTEL_GA", name: "Airtel Money", country: "GA" }, { code: "MOOV_GA", name: "Moov Money", country: "GA" }] });
    }
    if (u.pathname === "/v1/collections" && init.method === "POST") {
        const b = JSON.parse(init.body);
        const c = { id: `col_${api.collections.size + 1}`, object: "collection", livemode: true, status: "pending", amount: b.amount, currency: b.currency, client_reference: b.client_reference, next_action: { type: "customer_approval", message: "Validez sur votre téléphone", ussd_code: "*150#" } };
        api.collections.set(c.id, c);
        return json(201, c);
    }
    const m = u.pathname.match(/^\/v1\/collections\/(.+)$/);
    if (m) return json(200, api.collections.get(m[1]));
    return json(404, { error: { code: "not_found", message: "not found" } });
};

const monerails = require("../services/monerailsService");
const payments = require("./paymentController");

function res() {
    const r = { statusCode: 200, body: null };
    r.status = (c) => ((r.statusCode = c), r);
    r.json = (b) => ((r.body = b), r);
    return r;
}
const req = ({ uid = "u1", body = {}, headers = {}, params = {} } = {}) => ({ firebaseUser: { uid }, body, params, get: (h) => headers[h] });

function reset() {
    store.clear();
    grants.length = 0;
    api.collections.clear();
    api.requests.length = 0;
    monerails._resetOperatorsCache();
    store.set("users/u1", { role: "user" });
    store.set("users/boss", { role: "admin" });
    store.set("profiles/u1", { firstName: "Awa" });
}

const sign = (body, secret = "whsec_unit", t = Math.floor(Date.now() / 1000)) =>
    `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

test("webhook signatures: right secret, fresh, exact bytes — else refused", () => {
    const body = '{"type":"collection.succeeded"}';
    assert.equal(monerails.verifySignature(Buffer.from(body), sign(body)), true);
    assert.equal(monerails.verifySignature(Buffer.from(body), sign(body, "whsec_other")), false);
    assert.equal(monerails.verifySignature(Buffer.from(`${body} `), sign(body)), false);
    assert.equal(monerails.verifySignature(Buffer.from(body), sign(body, "whsec_unit", Math.floor(Date.now() / 1000) - 600)), false);
    // During a secret rotation: two v1, one matches.
    const t = Math.floor(Date.now() / 1000);
    const good = sign(body, "whsec_unit", t).split("v1=")[1];
    assert.equal(monerails.verifySignature(Buffer.from(body), `t=${t},v1=${"0".repeat(64)},v1=${good}`), true);
    assert.equal(monerails.verifySignature(Buffer.from(body), ""), false);
});

test("Gabon numbers: Airtel and Moov recognised; others refused; test numbers only in test mode", () => {
    assert.deepEqual(monerails.parsePhone("+241 74 12 34 56"), { phone: "074123456", operator: "airtel" });
    assert.deepEqual(monerails.parsePhone("066 12 34 56"), { phone: "066123456", operator: "moov" });
    assert.equal(monerails.parsePhone("011 12 34 56"), null);
    assert.equal(monerails.parsePhone("00000001"), null, "live key: no test number");
    process.env.MONERAILS_API_KEY = "mr_test_x";
    try {
        assert.equal(monerails.parsePhone("00000001").phone, "24100000001");
    } finally {
        process.env.MONERAILS_API_KEY = "mr_live_testkey";
    }
});

test("a payment asks Monerails for the plan's price, once, with the right operator", async () => {
    reset();
    const r = res();
    await payments.startPayment(req({ body: { plan: "vip", duration: "month", phone: "074123456" } }), r);
    assert.equal(r.statusCode, 201);
    assert.equal(r.body.status, "pending");
    assert.match(r.body.instruction, /\*150#/);
    const create = api.requests.find((x) => x.method === "POST");
    assert.equal(create.body.amount, 2990);
    assert.equal(create.body.currency, "XAF");
    assert.equal(create.body.country, "GA");
    assert.equal(create.body.operator, "AIRTEL_GA");
    assert.equal(create.body.client_reference, r.body.reference);
    assert.equal(create.headers["Idempotency-Key"], r.body.reference, "a retry never charges twice");
    assert.match(create.headers.Authorization, /^Bearer mr_live_/);
});

test("succeeded at full price: plan granted once, even if checked twice at the same time", async () => {
    reset();
    const r = res();
    await payments.startPayment(req({ body: { plan: "vip", duration: "week", phone: "066123456" } }), r);
    const ref = r.body.reference;
    const col = [...api.collections.values()][0];
    col.status = "succeeded";
    await Promise.all([payments.reconcile(ref), payments.reconcile(ref)]);
    assert.equal(store.get(`payments/${ref}`).status, "paid");
    assert.equal(grants.length, 1);
    assert.deepEqual([grants[0].plan, grants[0].days], ["vip", 7]);
});

test("never granted: a lower amount, test money on a live payment, a failure or an expiry", async () => {
    for (const [change, status] of [
        [{ status: "succeeded", amount: 100 }, "failed"],
        [{ status: "succeeded", livemode: false }, "failed"],
        [{ status: "failed", failure_message: "Insufficient balance" }, "failed"],
        [{ status: "expired" }, "expired"],
    ]) {
        reset();
        const r = res();
        await payments.startPayment(req({ body: { plan: "vip", duration: "month", phone: "074123456" } }), r);
        Object.assign([...api.collections.values()][0], change);
        await payments.reconcile(r.body.reference);
        assert.equal(store.get(`payments/${r.body.reference}`).status, status, JSON.stringify(change));
        assert.equal(grants.length, 0, JSON.stringify(change));
    }
    assert.match(store.get([...store.keys()].find((k) => k.startsWith("payments/"))).failureReason, /expiré/);
});

test("webhook: refused unsigned; signed, it re-reads the collection from the API", async () => {
    reset();
    const r = res();
    await payments.startPayment(req({ body: { plan: "diamant", duration: "month", phone: "074123456" } }), r);
    const ref = r.body.reference;
    const col = [...api.collections.values()][0];
    col.status = "succeeded";
    // The webhook body lies about nothing it decides: the status is re-read.
    const body = JSON.stringify({ type: "collection.succeeded", data: { object: { id: col.id, object: "collection", status: "succeeded", client_reference: ref } } });

    const bad = res();
    await payments.monerailsWebhook({ body: Buffer.from(body), get: () => "t=1,v1=00" }, bad);
    assert.equal(bad.statusCode, 400);
    assert.equal(store.get(`payments/${ref}`).status, "pending");

    const ok = res();
    await payments.monerailsWebhook({ body: Buffer.from(body), get: (h) => (h === "Monerail-Signature" ? sign(body) : undefined) }, ok);
    await new Promise((r2) => setTimeout(r2, 20));
    assert.equal(ok.body.received, true);
    assert.equal(store.get(`payments/${ref}`).status, "paid");
    assert.equal(grants.length, 1);
});

test("test key: only admins see and use Mobile Money; the test plan is marked as such", async () => {
    reset();
    process.env.MONERAILS_API_KEY = "mr_test_x";
    try {
        const anon = res();
        await payments.getPaymentConfig({ get: () => undefined }, anon);
        assert.equal(anon.body.mobileMoney, false);
        const member = res();
        await payments.getPaymentConfig({ get: (h) => (h === "Authorization" ? "Bearer u1" : undefined) }, member);
        assert.equal(member.body.mobileMoney, false);
        const boss = res();
        await payments.getPaymentConfig({ get: (h) => (h === "Authorization" ? "Bearer boss" : undefined) }, boss);
        assert.deepEqual([boss.body.mobileMoney, boss.body.testMode], [true, true]);

        const refused = res();
        await payments.startPayment(req({ uid: "u1", body: { plan: "vip", phone: "00000001" } }), refused);
        assert.equal(refused.statusCode, 503);

        const r = res();
        await payments.startPayment(req({ uid: "boss", body: { plan: "vip", phone: "00000001" } }), r);
        assert.equal(r.statusCode, 201);
        const col = [...api.collections.values()][0];
        Object.assign(col, { status: "succeeded", livemode: false });
        await payments.reconcile(r.body.reference);
        assert.equal(store.get(`payments/${r.body.reference}`).testMode, true);
        assert.match(grants[0].by, /^monerails-test:/);
    } finally {
        process.env.MONERAILS_API_KEY = "mr_live_testkey";
    }
});

test("PAYMENT_PROVIDER=singpay without SingPay keys: nothing offered (WhatsApp)", async () => {
    process.env.PAYMENT_PROVIDER = "singpay";
    try {
        assert.equal(payments.activeProvider(), null);
    } finally {
        delete process.env.PAYMENT_PROVIDER;
    }
    assert.equal(payments.activeProvider(), "monerails");
});
