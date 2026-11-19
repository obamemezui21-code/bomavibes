const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// An in-memory Firestore, just what leaveConversations() uses. Installed in
// place of config/firebaseAdmin before the service is loaded: nothing here
// ever reaches the real database.
const store = new Map(); // path -> data
const DELETE = Symbol("delete");
const UNION = Symbol("arrayUnion");

function applyUpdate(data, patch) {
    const out = structuredClone(data);
    for (const [key, value] of Object.entries(patch)) {
        const keys = key.split(".");
        let target = out;
        for (const k of keys.slice(0, -1)) target = target[k] ??= {};
        const last = keys.at(-1);
        if (value === DELETE) delete target[last];
        else if (value?.[UNION]) target[last] = [...new Set([...(target[last] || []), ...value[UNION]])];
        else target[last] = value;
    }
    return out;
}

function docRef(p) {
    return {
        path: p,
        id: p.split("/").at(-1),
        collection: (name) => collectionRef(`${p}/${name}`),
        update: async (patch) => store.set(p, applyUpdate(store.get(p), patch)),
    };
}

function collectionRef(p, filters = []) {
    return {
        where: (field, op, value) => collectionRef(p, [...filters, [field, op, value]]),
        get: async () => {
            const docs = [...store.entries()]
                .filter(([k]) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes("/"))
                .filter(([, d]) => filters.every(([f, op, v]) => (op === "array-contains" ? (d[f] || []).includes(v) : d[f] === v)))
                .map(([k, d]) => ({ ref: docRef(k), id: k.split("/").at(-1), data: () => structuredClone(d) }));
            return { docs, size: docs.length, empty: !docs.length };
        },
    };
}

const fakeDb = {
    collection: (name) => collectionRef(name),
    batch: () => {
        const ops = [];
        return {
            delete: (ref) => ops.push(() => store.delete(ref.path)),
            update: (ref, patch) => ops.push(() => store.set(ref.path, applyUpdate(store.get(ref.path), patch))),
            commit: async () => ops.forEach((op) => op()),
        };
    },
};
const fakeAdmin = {
    firestore: Object.assign(() => fakeDb, { FieldValue: { delete: () => DELETE, arrayUnion: (...v) => ({ [UNION]: v }), serverTimestamp: () => new Date() } }),
    auth: () => ({ deleteUser: async () => {} }),
};
require.cache[require.resolve("../config/firebaseAdmin")] = { id: "fake", filename: "fake", loaded: true, exports: fakeAdmin };
require.cache[path.resolve(__dirname, "../controllers/verificationController.js")] = { id: "fake-v", filename: "fake-v", loaded: true, exports: { removeVerificationFiles: () => {} } };

const { leaveConversations } = require("./accountDeletionService");

test("deleting an account leaves the conversation to the other member", async () => {
    store.clear();
    store.set("matches/a_b", { users: ["a", "b"], lastMessage: "à demain", typing: { a: 1 } });
    store.set("matches/a_b/messages/1", { senderId: "a", text: "Salut !" });
    store.set("matches/a_b/messages/2", { senderId: "b", text: "Coucou" });
    store.set("matches/a_b/messages/3", { senderId: "a", type: "image", text: "", fileUrl: "https://bomavibes.tech/uploads/chat-attachments/a/image-1.jpg", fileName: "x.jpg" });
    store.set("matches/a_b/messages/4", { senderId: "a", type: "location", text: "", location: { lat: 0.4, lng: 9.4 } });
    store.set("matches/a_b/messages/5", { senderId: "b", type: "voice", text: "", audioUrl: "https://bomavibes.tech/uploads/voice-notes/b/v.webm" });

    await leaveConversations("a");

    const match = store.get("matches/a_b");
    assert.ok(match, "the match stays");
    assert.deepEqual(match.deletedUsers, ["a"]);
    assert.equal(match.typing.a, undefined);
    assert.equal(store.get("matches/a_b/messages/1").text, "Salut !", "their text stays");
    assert.equal(store.get("matches/a_b/messages/2").text, "Coucou");
    const photo = store.get("matches/a_b/messages/3");
    assert.equal(photo.type, "text");
    assert.match(photo.text, /Photo supprimée avec le compte/);
    assert.equal(photo.fileUrl, undefined);
    assert.equal(photo.removedWithAccount, true);
    const place = store.get("matches/a_b/messages/4");
    assert.equal(place.location, undefined);
    assert.match(place.text, /Position supprimée/);
    // The other member's own voice note is theirs: untouched.
    assert.equal(store.get("matches/a_b/messages/5").audioUrl, "https://bomavibes.tech/uploads/voice-notes/b/v.webm");
});

test("a conversation both members have left is deleted", async () => {
    store.clear();
    store.set("matches/a_b", { users: ["a", "b"], deletedUsers: ["b"] });
    store.set("matches/a_b/messages/1", { senderId: "a", text: "Salut" });
    store.set("matches/a_c", { users: ["a", "c"] });
    await leaveConversations("a");
    assert.equal(store.has("matches/a_b"), false);
    assert.equal(store.has("matches/a_b/messages/1"), false);
    assert.deepEqual(store.get("matches/a_c").deletedUsers, ["a"]);
});
