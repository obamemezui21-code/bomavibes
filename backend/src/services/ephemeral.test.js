const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { isValidTtl, sweepUntilMs, localAttachmentPath } = require("./ephemeral");

const DAY_S = 24 * 60 * 60;
const ROOT = path.resolve("/srv/bomavibes/uploads");

test("only the offered durations are accepted", () => {
    assert.ok(isValidTtl(0));
    assert.ok(isValidTtl(DAY_S));
    assert.ok(isValidTtl(7 * DAY_S));
    for (const bad of [1, 60, -DAY_S, 30 * DAY_S, "86400", null, undefined, NaN]) {
        assert.strictEqual(isValidTtl(bad), false, String(bad));
    }
});

test("a conversation is swept while the setting is on, and a while after", () => {
    const now = 1_000_000;
    assert.ok(sweepUntilMs(DAY_S, 0, now) > now + 365 * DAY_S * 1000);
    // Turned off: the last messages sent still expire up to one ttl later.
    const until = sweepUntilMs(0, 7 * DAY_S, now);
    assert.ok(until >= now + 7 * DAY_S * 1000);
    assert.ok(until <= now + 8 * DAY_S * 1000);
    assert.strictEqual(sweepUntilMs(0, 0, now), null);
});

test("only the sender's own chat uploads can be deleted", () => {
    const own = localAttachmentPath("https://bomavibes.tech/uploads/chat-attachments/abc/image-1700000000000.jpg", "abc", ROOT);
    assert.strictEqual(own, path.join(ROOT, "chat-attachments", "abc", "image-1700000000000.jpg"));
    assert.strictEqual(
        localAttachmentPath("https://bomavibes.tech/uploads/voice-notes/abc/voice-1700000000000.webm", "abc", ROOT),
        path.join(ROOT, "voice-notes", "abc", "voice-1700000000000.webm"),
    );
    assert.ok(localAttachmentPath("/uploads/chat-attachments/abc/file-1700000000000-cv.pdf", "abc", ROOT));

    for (const url of [
        "https://bomavibes.tech/uploads/chat-attachments/other/image-1.jpg", // another member's file
        "https://bomavibes.tech/uploads/profile-photos/abc/photo-1.jpg", // a profile photo
        "https://bomavibes.tech/uploads/voice-notes/abc/prompt-1.webm", // the profile's voice prompt
        "https://bomavibes.tech/uploads/chat-attachments/abc/%2e%2e/x.jpg",
        "https://bomavibes.tech/uploads/chat-attachments/abc/..%2F..%2Fsecret",
        "https://bomavibes.tech/uploads/chat-attachments/abc/%E0%A4%A",
        "",
        null,
    ]) {
        assert.strictEqual(localAttachmentPath(url, "abc", ROOT), null, String(url));
    }
});
