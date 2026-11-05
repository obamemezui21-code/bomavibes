// Text cleaning shared by the news imports: HTML entities, tags, long titles.
const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", oelig: "œ", OElig: "Œ", aelig: "æ", deg: "°", euro: "€",
};
const ACCENT_MARKS = { acute: "́", grave: "̀", circ: "̂", uml: "̈", cedil: "̧", tilde: "̃" };

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([A-Za-z])(acute|grave|circ|uml|cedil|tilde);/g, (_, letter, mark) => (letter + ACCENT_MARKS[mark]).normalize("NFC"))
    .replace(/&([A-Za-z]+);/g, (whole, name) => NAMED_ENTITIES[name] ?? whole);
}

function cleanText(html) {
  return decodeEntities(html.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.]+$/, "")}…`;
}

module.exports = { cleanText, decodeEntities, truncate };
