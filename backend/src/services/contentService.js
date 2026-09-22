// One generic CRUD service behind Pages/Articles/FAQ/Bannières — they all
// share the same shape (title-ish fields + a draft/published/archived
// status), so this is the single place that knows how to validate, slug,
// list, and persist any of them. contentController.js only adds the HTTP
// plumbing and audit logging on top.
const admin = require("../config/firebaseAdmin");

const db = admin.firestore();

const STATUSES = ["draft", "published", "archived"];

// Collections stay small by nature (an app has tens of pages/articles/FAQs,
// never thousands like users/posts) — a single capped fetch, filtered and
// sorted in memory, is simpler than cursor pagination and avoids needing a
// composite index per type (same trade-off adminController.listReports
// already makes for the reports collection).
const LIST_CAP = 300;

const CONTENT_TYPES = {
    pages: {
        collection: "pages",
        sortField: "createdAt",
        sortDir: "desc",
        hasSlug: true,
        fields: {
            title: { type: "string", required: true, maxLen: 200 },
            summary: { type: "string", maxLen: 500 },
            content: { type: "string", maxLen: 50000 },
            image: { type: "string", maxLen: 500 },
        },
    },
    articles: {
        collection: "articles",
        sortField: "createdAt",
        sortDir: "desc",
        hasSlug: true,
        fields: {
            title: { type: "string", required: true, maxLen: 200 },
            summary: { type: "string", maxLen: 500 },
            content: { type: "string", maxLen: 50000 },
            image: { type: "string", maxLen: 500 },
            category: { type: "string", maxLen: 100 },
            tags: { type: "array", maxLen: 20 },
            seoTitle: { type: "string", maxLen: 70 },
            seoDescription: { type: "string", maxLen: 160 },
        },
    },
    faqs: {
        collection: "faqs",
        sortField: "order",
        sortDir: "asc",
        hasSlug: false,
        fields: {
            question: { type: "string", required: true, maxLen: 300 },
            answer: { type: "string", required: true, maxLen: 5000 },
            category: { type: "string", maxLen: 100 },
            order: { type: "number", default: 0 },
        },
    },
    banners: {
        collection: "banners",
        sortField: "createdAt",
        sortDir: "desc",
        hasSlug: false,
        fields: {
            title: { type: "string", required: true, maxLen: 200 },
            description: { type: "string", maxLen: 500 },
            image: { type: "string", maxLen: 500 },
            buttonLabel: { type: "string", maxLen: 60 },
            buttonUrl: { type: "string", maxLen: 500 },
            position: { type: "string", maxLen: 60 },
            startDate: { type: "string", maxLen: 40 },
            endDate: { type: "string", maxLen: 40 },
        },
    },
    events: {
        collection: "events",
        sortField: "date",
        sortDir: "asc",
        hasSlug: false,
        fields: {
            title: { type: "string", required: true, maxLen: 200 },
            description: { type: "string", maxLen: 2000 },
            category: { type: "string", maxLen: 50 },
            date: { type: "string", required: true, maxLen: 20 },
            location: { type: "string", maxLen: 200 },
            image: { type: "string", maxLen: 500 },
            organizer: { type: "string", maxLen: 100 },
            // Informational only — no payment gateway is integrated, so this
            // is displayed text ("Gratuit", "2 000 FCFA"...), never charged.
            price: { type: "string", maxLen: 60 },
            // 0 = unlimited. ticketsReserved (not declared here, so a plain
            // admin edit here can never touch it) is maintained separately by
            // eventTicketController.js's transaction, incremented/decremented
            // alongside each reservation/cancellation.
            capacity: { type: "number", default: 0 },
        },
    },
};

function badRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function getTypeConfig(type) {
    const config = CONTENT_TYPES[type];
    if (!config) throw badRequest("Type de contenu invalide");
    return config;
}

function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-+|-+$)/g, "")
        .slice(0, 200);
}

