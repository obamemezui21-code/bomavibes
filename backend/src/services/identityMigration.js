const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

// Identity verification (ID document + selfie) is mandatory only for
// accounts created after it was introduced. The first time the server runs
// this code, it records that moment in settings/identity and flags every
// existing member's public profile with legacyMember: true — they keep
// full access without verifying. Only the Admin SDK can write that flag
// (see firestore.rules), so a new member can't grant it to themselves.
const SETTINGS_REF = db.collection("settings").doc("identity");
const BATCH_LIMIT = 400;

async function markLegacyMembers() {
    try {
        const settings = (await SETTINGS_REF.get()).data();
        if (settings?.legacyMarkedAt) return;

        const requiredSince = settings?.requiredSince?.toMillis?.() || Date.now();
        if (!settings?.requiredSince) {
            await SETTINGS_REF.set({ requiredSince: admin.firestore.Timestamp.fromMillis(requiredSince) }, { merge: true });
        }

        // Every account created before that moment.
        const legacyIds = [];
        let pageToken;
        do {
            const page = await admin.auth().listUsers(1000, pageToken);
            for (const u of page.users) {
                if (Date.parse(u.metadata.creationTime) < requiredSince) legacyIds.push(u.uid);
            }
            pageToken = page.pageToken;
        } while (pageToken);

        // Only profiles that exist: an account still mid-signup has none yet.
        let marked = 0;
        for (let i = 0; i < legacyIds.length; i += BATCH_LIMIT) {
            const refs = legacyIds.slice(i, i + BATCH_LIMIT).map((uid) => db.collection("profiles").doc(uid));
            const snaps = await db.getAll(...refs);
            const batch = db.batch();
            for (const snap of snaps) {
                if (!snap.exists) continue;
                batch.update(snap.ref, { legacyMember: true });
                marked++;
            }
            await batch.commit();
        }

        await SETTINGS_REF.set({ legacyMarkedAt: admin.firestore.FieldValue.serverTimestamp(), legacyCount: marked }, { merge: true });
        console.log(`[identité] ${marked} membre(s) existant(s) dispensé(s) de vérification`);
    } catch (err) {
        console.error("[identité] marquage des anciens membres impossible", err);
    }
}

module.exports = { markLegacyMembers };
