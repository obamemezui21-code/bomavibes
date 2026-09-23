// Free ticket reservations for published events. No payment gateway exists
// in this app — price on an event is display-only (see contentService.js) —
// so a "ticket" here is a reservation/RSVP confirmation, not a payment
// receipt. One ticket per user per event: the ticket doc id is
// deterministic (`${eventId}_${uid}`), the same pattern this codebase
// already uses for blocks/swipes, which doubles as the duplicate-
// reservation guard.
const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

function fail(status, message) {
    return Object.assign(new Error(message), { status });
}

function generateTicketCode() {
    return crypto.randomBytes(5).toString("hex").toUpperCase();
}

// The reservation form's fields — kept simple (name/email/phone), attached
// to the ticket so an organizer checking attendees at the door (or the
// downloaded PDF) shows who's actually coming, not just the account uid.
function readAttendeeInfo(body) {
    const attendeeName = typeof body.attendeeName === "string" ? body.attendeeName.trim() : "";
    if (!attendeeName) throw fail(400, "Le nom est requis");
    if (attendeeName.length > 100) throw fail(400, "Nom trop long");

    const attendeeEmail = typeof body.attendeeEmail === "string" ? body.attendeeEmail.trim() : "";
    if (attendeeEmail.length > 200) throw fail(400, "Email trop long");

    const attendeePhone = typeof body.attendeePhone === "string" ? body.attendeePhone.trim() : "";
    if (attendeePhone.length > 40) throw fail(400, "Téléphone trop long");

    return { attendeeName, attendeeEmail: attendeeEmail || null, attendeePhone: attendeePhone || null };
}

async function reserveTicket(req, res) {
    const { eventId } = req.params;
    const uid = req.firebaseUser.uid;
    const eventRef = db.collection("events").doc(eventId);
    const ticketRef = db.collection("tickets").doc(`${eventId}_${uid}`);

    try {
        const attendee = readAttendeeInfo(req.body || {});

        const code = await db.runTransaction(async (tx) => {
            const [eventSnap, ticketSnap] = await Promise.all([tx.get(eventRef), tx.get(ticketRef)]);

            if (!eventSnap.exists || eventSnap.data().status !== "published") {
                throw fail(404, "Événement introuvable");
            }
            if (ticketSnap.exists) {
                throw fail(409, "Vous avez déjà réservé une place pour cet événement");
            }

            const { capacity = 0, ticketsReserved = 0 } = eventSnap.data();
            if (capacity > 0 && ticketsReserved >= capacity) {
                throw fail(409, "Cet événement est complet");
            }

            const ticketCode = generateTicketCode();
            tx.set(ticketRef, {
                eventId,
                userId: uid,
                code: ticketCode,
                status: "confirmed",
                ...attendee,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.update(eventRef, { ticketsReserved: admin.firestore.FieldValue.increment(1) });
            return ticketCode;
        });

        res.status(201).json({ message: "Billet réservé", code });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: "Impossible de réserver ce billet" });
    }
}

async function cancelTicket(req, res) {
    const { eventId } = req.params;
    const uid = req.firebaseUser.uid;
    const eventRef = db.collection("events").doc(eventId);
    const ticketRef = db.collection("tickets").doc(`${eventId}_${uid}`);

    try {
        await db.runTransaction(async (tx) => {
            const [ticketSnap, eventSnap] = await Promise.all([tx.get(ticketRef), tx.get(eventRef)]);
            if (!ticketSnap.exists || ticketSnap.data().userId !== uid) {
                throw fail(404, "Réservation introuvable");
            }

            tx.delete(ticketRef);
            // The event may have since been deleted by an admin — only
            // touch the counter if it still exists, or update() throws.
            if (eventSnap.exists) {
                tx.update(eventRef, { ticketsReserved: admin.firestore.FieldValue.increment(-1) });
            }
        });

        res.json({ message: "Réservation annulée" });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: "Impossible d'annuler cette réservation" });
    }
}

async function listMyTickets(req, res) {
    const uid = req.firebaseUser.uid;

    try {
        const snap = await db.collection("tickets").where("userId", "==", uid).orderBy("createdAt", "desc").get();
        const rawTickets = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

        const eventIds = [...new Set(rawTickets.map((t) => t.eventId))];
        const eventDocs = eventIds.length
            ? await db.getAll(...eventIds.map((id) => db.collection("events").doc(id)))
            : [];
        const eventsById = new Map(eventDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

        const tickets = rawTickets.map((t) => {
            const event = eventsById.get(t.eventId);
            return {
                id: t.id,
                code: t.code,
                status: t.status,
                attendeeName: t.attendeeName ?? null,
                attendeeEmail: t.attendeeEmail ?? null,
                attendeePhone: t.attendeePhone ?? null,
                createdAt: t.createdAt?.toDate?.().toISOString() ?? null,
                event: event
                    ? {
                          id: t.eventId,
                          title: event.title,
                          date: event.date,
                          location: event.location ?? null,
                          image: event.image ?? null,
                      }
                    : null,
            };
        });

        res.json({ tickets });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
}

module.exports = { reserveTicket, cancelTicket, listMyTickets };
