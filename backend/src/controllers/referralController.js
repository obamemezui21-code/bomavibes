const admin = require("../config/firebaseAdmin");
const { REFERRAL } = require("../config/ngori");
const { createReferralService } = require("../services/referralService");

// "Invite tes amis": see referralService.js for the rules. The account's age
// comes from Firebase Auth, which a member can't change, unlike their own
// users/{uid} document.
const referrals = createReferralService({
    db: admin.firestore(),
    config: REFERRAL,
    increment: (n) => admin.firestore.FieldValue.increment(n),
    accountCreatedAt: async (uid) => {
        const created = (await admin.auth().getUser(uid)).metadata.creationTime;
        return created ? Date.parse(created) : null;
    },
});

// GET /api/referrals/me → { code, reward, monthlyCap, pending, verified, earned }
async function getMyReferral(req, res) {
    try {
        res.json(await referrals.summary(req.firebaseUser.uid));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible de charger tes invitations" });
    }
}

// POST /api/referrals/claim { code } → { recorded }
async function claimReferral(req, res) {
    try {
        res.json({ recorded: await referrals.claim(req.firebaseUser.uid, req.body?.code) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Impossible d'enregistrer l'invitation" });
    }
}

// After an identity is approved. The inviter's uid when they were paid. Never
// throws: a problem here mustn't undo or block the approval.
async function rewardReferrer(friendUid) {
    try {
        return await referrals.reward(friendUid);
    } catch (err) {
        console.error(`[parrainage] récompense impossible pour ${friendUid}`, err);
        return null;
    }
}

module.exports = { claimReferral, getMyReferral, rewardReferrer };
