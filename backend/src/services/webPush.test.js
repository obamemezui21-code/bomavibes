const test = require("node:test");
const assert = require("node:assert/strict");
const { webpush, deadTokens } = require("./webPush");

test("only devices gone for good are dropped, not those FCM failed to reach this time", () => {
    const response = {
        responses: [
            { success: true },
            { success: false, error: { code: "messaging/registration-token-not-registered" } },
            { success: false, error: { code: "messaging/server-unavailable" } },
            { success: false, error: { code: "messaging/invalid-registration-token" } },
            { success: false },
        ],
    };
    assert.deepEqual(deadTokens(response, ["a", "b", "c", "d", "e"]), ["b", "d"]);
});

test("a chat message wakes the phone, a call also expires, the rest waits", () => {
    assert.deepEqual(webpush({ prompt: true }).headers, { Urgency: "high" });
    assert.deepEqual(webpush({ urgent: true }).headers, { Urgency: "high", TTL: "45" });
    assert.equal(webpush().headers, undefined);
});
