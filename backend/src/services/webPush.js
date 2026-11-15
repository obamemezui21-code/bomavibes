const FRONTEND_URL = process.env.FRONTEND_URL || "https://bomavibes.tech";
const ICON = `${FRONTEND_URL}/icons/icon-192.png`;

// The `webpush` part of an FCM message, for the phone's/computer's own
// notification (shown by Firebase in the service worker, app open or not):
// - the BomaVibes icon, which it otherwise lacks;
// - the page a tap opens (also read by notificationclick in
//   frontend-web/src/firebase-messaging-sw.js);
// - `tag`: a newer notification with the same tag replaces the older one
//   (one per conversation) instead of piling up, and still rings;
// - `urgent` (incoming call): delivered at once, dropped after 45 s when the
//   call is over anyway, and kept on screen until the member acts.
function webpush({ path = "/", link, tag, urgent = false } = {}) {
    const notification = { icon: ICON };
    if (tag) Object.assign(notification, { tag, renotify: true });
    if (urgent) notification.requireInteraction = true;
    return {
        ...(urgent ? { headers: { Urgency: "high", TTL: "45" } } : {}),
        notification,
        fcmOptions: { link: link || `${FRONTEND_URL}${path}` },
    };
}

module.exports = { webpush };
