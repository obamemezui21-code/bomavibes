const crypto = require("crypto");

// Monerails — Airtel Money / Moov Money (Gabon) collections.
// Reference: https://docs.monerails.com (API 2026-10-30, OpenAPI at
// https://docs.monerails.com/openapi.json).
//
// Credentials come from the backend .env only (never the frontend, never git):
//   MONERAILS_API_KEY         mr_test_… (test mode) or mr_live_… (real money)
//   MONERAILS_WEBHOOK_SECRET  whsec_… of the webhook endpoint
//                             https://bomavibes.tech/api/payments/monerails/webhook
//
// Test mode moves no real money: Monerails' test numbers always "succeed".
// paymentController.js therefore lets only admins pay with a test key.

const API_URL = "https://api.monerails.com";
const REQUEST_TIMEOUT_MS = 30 * 1000;
const OPERATORS_TTL_MS = 6 * 60 * 60 * 1000;
const SIGNATURE_TOLERANCE_S = 300;

const apiKey = () => (process.env.MONERAILS_API_KEY || "").trim();

function isConfigured() {
    return /^mr_(test|live)_/.test(apiKey());
}

function isTestMode() {
    return apiKey().startsWith("mr_test_");
}

class MonerailsError extends Error {
    constructor(message, { httpStatus, code, body } = {}) {
        super(message);
        this.httpStatus = httpStatus;
        this.code = code;
        this.body = body;
    }
}

async function call(method, path, body, { idempotencyKey } = {}) {
    const headers = { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "error",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const err = data?.error || {};
        throw new MonerailsError(err.message || `Monerails HTTP ${res.status}`, { httpStatus: res.status, code: err.code, body: data });
    }
    return data;
}

// Gabonese mobile numbers: 9 digits starting with 0 once +241 is dropped.
// Airtel: 074/076/077 — Moov: 060/062/063/065/066.
const OPERATOR_PREFIXES = {
    airtel: ["074", "076", "077"],
    moov: ["060", "062", "063", "065", "066"],
};

// Monerails' Gabon test numbers (docs: Testing): …1 succeeds, …2 stays
// pending, …3 fails. Accepted in test mode only.
const TEST_NUMBERS = /^2410000000[123]$/;

/**
 * "+241 74 12 34 56", "24174123456", "074123456" → { phone, operator } or null.
 * phone is sent as is, with country GA: Monerails accepts the local format
 * when the country is known.
 */
function parsePhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    // Typed after the "+241" the form shows, or in full.
    const full = digits.startsWith("241") ? digits : `241${digits}`;
    if (isTestMode() && TEST_NUMBERS.test(full)) return { phone: full, operator: "airtel", test: true };
    let local = digits.startsWith("241") ? digits.slice(3) : digits;
    if (local.length === 8) local = `0${local}`;
    if (!/^0\d{8}$/.test(local)) return null;
    const operator = Object.keys(OPERATOR_PREFIXES).find((op) => OPERATOR_PREFIXES[op].includes(local.slice(0, 3)));
    return operator ? { phone: local, operator } : null;
}

// The operator codes open for Gabon, read from Monerails (GET /v1/operators)
// rather than guessed, and kept a few hours.
let operatorsCache = { at: 0, list: null };

async function gabonOperators() {
    if (operatorsCache.list && Date.now() - operatorsCache.at < OPERATORS_TTL_MS) return operatorsCache.list;
    const res = await call("GET", "/v1/operators?currency=XAF&country=GA");
    const list = Array.isArray(res?.data) ? res.data : [];
    operatorsCache = { at: Date.now(), list };
    return list;
}

async function operatorCode(operator) {
    const list = await gabonOperators();
    const match = list.find((o) => new RegExp(operator, "i").test(`${o.code} ${o.name}`));
    if (!match) throw new MonerailsError(`Opérateur ${operator} non disponible au Gabon chez Monerails`, { code: "operator_unavailable" });
    return match.code;
}

/**
 * Sends the payment request to the customer's phone. The answer (201, or
 * 202 while the operator hasn't confirmed receipt) is never the outcome:
 * that comes from getCollection / the webhook.
 */
async function createCollection({ reference, amount, phone, operator, name, description, metadata }) {
    return call(
        "POST",
        "/v1/collections",
        {
            amount,
            currency: "XAF",
            country: "GA",
            phone,
            operator: await operatorCode(operator),
            customer: { name: String(name || "Membre BomaVibes").slice(0, 80).padEnd(2, ".") },
            description: String(description || "").slice(0, 500),
            client_reference: reference,
            metadata,
        },
        // A retry with the same reference never asks for a second payment.
        { idempotencyKey: reference },
    );
}

function getCollection(id) {
    return call("GET", `/v1/collections/${encodeURIComponent(id)}`);
}

// Our own lookup when we never got the collection's id (the request timed
// out after Monerails had created it).
async function findByReference(reference) {
    const res = await call("GET", `/v1/collections?client_reference=${encodeURIComponent(reference)}&limit=1`);
    return Array.isArray(res?.data) ? res.data.find((c) => c.client_reference === reference) || null : null;
}

// pending, requires_otp, processing → pending; succeeded; failed; expired.
function classify(collection) {
    const status = collection?.status;
    if (status === "succeeded") return "succeeded";
    if (status === "failed") return "failed";
    if (status === "expired") return "expired";
    return "pending";
}

// What the customer must do, from next_action (message and USSD fallback).
function instructionOf(collection) {
    const action = collection?.next_action;
    if (!action) return null;
    return [action.message, action.ussd_code ? `Si rien ne s’affiche, composez ${action.ussd_code}.` : null].filter(Boolean).join(" ") || null;
}

function failureMessage(collection) {
    if (collection?.status === "expired") return "La demande de paiement a expiré : elle n’a pas été validée à temps. Réessayez.";
    const reason = String(collection?.failure_message || "");
    if (/insuffi|balance|solde/i.test(reason)) return "Solde insuffisant sur votre compte Mobile Money.";
    if (/pin|code/i.test(reason)) return "Code secret incorrect.";
    if (/declin|cancel|annul|refus|reject/i.test(reason)) return "Paiement refusé ou annulé.";
    return "Le paiement n’a pas abouti.";
}

/**
 * Monerail-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${rawBody}`>
 * (two v1 while a secret rotation overlaps). Refused beyond 5 minutes.
 */
function verifySignature(rawBody, header, secret = process.env.MONERAILS_WEBHOOK_SECRET, now = Math.floor(Date.now() / 1000)) {
    if (!secret || !Buffer.isBuffer(rawBody)) return false;
    let ts = "";
    const signatures = [];
    for (const item of String(header || "").split(",")) {
        const i = item.indexOf("=");
        if (i <= 0) continue;
        const key = item.slice(0, i).trim();
        const value = item.slice(i + 1).trim();
        if (key === "t") ts = value;
        if (key === "v1") signatures.push(value);
    }
    if (!/^\d+$/.test(ts) || !signatures.length || Math.abs(now - Number(ts)) > SIGNATURE_TOLERANCE_S) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${ts}.`).update(rawBody).digest();
    return signatures.some((sig) => {
        const received = Buffer.from(sig, "hex");
        return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
}

module.exports = {
    isConfigured,
    isTestMode,
    parsePhone,
    createCollection,
    getCollection,
    findByReference,
    classify,
    instructionOf,
    failureMessage,
    verifySignature,
    MonerailsError,
    _resetOperatorsCache: () => (operatorsCache = { at: 0, list: null }),
};