// Validates + narrows an incoming body down to exactly the fields this
// content type declares (plus status/slug where relevant) — anything else
// the client sent is silently dropped, so there's no way to smuggle
// arbitrary fields (authorId, timestamps...) through the API.
function validateFields(config, body, { partial = false } = {}) {
    const data = {};

    for (const [key, spec] of Object.entries(config.fields)) {
        const present = key in body;
        if (!present) {
            if (spec.required && !partial) throw badRequest(`Champ requis manquant : ${key}`);
            if (!partial && spec.default !== undefined) data[key] = spec.default;
            continue;
        }

        const value = body[key];
        if (spec.type === "string") {
            if (value != null && typeof value !== "string") throw badRequest(`Champ invalide : ${key}`);
            if (spec.required && !partial && !value) throw badRequest(`Champ requis manquant : ${key}`);
            if (value && spec.maxLen && value.length > spec.maxLen) throw badRequest(`Champ trop long : ${key}`);
            data[key] = value || null;
        } else if (spec.type === "number") {
            if (value != null && typeof value !== "number") throw badRequest(`Champ invalide : ${key}`);
            data[key] = value ?? 0;
        } else if (spec.type === "array") {
            if (value != null && !Array.isArray(value)) throw badRequest(`Champ invalide : ${key}`);
            if (value && spec.maxLen && value.length > spec.maxLen) throw badRequest(`Trop d'éléments : ${key}`);
            data[key] = (value || []).filter((v) => typeof v === "string").slice(0, spec.maxLen || 50);
        }
    }

    if ("status" in body) {
        if (!STATUSES.includes(body.status)) throw badRequest("Statut invalide");
        data.status = body.status;
    } else if (!partial) {
        data.status = "draft";
    }

    if (config.hasSlug) {
        const rawSlug = body.slug || (data.title ? slugify(data.title) : null);
        if (rawSlug) data.slug = slugify(rawSlug);
        else if (!partial) throw badRequest("Slug manquant");
    }

    return data;
}

async function ensureSlugUnique(config, slug, excludeId) {
    if (!slug) return;
    const snap = await db.collection(config.collection).where("slug", "==", slug).limit(2).get();
    if (snap.docs.some((docSnap) => docSnap.id !== excludeId)) {
        throw badRequest("Ce slug est déjà utilisé");
    }
}

function serialize(docSnap) {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
        publishedAt: data.publishedAt?.toDate?.().toISOString() ?? null,
    };
}

async function listContent(type, { status } = {}) {
    const config = getTypeConfig(type);
    const snap = await db
        .collection(config.collection)
        .orderBy(config.sortField, config.sortDir)
        .limit(LIST_CAP)
        .get();

    const items = snap.docs
        .filter((docSnap) => !status || status === "all" || (docSnap.data().status || "draft") === status)
        .map(serialize);

    return items;
}

async function getContent(type, id) {
    const config = getTypeConfig(type);
    const docSnap = await db.collection(config.collection).doc(id).get();
    if (!docSnap.exists) throw Object.assign(new Error("Contenu introuvable"), { status: 404 });
    return serialize(docSnap);
}

async function createContent(type, body, author) {
    const config = getTypeConfig(type);
    const data = validateFields(config, body);
    if (config.hasSlug) await ensureSlugUnique(config, data.slug, null);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const payload = {
        ...data,
        authorId: author.uid,
        authorEmail: author.email || null,
        createdAt: now,
        updatedAt: now,
        publishedAt: data.status === "published" ? now : null,
    };

    const ref = await db.collection(config.collection).add(payload);
    return getContent(type, ref.id);
}

async function updateContent(type, id, body) {
    const config = getTypeConfig(type);
    const ref = db.collection(config.collection).doc(id);
    const existing = await ref.get();
    if (!existing.exists) throw Object.assign(new Error("Contenu introuvable"), { status: 404 });

    const data = validateFields(config, body, { partial: true });
    if (config.hasSlug && data.slug) await ensureSlugUnique(config, data.slug, id);

    const wasPublished = !!existing.data().publishedAt;
    const payload = { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (data.status === "published" && !wasPublished) {
        payload.publishedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.update(payload);
    return getContent(type, id);
}

async function deleteContent(type, id) {
    const config = getTypeConfig(type);
    const ref = db.collection(config.collection).doc(id);
    const existing = await ref.get();
    if (!existing.exists) throw Object.assign(new Error("Contenu introuvable"), { status: 404 });
    await ref.delete();
}

module.exports = { CONTENT_TYPES, STATUSES, listContent, getContent, createContent, updateContent, deleteContent };
