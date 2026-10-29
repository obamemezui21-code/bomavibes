// What happens to a profile photo, from what the analysis measured
// (services/photoAnalysis.js). Three outcomes:
//   accepted  — clearly a real photo of a person, face visible
//   review    — probably fine but not certain (face partly hidden by a phone
//               or a hand, mirror selfie, small or soft face…): accepted for
//               now and put in the moderation queue
//   rejected  — clearly not usable (black photo, no person at all, a drawing,
//               an animal or a statue with no human face)
//
// Real photos used to be refused too easily (mirror selfies, gym photos, a
// phone in front of the face) and accounts suspended over it: only what is
// certain is refused now, the rest goes to a human.

const THRESHOLDS = {
  faceStrong: 0.75, // a face this sure: accepted
  faceWeak: 0.6, // a face, but partly hidden or turned: review
  faceTrace: 0.4, // maybe a face: review when CLIP sees a person
  personClip: 0.4, // CLIP "person" probability that makes a hidden face plausible
  drawingReject: 0.95,
  // Real photos stayed at or under 0.05; 3D renders and illustrations of
  // people score from ~0.2: a human looks at those.
  drawingReview: 0.25,
  animalReject: 0.85, // only when no clear human face is there too
  animalReview: 0.6,
  objectReject: 0.85, // statue, mask, doll — same
  objectReview: 0.6,
  darkReject: 12, // mean luminance 0-255: a black photo
  darkReview: 18,
  faceShareReview: 0.04, // face height / photo height: full-length mirror selfies are small
  sharpnessReview: 4,
};

/**
 * @param {{ faceScore: number, faceShare?: number, sharpness?: number, brightness: number,
 *   kinds?: { person?: number, animal?: number, drawing?: number, object?: number } | null }} s
 *   faceScore: the best face's detector score (0 when none); kinds: CLIP's
 *   probabilities, null when the model is missing
 * @returns {{ verdict: 'accepted' | 'review' | 'rejected', code: string | null }}
 */
function decidePhoto(s, t = THRESHOLDS) {
  const kinds = s.kinds || null;
  const face = s.faceScore || 0;
  const reject = (code) => ({ verdict: "rejected", code });
  const review = (code) => ({ verdict: "review", code });

  if (s.brightness < t.darkReject) return reject("photo-too-dark");
  if (kinds) {
    if ((kinds.drawing || 0) >= t.drawingReject) return reject("photo-drawing");
    if ((kinds.animal || 0) >= t.animalReject && face < t.faceStrong) return reject("photo-animal");
    if ((kinds.object || 0) >= t.objectReject && face < t.faceStrong) return reject("photo-object");
  }

  if (face < t.faceTrace) {
    // No face found. A person CLIP is sure about (seen from the side, phone
    // in front of the face…) goes to a human; a landscape or an object doesn't.
    if (!kinds || (kinds.person || 0) >= t.personClip) return review("photo-face-hidden");
    return reject("photo-no-face");
  }
  if (face < t.faceStrong) return review("photo-face-hidden");

  if (kinds) {
    if ((kinds.drawing || 0) >= t.drawingReview) return review("photo-drawing");
    if ((kinds.animal || 0) >= t.animalReview) return review("photo-animal");
    if ((kinds.object || 0) >= t.objectReview) return review("photo-object");
  }
  if (s.brightness < t.darkReview) return review("photo-too-dark");
  if (s.faceShare != null && s.faceShare < t.faceShareReview) return review("photo-face-too-small");
  if (s.sharpness != null && s.sharpness < t.sharpnessReview) return review("photo-blurry");
  return { verdict: "accepted", code: null };
}

// One precise reason per photo, with what to do about it.
const PHOTO_REASONS = {
  "photo-no-face": "Aucun visage visible : choisis une photo où l’on voit ton visage (pas de dos, pas de paysage ni d’objet seul).",
  "photo-face-hidden": "Visage partiellement caché : essaie une photo sans le téléphone ou la main devant le visage.",
  "photo-face-too-small": "Visage trop petit : rapproche-toi ou recadre la photo autour de toi.",
  "photo-blurry": "Photo floue au niveau du visage : reprends-la bien nette, téléphone stable.",
  "photo-too-dark": "Photo trop sombre : reprends-la près d’une fenêtre ou avec plus de lumière.",
  "photo-drawing": "Dessin ou illustration : il faut une vraie photo de toi, prise avec ton téléphone.",
  "photo-animal": "On voit un animal mais pas ton visage : ajoute une photo où l’on te voit, toi.",
  "photo-object": "Statue, masque ou poupée : il faut une vraie photo de toi.",
  "photo-not-ours": "Cette photo ne vient pas de BomaVibes : remplace-la par une photo de toi prise avec ton téléphone.",
};

function reasonFor(code) {
  return PHOTO_REASONS[code] || PHOTO_REASONS["photo-no-face"];
}

/**
 * Whether an account is suspended for its photos. Never over an automatic
 * refusal alone: the account stays active while at least one photo is
 * accepted or waiting for a human ('review': accepted for now; 'pending':
 * refused by the analysis, a moderator hasn't confirmed). Only refusals
 * confirmed by a moderator ('rejected'), photos that aren't ours (files gone,
 * images from elsewhere) or no photo at all can suspend it, and only after
 * the deadline.
 * @param {Array<'accepted'|'review'|'pending'|'rejected'|'not-ours'>} states - one per profile photo
 */
function photosSuspension(states, { now = Date.now(), deadline }) {
  if (now <= deadline) return false;
  return states.every((s) => s === "rejected" || s === "not-ours");
}

module.exports = { THRESHOLDS, decidePhoto, PHOTO_REASONS, reasonFor, photosSuspension };
