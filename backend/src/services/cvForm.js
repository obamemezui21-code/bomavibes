const { periodKey, toMillis } = require("../config/plans");
const { isConfigured } = require("./cvWriter");

// CV PNPE — what a member may send, and what the page is told (quota,
// status). No Firestore here: see controllers/cvController.js.

const PER_MEMBER_PER_DAY = Number(process.env.CV_DAILY_LIMIT) || 3;
const ALL_MEMBERS_PER_DAY = Number(process.env.CV_MAX_PER_DAY) || 300;
// A write that hasn't ended by now died with the server: shown as failed.
const STALE_MS = 5 * 60 * 1000;

const LIMITS = { short: 120, line: 300, text: 2500, offer: 5000, free: 10000, list: 15 };

// ---- What a member may send -----------------------------------------------

const str = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const list = (value, mapItem, keep) => (Array.isArray(value) ? value.slice(0, LIMITS.list).map(mapItem).filter(keep) : []);
const anyFilled = (item) => Object.values(item).some((v) => (Array.isArray(v) ? v.length : v));

function cleanForm(form) {
    const f = form && typeof form === "object" ? form : {};
    const id = f.identite && typeof f.identite === "object" ? f.identite : {};
    return {
        identite: {
            nom: str(id.nom, LIMITS.short),
            telephones: str(id.telephones, LIMITS.short),
            email: str(id.email, LIMITS.short),
            numeroPnpe: str(id.numeroPnpe, 40),
            permis: str(id.permis, 60),
            ville: str(id.ville, 80),
            quartier: str(id.quartier, 80),
        },
        posteRecherche: str(f.posteRecherche, LIMITS.line),
        offre: str(f.offre, LIMITS.offer),
        experiences: list(
            f.experiences,
            (e) => ({
                debut: str(e?.debut, 40),
                fin: str(e?.fin, 40),
                enCours: e?.enCours === true,
                entreprise: str(e?.entreprise, LIMITS.line),
                ville: str(e?.ville, 80),
                poste: str(e?.poste, LIMITS.line),
                description: str(e?.description, LIMITS.text),
            }),
            (e) => e.entreprise || e.poste || e.description,
        ),
        formations: list(
            f.formations,
            (x) => ({ annee: str(x?.annee, 40), intitule: str(x?.intitule, LIMITS.line), etablissement: str(x?.etablissement, LIMITS.line) }),
            (x) => x.intitule || x.etablissement,
        ),
        competences: str(f.competences, LIMITS.text),
        langues: list(f.langues, (l) => ({ langue: str(l?.langue, 60), niveau: str(l?.niveau, 40) }), (l) => l.langue),
        texteLibre: str(f.texteLibre, LIMITS.free),
    };
}

// The written CV as edited by the member (same shape as the model's).
function cleanCv(cv) {
    if (!cv || typeof cv !== "object") return null;
    const lines = (value) => list(value, (s) => str(s, LIMITS.line), Boolean);
    const training = (x) => ({ annee: str(x?.annee, 40), intitule: str(x?.intitule, LIMITS.line), etablissement: str(x?.etablissement, LIMITS.line) });
    return {
        titrePoste: str(cv.titrePoste, LIMITS.line),
        experiences: list(
            cv.experiences,
            (e) => ({
                debut: str(e?.debut, 40),
                fin: str(e?.fin, 40),
                entreprise: str(e?.entreprise, LIMITS.line),
                lieu: str(e?.lieu, 80),
                poste: str(e?.poste, LIMITS.line),
                taches: lines(e?.taches),
            }),
            anyFilled,
        ),
        formations: list(cv.formations, training, anyFilled),
        certifications: list(cv.certifications, training, anyFilled),
        competencesTechniques: lines(cv.competencesTechniques),
        savoirFaire: lines(cv.savoirFaire),
        langues: list(cv.langues, (l) => ({ langue: str(l?.langue, 60), niveau: str(l?.niveau, 40) }), (l) => l.langue),
        conseils: lines(cv.conseils).slice(0, 5),
    };
}

function hasContent(form) {
    return form.experiences.length > 0 || form.formations.length > 0 || form.texteLibre.length > 20 || form.competences.length > 0;
}

// ---- Reading -------------------------------------------------------------------

function view(data, now = Date.now()) {
    const today = periodKey("day", now);
    const used = data?.day === today ? data.count || 0 : 0;
    let { status = "idle", error = null } = data || {};
    if (status === "pending" && now - (toMillis(data.startedAt) || 0) > STALE_MS) {
        status = "error";
        error = "La rédaction a été interrompue. Réessayez.";
    }
    return {
        form: data?.form || null,
        cv: data?.cv || null,
        status,
        error,
        remainingToday: Math.max(0, PER_MEMBER_PER_DAY - used),
        dailyLimit: PER_MEMBER_PER_DAY,
        available: isConfigured(),
    };
}

module.exports = { cleanForm, cleanCv, hasContent, view, PER_MEMBER_PER_DAY, ALL_MEMBERS_PER_DAY };
