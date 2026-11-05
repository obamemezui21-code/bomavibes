// Inviting friends: each member has a personal code, and a friend who joins
// with it and has their identity approved earns the member Ngori. Approval is
// done by a person, so fake accounts earn nothing; a friend pays once, and a
// member is paid for at most REFERRAL.monthlyCap friends a month.
//
// Firestore (Admin SDK only, no client rule opens these):
//   referralCodes/{code}     uid
//   referrals/{friendUid}    referrerUid, code, status (pending | rewarded | capped | void), createdAt, rewardedAt
//   referralProgress/{uid}   code, month, monthCount, verified, earned
//
// The database, clock and account lookup are passed in so the rules that move
// Ngori can be tested without Firebase.
const crypto = require("crypto");

// No 0/O or 1/I/L: the code may be read out or typed.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

function newCode() {
    return Array.from(crypto.randomBytes(CODE_LENGTH), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function isValidCode(code) {
    return typeof code === "string" && CODE_PATTERN.test(code);
}

function monthOf(ms) {
    return new Date(ms).toISOString().slice(0, 7);
}

function createReferralService({ db, increment, accountCreatedAt, config, now = Date.now }) {
    const codes = db.collection("referralCodes");
    const referrals = db.collection("referrals");
    const progress = db.collection("referralProgress");
    const users = db.collection("users");

    // The member's code, made the first time it's needed.
    async function codeOf(uid) {
        const known = (await progress.doc(uid).get()).data()?.code;
        if (known) return known;
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = newCode();
            const made = await db.runTransaction(async (tx) => {
                const mine = (await tx.get(progress.doc(uid))).data();
                if (mine?.code) return mine.code; // two tabs at once
                if ((await tx.get(codes.doc(code))).exists) return null;
                tx.set(codes.doc(code), { uid });
                tx.set(progress.doc(uid), { code }, { merge: true });
                return code;
            });
            if (made) return made;
        }
        throw new Error("code de parrainage introuvable");
    }

    async function summary(uid) {
        const code = await codeOf(uid);
        const [mine, invited] = await Promise.all([progress.doc(uid).get(), referrals.where("referrerUid", "==", uid).get()]);
        const data = mine.data() || {};
        return {
            code,
            reward: config.reward,
            monthlyCap: config.monthlyCap,
            pending: invited.docs.filter((doc) => doc.data().status === "pending").length,
            verified: data.verified || 0,
            earned: data.earned || 0,
        };
    }

    // A new member says who invited them. false: nothing was recorded (unknown
    // code, their own, already invited, or not a new account).
    async function claim(uid, code) {
        if (!isValidCode(code)) return false;
        const createdAt = await accountCreatedAt(uid);
        if (!createdAt || now() - createdAt > config.claimWindowMs) return false;
        return db.runTransaction(async (tx) => {
            const [owner, existing, user] = await Promise.all([tx.get(codes.doc(code)), tx.get(referrals.doc(uid)), tx.get(users.doc(uid))]);
            const referrerUid = owner.data()?.uid;
            if (!referrerUid || referrerUid === uid || existing.exists) return false;
            // Already verified: nothing would ever trigger the reward.
            if (user.data()?.verificationBonusAt) return false;
            tx.set(referrals.doc(uid), { referrerUid, code, status: "pending", createdAt: now() });
            return true;
        });
    }

    // friendUid's identity was just approved. The inviter's uid when they were
    // paid, else null. Safe to call more than once: a friend pays only once.
    async function reward(friendUid) {
        return db.runTransaction(async (tx) => {
            const ref = referrals.doc(friendUid);
            const referral = (await tx.get(ref)).data();
            if (referral?.status !== "pending") return null;

            const { referrerUid } = referral;
            const referrerRef = users.doc(referrerUid);
            const progressRef = progress.doc(referrerUid);
            const [referrer, stats] = await Promise.all([tx.get(referrerRef), tx.get(progressRef)]);
            if (!referrer.exists || referrer.data().deleted) {
                tx.update(ref, { status: "void" });
                return null;
            }

            const month = monthOf(now());
            const current = stats.data() || {};
            const monthCount = current.month === month ? current.monthCount || 0 : 0;
            if (monthCount >= config.monthlyCap) {
                tx.update(ref, { status: "capped" });
                return null;
            }
            tx.update(referrerRef, { ngori: increment(config.reward) });
            tx.set(
                progressRef,
                { month, monthCount: monthCount + 1, verified: (current.verified || 0) + 1, earned: (current.earned || 0) + config.reward },
                { merge: true },
            );
            tx.update(ref, { status: "rewarded", rewardedAt: now() });
            return referrerUid;
        });
    }

    return { claim, codeOf, reward, summary };
}

module.exports = { createReferralService, isValidCode, newCode };
