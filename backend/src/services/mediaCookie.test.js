const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { MEDIA_TTL_S, mediaSignature, mediaCookies, clearedMediaCookies } = require("./mediaCookie");

test("signs like nginx's secure_link_md5: base64url md5 of \"<exp><uid> <secret>\", no padding", () => {
    const expected = crypto.createHash("md5").update("1700000000abc123 s3cret").digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    assert.strictEqual(mediaSignature(1700000000, "abc123", "s3cret"), expected);
    assert.ok(!expected.includes("="));
});

test("cookies expire after the TTL, on /uploads/ only, HttpOnly and Secure", () => {
    const { exp, headers } = mediaCookies("uid1", "k", 1_000_000_000_000);
    assert.strictEqual(exp, 1_000_000_000 + MEDIA_TTL_S);
    assert.strictEqual(headers.length, 3);
    for (const h of headers) {
        assert.match(h, /Path=\/uploads\/;/);
        assert.match(h, /HttpOnly; Secure; SameSite=Lax/);
        assert.match(h, new RegExp(`Max-Age=${MEDIA_TTL_S};`));
    }
    assert.ok(headers[2].startsWith(`bv_m_sig=${mediaSignature(exp, "uid1", "k")};`));
});

test("a different member, expiry or secret gives a different signature", () => {
    const base = mediaSignature(100, "a", "k");
    assert.notStrictEqual(mediaSignature(100, "b", "k"), base);
    assert.notStrictEqual(mediaSignature(101, "a", "k"), base);
    assert.notStrictEqual(mediaSignature(100, "a", "k2"), base);
});

test("sign-out clears the three cookies", () => {
    const headers = clearedMediaCookies();
    assert.deepStrictEqual(headers.map((h) => h.split("=")[0]), ["bv_m_exp", "bv_m_uid", "bv_m_sig"]);
    for (const h of headers) assert.match(h, /Max-Age=0/);
});
