// Shared by the self-service DELETE /api/account (accountController.js) and
// the admin-initiated deletion in userDirectoryController.js — one place
// that knows what "an account is gone" actually means here, so both paths
// erase exactly the same things the same way.
const fs = require("fs");
const path = require("path");
const admin = require("../config/firebaseAdmin");
const { removeVerificationFiles } = require("../controllers/verificationController");

const db = admin.firestore();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "profile-photos");
const VOICE_ROOT = path.join(__dirname, "..", "..", "uploads", "voice-notes");
const CHAT_FILES_ROOT = path.join(__dirname, "..", "..", "uploads", "chat-attachments");
const { FieldValue } = admin.firestore;
// Firestore caps a single batch at 500 writes — chunk so this stays correct
// for a user with many matches/messages instead of only working by luck.
const BATCH_LIMIT = 500;

async function batchUpdateAll(updates) {
    for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const [ref, data] of updates.slice(i, i + BATCH_LIMIT)) batch.update(ref, data);
        await batch.commit();
    }
}

// What replaces a deleted member's photo, file, voice note or position in
// the conversations they leave behind.
const REMOVED = {
    image: "📷 Photo supprimée avec le compte",
    file: "📎 Fichier supprimé avec le compte",
    voice: "🎤 Message vocal supprimé avec le compte",
    location: "📍 Position supprimée avec le compte",
};

function strippedMessage(data) {
    const type = data.type || "text";
    const label = REMOVED[type] || (data.fileUrl || data.audioUrl ? REMOVED.file : null);
    if (!label) return null;
    return {
        type: "text",
        text: label,
        removedWithAccount: true,
        fileUrl: FieldValue.delete(),
        fileName: FieldValue.delete(),
        fileSize: FieldValue.delete(),
        audioUrl: FieldValue.delete(),
        duration: FieldValue.delete(),
        location: FieldValue.delete(),
    };
}

// Their conversations stay with the people they talked to, as on WhatsApp:
// the match is marked (deletedUsers), nobody can write to it any more
// (firestore.rules), and the app shows it "Compte supprimé", read-only.
// Their text messages stay; their photos, files, voice notes and positions
// go. A conversation both members have left is deleted outright.
async function leaveConversations(uid) {
    const matchesSnap = await db.collection("matches").where("users", "array-contains", uid).get();
    for (const matchDoc of matchesSnap.docs) {
        const match = matchDoc.data();
        const users = match.users || [];
        const gone = new Set([...(match.deletedUsers || []), uid]);
        if (users.every((u) => gone.has(u))) {
            const messages = await matchDoc.ref.collection("messages").get();
            await batchDeleteAll([...messages.docs.map((d) => d.ref), matchDoc.ref]);
            continue;
        }
        const theirs = await matchDoc.ref.collection("messages").where("senderId", "==", uid).get();
        await batchUpdateAll(theirs.docs.map((d) => [d.ref, strippedMessage(d.data())]).filter(([, data]) => data));
        await matchDoc.ref.update({
            deletedUsers: FieldValue.arrayUnion(uid),
            [`typing.${uid}`]: FieldValue.delete(),
            [`activeIn.${uid}`]: FieldValue.delete(),
        });
    }
}

async function batchDeleteAll(refs) {
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
            batch.delete(ref);
        }
        await batch.commit();
    }
}

// Leaves their conversations to the other members (leaveConversations
// above), erases swipes/profile/uploaded files and the Firebase Auth account, then replaces users/{uid} with a bare
// {deleted, deletedAt, email} tombstone (overwritten, not merged — every
// other field is dropped) so "Utilisateurs supprimés" has something to
// list. The Auth account is still fully deleted, so the email is free to
// sign up again immediately.
async function eraseAccount(uid) {
    await leaveConversations(uid);

    // Their conversation with themselves (notes, photos… kept for later).
    const selfChatRef = db.collection("selfChats").doc(uid);
    const selfMessages = await selfChatRef.collection("messages").get();
    await batchDeleteAll([...selfMessages.docs.map((doc) => doc.ref), selfChatRef]);

    const [asSwiper, asTarget] = await Promise.all([
        db.collection("swipes").where("swiperId", "==", uid).get(),
        db.collection("swipes").where("targetId", "==", uid).get(),
    ]);
    await batchDeleteAll([...asSwiper.docs, ...asTarget.docs].map((doc) => doc.ref));

    // Private "We Met" answers given by or about this member.
    const [weMetMine, weMetAbout] = await Promise.all([
        db.collection("weMet").where("uid", "==", uid).get(),
        db.collection("weMet").where("otherId", "==", uid).get(),
    ]);
    await batchDeleteAll([...weMetMine.docs, ...weMetAbout.docs].map((doc) => doc.ref));
    await db.collection("crushTime").doc(uid).delete().catch(() => {});
    await db.collection("commandoProgress").doc(uid).delete().catch(() => {});
    await db.collection("pantherProgress").doc(uid).delete().catch(() => {});
    await db.collection("escadrilleProgress").doc(uid).delete().catch(() => {});
    await db.collection("perlesProgress").doc(uid).delete().catch(() => {});
    await db.collection("flecheProgress").doc(uid).delete().catch(() => {});
    await db.collection("chantierProgress").doc(uid).delete().catch(() => {});
    // Their CV PNPE (identity, phone, e-mail, career).
    await db.collection("cvs").doc(uid).delete().catch(() => {});
    // Their invitations, both ways, and their code.
    const referralCode = (await db.collection("referralProgress").doc(uid).get()).data()?.code;
    if (referralCode) await db.collection("referralCodes").doc(referralCode).delete().catch(() => {});
    await db.collection("referralProgress").doc(uid).delete().catch(() => {});
    await db.collection("referrals").doc(uid).delete().catch(() => {});
    const invited = await db.collection("referrals").where("referrerUid", "==", uid).get();
    await batchDeleteAll(invited.docs.map((doc) => doc.ref));
    await db.collection("locations").doc(uid).delete().catch(() => {});

    // Lives they hosted: closed and removed (comments included).
    const livesSnap = await db.collection("lives").where("hostId", "==", uid).get();
    for (const liveDoc of livesSnap.docs) {
        const comments = await liveDoc.ref.collection("comments").get();
        await batchDeleteAll([...comments.docs.map((d) => d.ref), liveDoc.ref]);
    }

    await db.collection("profiles").doc(uid).delete().catch(() => {});

    const userSnap = await db.collection("users").doc(uid).get();
    const email = userSnap.data()?.email ?? null;
    await db.collection("users").doc(uid).set({
        deleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        email,
    });

    fs.rmSync(path.join(UPLOAD_ROOT, uid), { recursive: true, force: true });
    // Voice notes and the profile voice prompt, and the photos and files they
    // sent in chats (their messages now say so: leaveConversations above).
    fs.rmSync(path.join(VOICE_ROOT, uid), { recursive: true, force: true });
    fs.rmSync(path.join(CHAT_FILES_ROOT, uid), { recursive: true, force: true });
    // Identity document and selfie, if a verification was still pending.
    removeVerificationFiles(uid);
    await db.collection("verificationRequests").doc(uid).delete().catch(() => {});

    await admin.auth().deleteUser(uid);
}

module.exports = { eraseAccount, leaveConversations, strippedMessage };
