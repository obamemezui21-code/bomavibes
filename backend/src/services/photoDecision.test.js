const test = require("node:test");
const assert = require("node:assert");
const { decidePhoto, PHOTO_REASONS, reasonFor, photosSuspension } = require("./photoDecision");

const person = { person: 0.9, animal: 0.02, drawing: 0.01, object: 0.05 };
const clear = { faceScore: 0.97, faceShare: 0.3, sharpness: 12, brightness: 110, kinds: person };
const verdict = (changes) => decidePhoto({ ...clear, ...changes }).verdict;
const code = (changes) => decidePhoto({ ...clear, ...changes }).code;

test("a clear portrait is accepted", () => {
    assert.deepStrictEqual(decidePhoto(clear), { verdict: "accepted", code: null });
});

test("the face threshold is ~0.6 now: weaker faces go to a human, never refused", () => {
    assert.strictEqual(verdict({ faceScore: 0.7 }), "review"); // was refused under 0.8
    assert.strictEqual(code({ faceScore: 0.7 }), "photo-face-hidden");
    assert.strictEqual(verdict({ faceScore: 0.62 }), "review");
    assert.strictEqual(verdict({ faceScore: 0.8 }), "accepted");
});

test("a phone in front of the face (mirror selfie): CLIP sees a person → review, not refused", () => {
    assert.strictEqual(verdict({ faceScore: 0, kinds: { ...person, person: 0.7 } }), "review");
    assert.strictEqual(verdict({ faceScore: 0.45 }), "review");
});

test("no face and no person (landscape, object) is refused", () => {
    assert.deepStrictEqual(decidePhoto({ ...clear, faceScore: 0, kinds: { person: 0.05, object: 0.3 } }), { verdict: "rejected", code: "photo-no-face" });
});

test("without the CLIP model, nothing is refused for lack of a face: a human decides", () => {
    assert.strictEqual(verdict({ faceScore: 0, kinds: null }), "review");
});

test("a drawing is refused only above 0.95; in between, a human looks", () => {
    assert.strictEqual(verdict({ kinds: { ...person, drawing: 0.96 } }), "rejected");
    assert.strictEqual(verdict({ kinds: { ...person, drawing: 0.9 } }), "review");
    assert.strictEqual(verdict({ kinds: { ...person, drawing: 0.3 } }), "review"); // was refused from 0.25
    assert.strictEqual(verdict({ kinds: { ...person, drawing: 0.05 } }), "accepted");
});

test("an animal or a statue is refused only without a clear human face", () => {
    assert.strictEqual(verdict({ faceScore: 0.3, kinds: { ...person, person: 0.05, animal: 0.9 } }), "rejected");
    assert.strictEqual(verdict({ kinds: { ...person, animal: 0.9 } }), "review"); // someone holding their dog
    assert.strictEqual(verdict({ faceScore: 0.2, kinds: { ...person, person: 0.05, object: 0.9 } }), "rejected");
});

test("small, soft or dim faces (gym, mirror) go to review, a black photo is refused", () => {
    assert.strictEqual(code({ faceShare: 0.02 }), "photo-face-too-small");
    assert.strictEqual(verdict({ faceShare: 0.02 }), "review");
    assert.strictEqual(verdict({ sharpness: 3 }), "review");
    assert.strictEqual(verdict({ brightness: 15 }), "review");
    assert.strictEqual(verdict({ brightness: 5 }), "rejected");
});

test("every outcome comes with one precise reason and a tip", () => {
    for (const [c, text] of Object.entries(PHOTO_REASONS)) {
        assert.ok(text.includes(":"), `${c} has a reason and a tip`);
    }
    assert.match(reasonFor("photo-face-hidden"), /téléphone/);
    assert.ok(reasonFor("unknown-code"));
});

test("an account is never suspended over automatic refusals alone", () => {
    const after = { now: 2000, deadline: 1000 };
    assert.strictEqual(photosSuspension(["pending", "pending"], after), false);
    assert.strictEqual(photosSuspension(["rejected", "review"], after), false);
    assert.strictEqual(photosSuspension(["rejected", "accepted"], after), false);
});

test("suspended only after a moderator's refusal (or no usable photo at all), past the deadline", () => {
    const after = { now: 2000, deadline: 1000 };
    assert.strictEqual(photosSuspension(["rejected", "rejected"], after), true);
    assert.strictEqual(photosSuspension(["rejected", "not-ours"], after), true);
    assert.strictEqual(photosSuspension([], after), true);
    assert.strictEqual(photosSuspension(["rejected"], { now: 500, deadline: 1000 }), false);
});
