// SingPay (Gabon) — Airtel Money / Moov Money via USSD Push.
// Reference: https://client.singpay.ga/doc/reference/index.html
//
// Credentials come from the backend .env only (never the frontend):
//   SINGPAY_CLIENT_ID, SINGPAY_CLIENT_SECRET, SINGPAY_WALLET_ID
//   SINGPAY_DISBURSEMENT  (optional — disbursement id from SingPay Workspace)
//   SINGPAY_GATEWAY_URL   (optional — defaults to the production gateway)

const GATEWAY_URL = (process.env.SINGPAY_GATEWAY_URL || "https://gateway.singpay.ga/v1").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 30 * 1000;

function isConfigured() {
    return !!(process.env.SINGPAY_CLIENT_ID && process.env.SINGPAY_CLIENT_SECRET && process.env.SINGPAY_WALLET_ID);
}

// Gabonese mobile numbers: 9 digits starting with 0 once the +241 prefix is
// dropped. Airtel: 074/076/077 — Moov: 060/062/063/065/066.
const OPERATOR_PREFIXES = {
    airtel: ["074", "076", "077"],
    moov: ["060", "062", "063", "065", "066"],
};

// "+241 74 12 34 56", "24174123456", "074123456" → "074123456" (or null).
function normalizeMsisdn(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("241")) digits = digits.slice(3);
    if (digits.length === 8) digits = `0${digits}`;
    return /^0\d{8}$/.test(digits) ? digits : null;
}

function operatorFor(msisdn) {
    const prefix = msisdn.slice(0, 3);
    return Object.keys(OPERATOR_PREFIXES).find((op) => OPERATOR_PREFIXES[op].includes(prefix)) || null;
}

async function call(method, path, body) {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "x-client-id": process.env.SINGPAY_CLIENT_ID,
            "x-client-secret": process.env.SINGPAY_CLIENT_SECRET,
            "x-wallet": process.env.SINGPAY_WALLET_ID,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const err = new Error(data?.status?.message || data?.message || `SingPay HTTP ${res.status}`);
        err.singpay = data;
        err.httpStatus = res.status;
        throw err;
    }
    return data;
}

// Sends the USSD Push: the customer gets a prompt on their phone to confirm
// with their PIN. Resolves as soon as SingPay has accepted the request — the
// payment itself is only final once getTransactionStatus says so.
async function requestPayment({ operator, msisdn, amount, reference }) {
    const path = operator === "airtel" ? "/74/paiement" : "/62/paiement";
    const body = {
        amount,
        reference,
        client_msisdn: msisdn,
        portefeuille: process.env.SINGPAY_WALLET_ID,
        isTransfer: false,
    };
    if (process.env.SINGPAY_DISBURSEMENT) body.disbursement = process.env.SINGPAY_DISBURSEMENT;
    return call("POST", path, body);
}

function getTransactionStatus(transactionId) {
    return call("GET", `/transaction/api/status/${encodeURIComponent(transactionId)}`);
}

function findByReference(reference) {
    return call("GET", `/transaction/api/search/by-reference/${encodeURIComponent(reference)}`);
}

// SingPay answers { transaction, status } from the payment/status endpoints
// and a bare transaction from the search ones.
function transactionOf(payload) {
    return payload?.transaction || payload || null;
}

// The reference doc doesn't list the possible status/result values, so this
// matches on wording rather than exact strings. Anything unrecognised stays
// "pending" — a payment is never granted on a guess. Raw payloads are logged
// by the caller so the patterns can be tightened against real responses.
const FAILED = /(fail|echec|échec|cancel|annul|refus|reject|insuffi|expir|invalid|erreur|error|timeout)/i;
const SUCCEEDED = /(succe|réussi|reussi|complet|approved|termin)/i;

function classify(payload) {
    const tx = transactionOf(payload);
    if (!tx) return "pending";
    const words = [tx.status, tx.result].filter(Boolean).join(" ");
    if (FAILED.test(words)) return "failed";
    if (SUCCEEDED.test(words)) return "succeeded";
    return "pending";
}

module.exports = {
    isConfigured,
    normalizeMsisdn,
    operatorFor,
    requestPayment,
    getTransactionStatus,
    findByReference,
    transactionOf,
    classify,
};
