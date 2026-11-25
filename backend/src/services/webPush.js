const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const ICON = `${FRONTEND_URL}/icons/icon-192.png`;

// The `webpush` part of an FCM message, for the phone's/computer's own
// notification (shown by Firebase in the service worker, app open or not):
// - the BomaVibes icon, which it otherwise lacks;
// - the page a tap opens (also read by notificationclick in
//   frontend-web/src/firebase-messaging-sw.js);
// - `tag`: a newer notification with the same tag replaces the older one
//   (the same message or call again) instead of piling up, and still rings;
// - `prompt` (chat message): delivered at once to a sleeping phone, which
//   otherwise keeps it until it wakes up — and its icon's counter with it;
// - `urgent` (incoming call): delivered at once, dropped after 45 s when the
//   call is over anyway, and kept on screen until the member acts.
function webpush({ path = "/", link, tag, prompt = false, urgent = false } = {}) {
    const notification = { icon: ICON };
    if (tag) Object.assign(notification, { tag, renotify: true });
    if (urgent) notification.requireInteraction = true;
    return {
        ...(urgent ? { headers: { Urgency: "high", TTL: "45" } } : prompt ? { headers: { Urgency: "high" } } : {}),
        notification,
        fcmOptions: { link: link || `${FRONTEND_URL}${path}` },
    };
}

// The tokens of devices that are gone for good (app removed, permission taken
// back). Any other failure (FCM unavailable, quota, network) says nothing about
// the device: dropping it there silenced a working phone.
const GONE = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];

function deadTokens(response, tokens) {
    return tokens.filter((_, i) => GONE.includes(response.responses[i]?.error?.code));
}

module.exports = { webpush, deadTokens };
