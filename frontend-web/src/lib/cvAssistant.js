// CV PNPE without AI: free, instant, made on the member's phone, nothing sent
// anywhere. Used whenever the AI isn't set up (no paid key), or when the
// member prefers it (see CvBuilder.jsx).
//
// It puts what the member typed into the PNPE's mandatory sections and tidies
// it: capitals, accents and acronyms, dates as « Mars 2021 », experience
// newest first, each task starting with an action verb (« je recevais les
// clients » → « Accueillir les clients »), diplomas apart from certificates,
// technical skills apart from know-how. Rules only: nothing is added that
// wasn't typed, and the advice lists what it couldn't fix.

const fold = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
const squash = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()
const capitalize = (text) => (text ? text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1) : '')
const list = (text) => text.trim().split(/\s+/)
const startsWithVowel = (text) => /^[aeiouyhàâéèêîïôûœ]/i.test(text)

// Typed in capitals from start to end: read as lower case (acronyms come back).
function isShouting(text) {
  const letters = String(text).replace(/[^\p{L}]/gu, '')
  return letters.length > 3 && letters === letters.toUpperCase()
}

// ---- Words: accents, acronyms, brands, SMS shortcuts ---------------------------

// Words members often type without accents on a phone. Only words whose
// unaccented spelling isn't another French word (no « marche », « cote »…).
const ACCENTED = list(`
  opérateur opératrice opérateurs pétrole pétrolier pétrolière pétroliers pétrolières électricien électricienne
  électriciens électricité électrique électriques électronique électroniques électrotechnique électromécanique
  électromécanicien mécanicien mécanicienne mécanique mécaniques sécurité secrétaire secrétariat comptabilité
  réceptionniste réception employé employée employés gérant gérante caissière caissières ménagère infirmière
  infirmières ingénieur ingénieure ingénieurs ingénierie hôtesse hôtesses hôtellerie hôtelier hôtelière hôtel hôtels
  bâtiment bâtiments maçonnerie maçon maçons réseau réseaux télécommunications télécoms qualité entrepôt entrepôts
  contrôle contrôles contrôleur contrôleuse général générale généraux médical médicale médicaux médecin médecine
  préparateur préparatrice cuisinière pâtissier pâtissière pâtisserie boulangère conseillère téléconseiller
  téléconseillère télévendeur télévendeuse télévente téléopérateur téléopératrice société sociétés activité
  activités équipe équipes équipement équipements matériel matériels matériaux opération opérations création
  créations développement développeur développeuse détail détails étude études école écoles université
  universités diplôme diplômes diplômé diplômée baccalauréat supérieur supérieure supérieurs français française
  myènè nzébi téké lycée lycées collège collèges intérim intérimaire bénévole bénévoles bénévolat expérience
  expériences compétence compétences référent référente véhicule véhicules léger légère légers légères numérique
  numériques télévision vidéo vidéos communauté publicité événement événements événementiel clientèle téléphone
  téléphones téléphonique téléphoniques procédure procédures réglementation réglementaire hygiène santé propreté
  dépôt dépôts dépannage câblage câble câbles système systèmes données fiabilité efficacité priorité priorités
  délai délais échéance échéances réunion réunions présentation présentations rédaction rédacteur rédactrice
  géographie géologie géologue géomètre énergie énergies métallurgie minière minières forêt forêts forestière
  pêche élevage vétérinaire pédiatrie maternité hôpital hôpitaux médicament médicaments réapprovisionnement
  étiquetage déchargement règlement règlements ménage démarchage réparation réparations vérification
  vérifications sélection préparation préparations opération sécurisation désinfection décoration découpe
  évaluation évaluations médiation négociation négociations élaboration exécution expédition expéditions
  intégration réalisation réalisations prévention récupération référencement régulation réglage réglages
  répartition résolution téléphonie rénovation rénovations
  gérer contrôler préparer réaliser réceptionner vérifier élaborer établir créer développer répondre réparer
  rédiger procéder sécuriser intégrer réguler régler sélectionner présenter déclarer délivrer déplacer dépanner
  détecter éditer éduquer élargir éliminer évaluer évacuer exécuter expédier fidéliser générer interpréter
  libérer mémoriser opérer préserver prévenir prévoir protéger récupérer réduire référencer réfléchir
  régulariser rémunérer répartir répertorier répéter résoudre réviser téléphoner transférer accélérer céder
  compléter considérer coopérer décider décharger décorer découper défendre démarcher démarrer démonter
  déployer désinfecter détailler réapprovisionner récolter réserver numériser éplucher étiqueter équiper
  étudier émettre également
  kélé mpongwè sékiani kwélé mahongwé pové
  lambaréné ndendé lébamba mékambo booué ndjolé omboué médouneu akiéni léconi ogooué ngounié akébé
`)
const ACCENTS = new Map(ACCENTED.map((word) => [fold(word), word]))

const ACRONYMS = new Set(
  list(`bts dut dts bepc cepe uob ustm insg enset cfmp pnpe hse qhse sst caces sap gmao erp rh pme ong sarl seeg
  cnss cnamgs oprag setrag sobraga comilog bgfi bicig ugb ogar gsez tic pc ccna toeic toefl delf dalf iut
  tpe iso sql html css php crm sav deug dea dess bp`),
)
// Not « mba »: the diploma, but also a common Gabonese name (Léon Mba). See diplomaTitle.
// Also words, so only made capitals in names of diplomas, schools and companies.
const NAME_ACRONYMS = new Set(['sa', 'cap', 'bep', 'bt', 'cep', 'ens'])

const BRANDS = new Map(
  Object.entries({
    excel: 'Excel', word: 'Word', powerpoint: 'PowerPoint', outlook: 'Outlook', access: 'Access', internet: 'Internet',
    google: 'Google', gmail: 'Gmail', canva: 'Canva', photoshop: 'Photoshop', illustrator: 'Illustrator',
    indesign: 'InDesign', autocad: 'AutoCAD', archicad: 'ArchiCAD', revit: 'Revit', sketchup: 'SketchUp', sage: 'Sage',
    odoo: 'Odoo', quickbooks: 'QuickBooks', wordpress: 'WordPress', javascript: 'JavaScript', python: 'Python',
    java: 'Java', mysql: 'MySQL', linux: 'Linux', windows: 'Windows', android: 'Android', whatsapp: 'WhatsApp',
    facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube',
    capcut: 'CapCut', microsoft: 'Microsoft', cisco: 'Cisco', zoom: 'Zoom', teams: 'Teams', office: 'Office',
  }),
)
const PHRASES = [
  [/\bpack\s+office\b/gi, 'Pack Office'],
  [/\bms\s+office\b/gi, 'MS Office'],
  [/\bpower\s+point\b/gi, 'PowerPoint'],
  [/\bauto\s+cad\b/gi, 'AutoCAD'],
  [/\bmise a jour\b/gi, 'mise à jour'],
  [/\bmettre a jour\b/gi, 'mettre à jour'],
]

const SMS = new Map(
  Object.entries({ ds: 'dans', pr: 'pour', avc: 'avec', bcp: 'beaucoup', tjrs: 'toujours', tjs: 'toujours', qlq: 'quelques', qq: 'quelques', svt: 'souvent', mtn: 'maintenant', rdv: 'rendez-vous', pdt: 'pendant', nbr: 'nombre', ke: 'que', ki: 'qui' }),
)

function fixWords(text, { names = false, sms = false, smallA = false } = {}) {
  let out = text
  for (const [pattern, replacement] of PHRASES) out = out.replace(pattern, replacement)
  return out.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const key = fold(word)
    if (ACRONYMS.has(key) || (names && NAME_ACRONYMS.has(key))) return key.toUpperCase()
    if (BRANDS.has(key) && word === word.toLowerCase()) return BRANDS.get(key)
    if (sms && SMS.has(key) && word === word.toLowerCase()) return SMS.get(key)
    if (smallA && word === 'a') return 'à'
    const accented = ACCENTS.get(key)
    if (!accented || (word.length > 1 && word === word.toUpperCase())) return word
    return word[0] !== word[0].toLowerCase() ? capitalize(accented) : accented
  })
}

// A job title, a diploma, a skill: capital first, accents, acronyms.
function sentence(text, options) {
  let s = squash(text)
  if (isShouting(s)) s = s.toLowerCase()
  return capitalize(fixWords(s, options))
}

const SMALL_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'à', 'a', 'au', 'aux', 'sur', 'sous', 'pour', "d'", "l'"])

// A company, a town, a school: typed all in small letters → « Port-Gentil ».
function properName(text) {
  const s = squash(text)
  if (!s || s !== s.toLowerCase()) return fixWords(s, { names: true })
  const titled = s.replace(/[\p{L}\p{N}]+/gu, (word, offset) => (offset > 0 && SMALL_WORDS.has(word) ? word : capitalize(word)))
  return fixWords(titled, { names: true })
}

// ---- Dates ---------------------------------------------------------------------

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTH_KEYS = [['janv', 'jan'], ['fevr', 'fev', 'feb'], ['mars', 'mar'], ['avr', 'apr'], ['mai', 'may'], ['juin', 'jun'], ['juil', 'jul'], ['aout', 'aug'], ['sept', 'sep'], ['oct'], ['nov'], ['dec']]
const ONGOING = /aujourd|en cours|a ce jour|actuel|present|maintenant/

function monthIn(t) {
  return MONTH_KEYS.findIndex((keys) => keys.some((k) => new RegExp(`(^|[^a-z])${k}`).test(t)))
}

function fullYear(yy) {
  const n = Number(yy)
  return n <= new Date().getFullYear() % 100 ? 2000 + n : 1900 + n
}

// « 03/2021 », « mars 21 », « Mars 2021 » → « Mars 2021 ». Unreadable: as typed.
export function normalizeDate(text) {
  const raw = squash(text)
  const t = fold(raw)
  if (!t) return ''
  if (ONGOING.test(t)) return "Aujourd'hui"
  let m = t.match(/^(\d{1,2})\s*[/.-]\s*((?:19|20)\d{2}|\d{2})$/)
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${MONTHS[+m[1] - 1]} ${m[2].length === 2 ? fullYear(m[2]) : m[2]}`
  const month = monthIn(t)
  m = t.match(/(?:19|20)\d{2}/) || (month >= 0 && t.match(/(?:^|\D)(\d{2})$/))
  const year = m && (m[0].length === 4 ? m[0] : fullYear(m[1]))
  if (year && month >= 0) return `${MONTHS[month]} ${year}`
  if (/^(?:19|20)\d{2}$/.test(t)) return t
  return raw
}

// A diploma's year: « 2021 », « 2019-2021 » → « 2019 – 2021 ».
export function normalizeYear(text) {
  const raw = squash(text)
  const range = fold(raw).match(/^((?:19|20)\d{2})\s*(?:-|–|a|au|\/)\s*((?:19|20)\d{2})$/)
  if (range) return `${range[1]} – ${range[2]}`
  return raw
}

// « Mars 2022 » → 2022.25, « 2021 » → 2021, « Aujourd'hui » → Infinity, null when unreadable.
export function dateValue(text) {
  const t = fold(text).trim()
  if (!t) return null
  if (ONGOING.test(t)) return Infinity
  const years = t.match(/(?:19|20)\d{2}/g)
  if (!years) return null
  const month = monthIn(t)
  return Number(years[years.length - 1]) + (month >= 0 ? (month + 1) / 13 : 0)
}

// Sorted only when every entry has a readable date; otherwise the member's order.
function newestFirst(items, keyOf) {
  const keyed = items.map((item) => ({ item, key: keyOf(item) }))
  if (keyed.some((k) => k.key === null)) return items
  return keyed.sort((a, b) => b.key - a.key).map((k) => k.item)
}

function experienceKey(e) {
  const fin = dateValue(e.fin) ?? dateValue(e.debut)
  if (fin === null) return null
  return fin === Infinity ? 1e6 + (dateValue(e.debut) ?? 0) : fin
}

// ---- Verbs ---------------------------------------------------------------------

// Infinitive (as printed) of each form members write: « gérais », « géré »,
// « gère » → « gérer ». Keys are unaccented, so « gerais » works too.
const FORMS = new Map()
const STEMS = new Map() // imperfect stems, for « nous recevions »…
const INFINITIVES = new Map()

function addForm(form, inf) {
  const key = fold(form)
  if (!FORMS.has(key)) FORMS.set(key, inf)
}

const E_GRAVE = new Set(['acheter', 'achever', 'amener', 'emmener', 'mener', 'lever', 'enlever', 'soulever', 'peser', 'promener', 'semer'])
const DOUBLE = new Set(['appeler', 'rappeler', 'jeter', 'épeler', 'renouveler'])

const ER_VERBS = list(`
  accompagner administrer afficher aider ajuster alimenter analyser animer appeler appliquer apporter approvisionner
  archiver arroser assembler assister assurer auditer balayer brancher calculer câbler charger chercher chiffrer
  classer coder coiffer collecter commander communiquer compléter compter conditionner confectionner configurer
  conseiller consulter contacter contrôler coordonner corriger créer cuisiner cultiver décharger décorer découper
  démarcher démonter dépanner déployer désinfecter désherber dessiner détecter développer diagnostiquer diriger
  distribuer documenter dresser éditer éduquer effectuer élaborer emballer encadrer encaisser enregistrer enseigner
  entreposer envoyer éplucher équiper essayer estimer étiqueter évaluer examiner exécuter expédier expliquer
  exploiter fabriquer facturer fidéliser filmer former garder gérer guider habiller identifier informer inspecter
  installer intégrer inventorier laver livrer manipuler manutentionner maquiller masser mesurer mobiliser monter
  motiver négocier nettoyer noter numériser observer occuper opérer optimiser organiser orienter paramétrer
  participer payer peser photographier piloter placer planifier planter plier pointer porter poser préparer
  présenter préserver programmer proposer prospecter protéger raccorder ranger rassembler réaliser réapprovisionner
  réceptionner recenser rechercher récolter recruter recycler récupérer rédiger référencer réguler relancer relever
  remplacer renseigner réparer repasser répertorier représenter réserver respecter restaurer retoucher réviser
  sauvegarder scanner sécuriser sélectionner sensibiliser signaler soigner souder stocker superviser surveiller
  tailler taper téléphoner tester traiter transférer transporter travailler trier utiliser vacciner valider veiller
  vérifier verser visser aménager arranger changer échanger encourager engager partager interroger annoncer
  financer lancer renforcer commencer employer essuyer appuyer convoyer acheter amener mener lever enlever
  soulever jeter rappeler déplacer
`)

for (const inf of ER_VERBS) {
  const stem = inf.slice(0, -2)
  INFINITIVES.set(fold(inf), inf)
  let present
  if (E_GRAVE.has(inf)) present = stem.replace(/e([^aeiouyéèêë]+)$/, 'è$1')
  else if (DOUBLE.has(inf)) present = stem + stem.slice(-1)
  else if (/[ou]y$/.test(stem)) present = `${stem.slice(0, -1)}i`
  else present = stem.replace(/é([^aeiouyéèêë]+)$/, 'è$1')
  addForm(`${present}e`, inf)
  if (/ay$/.test(stem)) addForm(`${stem.slice(0, -1)}ie`, inf)
  const imperfect = /g$/.test(stem) ? `${stem}e` : /c$/.test(stem) ? `${stem.slice(0, -1)}ç` : stem
  for (const ending of ['ais', 'ait']) addForm(imperfect + ending, inf)
  addForm(`${stem}é`, inf)
  STEMS.set(fold(imperfect), inf)
  STEMS.set(fold(stem), inf)
}

const IR_VERBS = list(`finir remplir établir fournir garantir investir choisir réussir accomplir agir saisir bâtir nourrir
  réfléchir grandir unir réunir définir enrichir approfondir garnir aboutir avertir convertir guérir élargir
  assainir polir vernir munir`)
for (const inf of IR_VERBS) {
  const stem = inf.slice(0, -2)
  INFINITIVES.set(fold(inf), inf)
  for (const form of [`${stem}is`, `${stem}it`, `${stem}issais`, `${stem}issait`, `${stem}i`]) addForm(form, inf)
  STEMS.set(fold(`${stem}iss`), inf)
}

// Irregular verbs: their forms, « * » marking the imperfect stem (« recev* » →
// recevais, recevait, recevions…).
const IRREGULAR = {
  faire: 'fais fait fais*', prendre: 'prends prend pren* pris', apprendre: 'apprends apprend appren* appris',
  comprendre: 'comprends comprend compren* compris', reprendre: 'reprends reprend repren* repris',
  entreprendre: 'entreprends entreprend entrepren* entrepris', recevoir: 'reçois reçoit recev* reçu',
  concevoir: 'conçois conçoit concev* conçu', percevoir: 'perçois perçoit percev* perçu', vendre: 'vends vend vend* vendu',
  rendre: 'rends rend rend* rendu', répondre: 'réponds répond répond* répondu', attendre: 'attends attend attend* attendu',
  descendre: 'descends descend descend* descendu', défendre: 'défends défend défend* défendu', étendre: 'étends étend étend* étendu',
  tondre: 'tonds tond tond* tondu', conduire: 'conduis conduit conduis*', produire: 'produis produit produis*',
  construire: 'construis construit construis*', réduire: 'réduis réduit réduis*', introduire: 'introduis introduit introduis*',
  traduire: 'traduis traduit traduis*', instruire: 'instruis instruit instruis*', cuire: 'cuis cuit cuis*',
  enduire: 'enduis enduit enduis*', écrire: 'écris écrit écriv*', décrire: 'décris décrit décriv*',
  inscrire: 'inscris inscrit inscriv*', transcrire: 'transcris transcrit transcriv*', lire: 'lis lit lis* lu',
  servir: 'sers sert serv* servi', sortir: 'sors sort sort* sorti', suivre: 'suit suiv* suivi', mettre: 'mets met mett* mis',
  remettre: 'remets remet remett* remis', transmettre: 'transmets transmet transmett* transmis',
  soumettre: 'soumets soumet soumett* soumis', tenir: 'tiens tient ten* tenu', entretenir: 'entretiens entretient entreten* entretenu',
  maintenir: 'maintiens maintient mainten* maintenu', obtenir: 'obtiens obtient obten* obtenu',
  soutenir: 'soutiens soutient souten* soutenu', venir: 'viens vient ven* venu',
  intervenir: 'interviens intervient interven* intervenu', prévenir: 'préviens prévient préven* prévenu',
  accueillir: 'accueille accueill* accueilli', cueillir: 'cueille cueill* cueilli', recueillir: 'recueille recueill* recueilli',
  ouvrir: 'ouvre ouvr* ouvert', offrir: 'offre offr* offert', couvrir: 'couvre couvr* couvert', voir: 'vois voit voy* vu',
  prévoir: 'prévois prévoit prévoy* prévu', promouvoir: 'promeus promeut promouv* promu', peindre: 'peins peint peign*',
  joindre: 'joins joint joign*', rejoindre: 'rejoins rejoint rejoign*', éteindre: 'éteins éteint éteign*',
  atteindre: 'atteins atteint atteign*', coudre: 'couds coud cous* cousu', résoudre: 'résous résout résolv* résolu',
  courir: 'cours court cour* couru', parcourir: 'parcours parcourt parcour* parcouru', connaître: 'connais connaît connaiss* connu',
  acquérir: 'acquiers acquiert acquér* acquis', extraire: 'extrais extrait extray*', battre: 'bats bat batt* battu',
  partir: 'pars part part* parti',
}
for (const [inf, forms] of Object.entries(IRREGULAR)) {
  INFINITIVES.set(fold(inf), inf)
  for (const form of list(forms)) {
    if (form.endsWith('*')) {
      const stem = form.slice(0, -1)
      STEMS.set(fold(stem), inf)
      for (const ending of ['ais', 'ait']) addForm(stem + ending, inf)
    } else addForm(form, inf)
  }
}
for (const inf of ['avoir', 'être', 'aller', 'devoir', 'pouvoir', 'savoir', 'vouloir', 'dire', 'donner']) INFINITIVES.set(fold(inf), inf)
for (const form of ['donne', 'donnais', 'donnait', 'donné']) addForm(form, 'donner')
STEMS.set('donn', 'donner')

const SUBJECTS = new Set(['je', "j'", 'on', 'nous'])
const REFLEXIVE = new Set(['me', "m'", 'se', "s'", 'nous'])
const CONNECTORS = new Set(['et', 'puis', 'ensuite', 'aussi', 'egalement', 'enfin', 'souvent', 'parfois'])
const AVOIR = new Set(['ai', 'avais', 'avait', 'a', 'avons', 'avions'])
const ETRE = new Set(['suis', 'etais', 'etait', 'est', 'sommes', 'etions'])
const ALLER = new Set(['vais', 'va', 'allais', 'allait', 'allons', 'allions'])
const MODALS = new Set([...ALLER, 'dois', 'doit', 'devais', 'devait', 'devions', 'peux', 'peut', 'pouvais', 'pouvait', 'pouvions', 'sais', 'sait', 'savais', 'savait'])
const DE = new Set(['de', "d'", 'du', 'des'])
const DETERMINERS = new Set(list(`le la les l' un une des du mes ses nos leurs leur ce cet cette ces son sa ma mon notre
  votre tout toute tous toutes plusieurs chaque quelques certains certaines differents differentes divers diverses`))
const DIRECT = new Set(list(`le la les l' un une mes ses nos leurs ce cet cette ces son sa ma mon notre`))
const PREPOSITIONS = new Set(list(`a au aux en dans chez sur pour avec par de du des d' entre vers`))
// Words ending like an infinitive that aren't verbs.
const NOT_VERBS = new Set(list(`dossier papier fichier chantier atelier quartier metier courrier premier dernier cahier
  panier boulanger plombier pompier cuisinier caissier hotelier loisir plaisir avenir desir soir miroir comptoir tiroir
  trottoir devoir pouvoir savoir espoir couloir lettre centre maitre titre registre ordre chiffre livre cadre membre
  nombre theatre metre litre ministre hier mer fer hiver cancer manager leader poster flyer router quartier
  pier sentier calendrier clavier escalier entretien`))

function lookUp(word) {
  const key = fold(word)
  if (FORMS.has(key)) return FORMS.get(key)
  for (const ending of ['aient', 'ions', 'iez', 'ons', 'ez']) {
    if (key.endsWith(ending) && STEMS.has(key.slice(0, -ending.length))) return STEMS.get(key.slice(0, -ending.length))
  }
  return null
}

// Agreed past participles too: « gérée », « chargés ».
function participleOf(word) {
  const key = fold(word)
  return lookUp(key) || lookUp(key.replace(/(es|e|s)$/, ''))
}

function knownInfinitive(key) {
  return INFINITIVES.get(key) || null
}

function looksInfinitive(key) {
  return !!key && key.length > 3 && /^[a-z]+(er|ir|re|oir)$/.test(key) && !NOT_VERBS.has(key)
}

// An infinitive, known or plausible: « vérifier », « harmoniser ».
function asInfinitive(word) {
  const key = fold(word)
  return knownInfinitive(key) || (looksInfinitive(key) ? String(word).toLowerCase() : null)
}

// A verb we don't know, from its ending (only right after « je »).
function guessInfinitive(word) {
  const w = String(word).toLowerCase()
  if (/issai[st]$/.test(w)) return w.replace(/issai[st]$/, 'ir')
  if (/geai[st]$/.test(w)) return w.replace(/eai[st]$/, 'er')
  if (/çai[st]$/.test(w)) return w.replace(/çai[st]$/, 'cer')
  if (/ai[st]$/.test(w) && w.length > 5) return w.replace(/ai[st]$/, 'er')
  if (/[^e]é$/.test(w)) return w.replace(/é$/, 'er')
  if (/[^aeiou]e$/.test(w) && w.length > 4) return `${w.replace(/è(?=[^aeiouyéèêë]+e$)/, 'é')}r`
  return null
}

// ---- Tasks ---------------------------------------------------------------------

// What « Assurer le / la … » turns into a task: « la vente des produits ».
const TASK_NOUNS = new Map([
  ...list(`accueil suivi controle entretien nettoyage classement archivage encadrement approvisionnement gardiennage
    montage cablage depannage service traitement transport chargement dechargement conditionnement emballage etiquetage
    rangement recrutement secretariat standard tri lavage repassage menage recouvrement recensement marketing
    merchandising pilotage paiement reglement developpement management magasinage stockage reporting coaching
    demarchage diagnostic reapprovisionnement balisage entreposage service`).map((n) => [n, 'm']),
  ...list(`gestion vente redaction preparation installation reparation livraison saisie organisation planification
    formation animation prospection maintenance surveillance reception facturation coordination supervision
    verification distribution securite mise manutention collecte soudure pose plomberie peinture plonge relation
    communication logistique production fabrication conception programmation administration assistance coiffure
    couture garde traduction correction negociation promotion diffusion conduite location restauration mediation
    sensibilisation evaluation analyse inspection revision tenue orientation desinfection decoration cuisson
    decoupe`).map((n) => [n, 'f']),
])

// Things that call for their own verb: « caisse » → « Tenir la caisse ».
const OBJECTS = {
  caisse: ['Tenir', 'f'], comptabilite: ['Tenir', 'f'], rapport: ['Rédiger', 'm'], courrier: ['Gérer', 'm'],
  stock: ['Gérer', 'm'], facture: ['Établir', 'f'], devis: ['Établir', 'm'], commande: ['Traiter', 'f'],
  dossier: ['Traiter', 'm'], reunion: ['Organiser', 'f'], planning: ['Établir', 'm'], inventaire: ['Réaliser', 'm'],
  cours: ['Dispenser', 'm'], appel: ['Répondre', 'm'],
}
const AFTER_FAIRE = { photocopie: 'Réaliser', travaux: 'Réaliser', etude: 'Réaliser', enquete: 'Réaliser', course: 'Effectuer', achat: 'Effectuer' }
const WELCOMED = new Set(list('client clients visiteur visiteurs patient patients public usager usagers invite invites clientele parent parents eleve eleves candidat candidats malade malades passager passagers'))
const RECEIVED = new Set(list('marchandise marchandises livraison livraisons colis commande commandes produit produits materiel stock stocks fourniture fournitures cargaison cargaisons conteneur conteneurs palette palettes'))

const singular = (key) => (key && key.length > 3 && /[sx]$/.test(key) && !['cours', 'devis', 'travaux', 'colis'].includes(key) ? key.slice(0, -1) : key)
const isPlural = (key) => !!key && key !== singular(key)
const taskNoun = (key) => TASK_NOUNS.get(key) || TASK_NOUNS.get(singular(key)) || null
const objectOf = (key) => OBJECTS[key] || OBJECTS[singular(key)] || null

function articleFor(word, key, gender) {
  if (isPlural(key)) return 'les'
  if (startsWithVowel(word)) return "l'"
  return (gender || taskNoun(key) || objectOf(key)?.[1]) === 'f' ? 'la' : 'le'
}

// Splits « l'accueil » / « j'ai » into words (« l' », « accueil »).
function toWords(text) {
  return squash(String(text).replace(/(^|[^\p{L}])([jmsldnct]|qu)['’]\s*/giu, "$1$2' ")).split(' ').filter(Boolean)
}
const join = (words) => words.join(' ').replace(/' /g, "'")

function lowerFirst(words) {
  if (!words.length) return words
  const [first, ...rest] = words
  const keep = first.length > 1 && first === first.toUpperCase()
  return [keep ? first : first.charAt(0).toLowerCase() + first.slice(1), ...rest]
}

const phrase = (verb, tail) => squash(`${verb} ${join(tail)}`)

// « de / du / des / de la / d' » after « chargé », « responsable »… → an article.
function afterDe(t, tk) {
  const [d, next] = [tk[0], tk[1]]
  if (d === 'du') return ['le', ...t.slice(1)]
  if (d === 'des') return ['les', ...t.slice(1)]
  if ((d === 'de' || d === "d'") && (next === 'la' || next === "l'" || next === 'un' || next === 'une' || DETERMINERS.has(next))) return t.slice(1)
  if (d === "d'") return [isPlural(next) ? 'des' : "l'", ...t.slice(1)]
  if (d === 'de' && t[1]) return [articleFor(t[1], next), ...t.slice(1)]
  return t
}

// « la vente des produits », « caisse », « les rapports » → « Assurer la vente
// des produits », « Tenir la caisse », « Rédiger les rapports ». Null when the
// noun is unknown, unless a verb to fall back on is given.
function fromNoun(words, fallbackVerb = null) {
  let t = words
  let tk = t.map((word) => fold(word))
  if (tk[0] === 'du') {
    t = ['le', ...t.slice(1)]
    tk = ['le', ...tk.slice(1)]
  }
  const j = DETERMINERS.has(tk[0]) && tk[1] ? 1 : 0
  const noun = tk[j]
  const object = objectOf(noun)
  const gender = taskNoun(noun)
  if (!noun || (!object && !gender && !fallbackVerb)) return null
  if (j === 0) t = [articleFor(t[0], noun, object?.[1] || gender), ...t]
  const verb = object ? object[0] : gender ? 'Assurer' : fallbackVerb
  // « Répondre aux appels », « Répondre à l'appel ».
  if (verb === 'Répondre') t = isPlural(noun) ? ['aux', ...t.slice(1)] : t[0] === "l'" ? ['à', ...t] : ['au', ...t.slice(1)]
  return phrase(verb, t)
}

// « chargée de vérifier les stocks » → « Vérifier les stocks »;
// « chargée de la saisie » → « Assurer la saisie »; « des enfants » → « Prendre en charge les enfants ».
function fromCharge(t, tk) {
  if ((tk[0] === 'de' || tk[0] === "d'") && t[1]) {
    const inf = knownInfinitive(tk[1]) || (looksInfinitive(tk[1]) && !taskNoun(tk[1]) ? t[1].toLowerCase() : null)
    if (inf) return withVerb(inf, t.slice(2), tk.slice(2))
  }
  return fromNoun(afterDe(t, tk), 'Prendre en charge')
}

// « J'étais chargée de… », « responsable du magasin », « caissière ».
function fromEtre(t, tk) {
  if (/^charge(e|s|es)?$/.test(tk[0]) && DE.has(tk[1])) return fromCharge(t.slice(1), tk.slice(1))
  if (tk[0] === 'en' && tk[1] === 'charge' && DE.has(tk[2])) return fromCharge(t.slice(2), tk.slice(2))
  if (/^responsables?$/.test(tk[0]) && DE.has(tk[1])) return phrase('Gérer', afterDe(t.slice(1), tk.slice(1)))
  if (/^affecte(e|s|es)?$/.test(tk[0]) && ['a', 'au', 'aux'].includes(tk[1])) return phrase('Travailler', t.slice(1))
  const role = tk[0] === 'un' || tk[0] === 'une' ? t.slice(1) : t
  if (role.length && role.length <= 4 && !PREPOSITIONS.has(fold(role[0])) && !DETERMINERS.has(fold(role[0]))) return phrase('Occuper le poste de', role)
  return null
}

// The verb found, plus what follows it, with a few better-known turns of phrase.
function withVerb(inf, t, tk, { pronominal = false } = {}) {
  const f = fold(inf)
  if (pronominal && f === 'occuper') return DE.has(tk[0]) ? fromCharge(t, tk) : phrase('Prendre en charge', t)
  if (pronominal && f === 'charger' && DE.has(tk[0])) return fromCharge(t, tk)
  if (f === 'faire') {
    // « faire la caisse » → « Tenir la caisse », « faire le ménage » → « Assurer le ménage ».
    const j = DETERMINERS.has(tk[0]) ? 1 : 0
    if (singular(tk[j]) === 'cuisine') return phrase('Préparer les repas', t.slice(j + 1))
    const verb = AFTER_FAIRE[tk[j]] || AFTER_FAIRE[singular(tk[j])]
    if (verb) return phrase(verb, tk[0] === 'du' ? ['le', ...t.slice(1)] : t)
    return fromNoun(t) || phrase('Faire', t)
  }
  if (f === 'recevoir') {
    const noun = tk[DETERMINERS.has(tk[0]) ? 1 : 0]
    return phrase(WELCOMED.has(noun) ? 'Accueillir' : RECEIVED.has(noun) ? 'Réceptionner' : 'Recevoir', t)
  }
  if (f === 'ecrire') return phrase('Rédiger', t)
  if (f === 'aider') return tk[0] === 'a' && asInfinitive(t[1]) ? phrase('Contribuer à', t.slice(1)) : phrase('Assister', t)
  if (f === 'travailler' && tk[0] === 'comme') return phrase('Occuper le poste de', t.slice(1))
  if (f === 'travailler' && tk[0] === 'en' && tk[1] === 'tant' && tk[2] === 'que') return phrase('Occuper le poste de', t.slice(3))
  if (f === 'donner' && (tk[0] === 'cours' || tk[1] === 'cours')) return phrase('Dispenser', t)
  if (pronominal) return phrase(startsWithVowel(inf) ? `S'${inf}` : `Se ${inf}`, t)
  return phrase(capitalize(inf), t)
}

// After « je / j' / on / nous ».
function fromSubject(w, k, i) {
  let pronominal = false
  if (REFLEXIVE.has(k[i]) && i + 1 < w.length && !DIRECT.has(k[i + 1])) {
    pronominal = true
    i += 1
  }
  const v = k[i]
  const tail = (from) => [w.slice(from), k.slice(from)]
  if (v === undefined) return null
  if (AVOIR.has(v)) {
    if (k[i + 1] === 'ete') return fromEtre(...tail(i + 2))
    if (k[i + 1] === 'la' && DE.has(k[i + 3])) {
      if (k[i + 2] === 'responsabilite') return phrase('Gérer', afterDe(...tail(i + 3)))
      if (k[i + 2] === 'charge') return fromCharge(...tail(i + 3))
    }
    const inf = w[i + 1] && participleOf(w[i + 1])
    return inf ? withVerb(inf, ...tail(i + 2), { pronominal }) : null
  }
  if (ETRE.has(v)) {
    if (v === 'suis' && DIRECT.has(k[i + 1])) return withVerb('suivre', ...tail(i + 1))
    if (pronominal) {
      const inf = w[i + 1] && participleOf(w[i + 1])
      if (inf) return withVerb(inf, ...tail(i + 2), { pronominal })
    }
    return fromEtre(...tail(i + 1))
  }
  if (MODALS.has(v)) {
    if (ALLER.has(v) && k[i + 1] === 'chercher') return phrase('Récupérer', w.slice(i + 2))
    const inf = w[i + 1] && asInfinitive(w[i + 1])
    if (inf) return withVerb(inf, ...tail(i + 2))
    if (ALLER.has(v) && PREPOSITIONS.has(k[i + 1])) return phrase('Se rendre', w.slice(i + 1))
    return null
  }
  const inf = lookUp(w[i]) || guessInfinitive(w[i])
  return inf ? withVerb(inf, ...tail(i + 1), { pronominal }) : null
}

// No « je »: an infinitive, a noun (« vente des produits »), a bare verb.
function fromStart(w, k, i) {
  const t = lowerFirst(w.slice(i))
  const tk = k.slice(i)
  const inf = knownInfinitive(tk[0])
  if (inf) return withVerb(inf, t.slice(1), tk.slice(1))
  if ((tk[0] === "s'" || tk[0] === 'se') && knownInfinitive(tk[1])) return withVerb(knownInfinitive(tk[1]), t.slice(2), tk.slice(2), { pronominal: true })
  // « contrôle les vannes » is a verb (« je » left out); « contrôle des vannes », a noun.
  const verbFirst = DIRECT.has(tk[1]) && lookUp(t[0])
  const asNoun = !verbFirst && fromNoun(t)
  if (asNoun) return asNoun
  const conjugated = lookUp(t[0])
  if (conjugated) return withVerb(conjugated, t.slice(1), tk.slice(1))
  if (looksInfinitive(tk[0])) return join(t)
  return null
}

// One task: « je recevais les clients » → « Accueillir les clients ».
export function toTask(segment) {
  let text = squash(segment).replace(/^(?:[-–—•*·>+]+|\d+[.)])\s*/u, '').replace(/[\s.;:,!?]+$/u, '')
  if (!text) return ''
  if (isShouting(text)) text = text.toLowerCase()
  const w = toWords(text)
  const k = w.map((word) => fold(word))
  let i = 0
  while (CONNECTORS.has(k[i]) && i < w.length - 1) i += 1
  if (k[i] === 'moi' && k[i + 1] === 'je') i += 1
  const result = SUBJECTS.has(k[i]) ? fromSubject(w, k, i + 1) : fromStart(w, k, i)
  return capitalize(fixWords(squash(result || join(w)), { sms: true, smallA: !!result }).replace(/'/g, '’'))
}

// What a member wrote about a job → its tasks. Lines, « ; », « . », bullets,
// and « …, je … » / « … et je … » all start a new task.
export function splitTasks(text) {
  const marked = String(text || '')
    .replace(/,?\s+et\s+(?=(?:je\b|j['’]|on\b))/gi, '\n')
    .replace(/,\s*(?=(?:je\b|j['’]|on\b))/gi, '\n')
    .replace(/\s+(?=(?:je\s|j['’]))/gi, '\n')
  const out = []
  for (const block of marked.split(/\n|;|•|·|\.(?=\s|$)|!|\?|\s[-–—]\s/)) {
    // « contrôle des vannes, rapports »: a comma splits when what follows reads as a new task.
    let current = ''
    for (const part of splitOutsideBrackets(block, ',')) {
      const words = toWords(part)
      const starts = words.length > 0 && readsAsTask(words.map((x) => fold(x)))
      if (current && starts && toWords(current).length >= 2) {
        out.push(current)
        current = part.trim()
      } else current = current ? `${current}, ${part.trim()}` : part.trim()
    }
    if (current.trim()) out.push(current.trim())
  }
  return out
}

function readsAsTask(k) {
  const j = DETERMINERS.has(k[0]) && k[1] ? 1 : 0
  return SUBJECTS.has(k[0]) || !!knownInfinitive(k[0]) || !!taskNoun(k[j]) || !!objectOf(k[j]) || (j === 0 && !!lookUp(k[0]))
}

function splitOutsideBrackets(text, separator) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of String(text)) {
    if (ch === '(') depth += 1
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === separator && depth === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  return parts.filter((p) => p.trim())
}

export function startsWithVerb(task) {
  const first = fold(toWords(task)[0] || '')
  return !!knownInfinitive(first) || looksInfinitive(first) || first === "s'" || first === 'se'
}

function dedupe(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = fold(item)
    if (!item || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---- Sections --------------------------------------------------------------------

const DIPLOMA = /\b(bac|baccalaureat|bepc|cepe?|cap|bep|bt|bts|dut|dts|licence|master|maitrise|doctorat|deug|dea|dess|mba|ingenieur|diplome|brevet|bp)\b/
const CERTIFICATE = /\b(certificat|certification|attestation|formation|habilitation|caces|sst|hse|qhse|secourisme|psc1?|toeic|toefl|delf|dalf|ccna|cisco|permis|initiation|perfectionnement|cfmp|module|stage)\b/

const SCHOOLS = {
  uob: 'Université Omar Bongo (UOB)',
  ustm: 'Université des Sciences et Techniques de Masuku (USTM)',
  insg: 'Institut National des Sciences de Gestion (INSG)',
  enset: "École Normale Supérieure de l'Enseignement Technique (ENSET)",
}

function diplomaTitle(text) {
  return sentence(text, { names: true })
    .replace(/(\b(?:bac|baccalauréat)\s+(?:série\s+)?)([a-z]{1,2}\d?)\b/gi, (_, before, serie) => before + serie.toUpperCase())
    .replace(/\bmba\b/gi, 'MBA')
}

function trainings(rows) {
  const formations = []
  const certifications = []
  for (const row of rows || []) {
    if (!squash(row.intitule) && !squash(row.etablissement)) continue
    const entry = {
      annee: normalizeYear(row.annee),
      intitule: diplomaTitle(row.intitule),
      etablissement: SCHOOLS[fold(squash(row.etablissement))] || properName(row.etablissement),
    }
    const key = fold(row.intitule)
    if (!DIPLOMA.test(key) && CERTIFICATE.test(key)) certifications.push(entry)
    else formations.push(entry)
  }
  return {
    formations: newestFirst(formations, (f) => dateValue(f.annee)),
    certifications: newestFirst(certifications, (f) => dateValue(f.annee)),
  }
}

const TECHNICAL = /(excel|word|powerpoint|outlook|office|informatique|internet|logiciel|ordinateur|google|canva|photoshop|illustrator|autocad|revit|sketchup|sage|\bsap\b|odoo|quickbooks|wordpress|html|css|javascript|python|java|php|sql|linux|windows|android|reseau|cisco|ccna|gmao|\berp\b|caces|chariot|engin|grue|pelle|soudure|souder|electri|electronique|plomberie|mecanique|maconnerie|menuiserie|carrelage|conduite|permis|machine|couture|coiffure|logistique informatique|bureautique|\bpc\b|whatsapp|facebook|instagram|tiktok|reseaux sociaux|montage video|photo)/
const OFFICE_PARTS = ['Word', 'Excel', 'PowerPoint', 'Outlook', 'Access']

function skills(text) {
  const items = dedupe(
    String(text || '')
      .split(/\n|;|•|·/)
      .flatMap((line) => splitOutsideBrackets(line, ','))
      .flatMap((part) => part.split(/\s+et\s+|\s[-–—]\s/))
      .map((part) => sentence(part.replace(/^[-–—•*·>+\s]+/, '').replace(/[.;:,!?\s]+$/, ''), { names: true }))
      .filter(Boolean),
  )
  // « Word », « Excel » → one « Pack Office (Word, Excel) ».
  const office = items.filter((s) => OFFICE_PARTS.includes(s))
  let merged = items
  if (office.length >= 2 && !items.some((s) => /office/i.test(s))) {
    const at = items.indexOf(office[0])
    merged = items.filter((s) => !OFFICE_PARTS.includes(s))
    merged.splice(at, 0, `Pack Office (${office.join(', ')})`)
  }
  return {
    techniques: merged.filter((s) => TECHNICAL.test(fold(s))).slice(0, 12),
    savoirFaire: merged.filter((s) => !TECHNICAL.test(fold(s))).slice(0, 12),
  }
}

function languages(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows || []) {
    const name = capitalize(fixWords(squash(row.langue).toLowerCase()))
    if (!name || seen.has(fold(name))) continue
    seen.add(fold(name))
    out.push({ langue: name, niveau: squash(row.niveau).toLowerCase() })
  }
  return out
}

function experience(e) {
  const tasks = dedupe(splitTasks(e.description).map(toTask).filter(Boolean))
  return {
    debut: normalizeDate(e.debut),
    fin: e.enCours ? "Aujourd'hui" : normalizeDate(e.fin),
    entreprise: properName(e.entreprise),
    lieu: properName(e.ville),
    poste: sentence(e.poste),
    taches: tasks.slice(0, 8),
  }
}

// What the member could still improve: shown on screen, never printed.
function advice(form, cv) {
  const tips = []
  const label = (e) => e.poste || e.entreprise || 'une expérience'
  if (cv.titrePoste && cv.titrePoste.split(' ').length < 2) tips.push('Précisez le poste recherché : « Assistante comptable » dit plus que « Assistante ».')
  for (const e of cv.experiences) {
    if (!e.debut || !e.fin) tips.push(`Indiquez le mois et l’année de début et de fin pour « ${label(e)} ».`)
    else if (dateValue(e.debut) === null || dateValue(e.fin) === null) tips.push(`Écrivez les dates de « ${label(e)} » comme « mars 2021 ».`)
    if (e.taches.length === 0) tips.push(`Décrivez au moins deux tâches pour « ${label(e)} ».`)
  }
  const weak = cv.experiences.flatMap((e) => e.taches).find((task) => !startsWithVerb(task))
  if (weak) tips.push(`Commencez chaque tâche par un verbe d’action : « ${weak} » pourrait devenir « Accueillir… », « Gérer… », « Assurer… ».`)
  if (cv.experiences.some((e) => e.taches.some((task) => task.length > 140))) tips.push('Découpez les tâches trop longues : une idée par ligne.')
  if (cv.experiences.length === 0) tips.push('Ajoutez vos stages, emplois temporaires ou activités bénévoles : ils comptent comme expériences.')
  for (const f of [...cv.formations, ...cv.certifications]) if (!f.annee) tips.push(`Indiquez l’année d’obtention de « ${f.intitule || f.etablissement} ».`)
  if (!cv.competencesTechniques.length && !cv.savoirFaire.length) tips.push('Ajoutez vos compétences : logiciels, outils, savoir-faire.')
  if (!cv.langues.length) tips.push('Indiquez vos langues et votre niveau, par exemple « Français (maternel) ».')
  if (!squash(form.identite?.numeroPnpe)) tips.push('Inscrit(e) au PNPE (pnpe.ga) ? Ajoutez votre numéro d’identification dans l’en-tête.')
  if (!squash(form.identite?.email)) tips.push('Ajoutez une adresse e-mail professionnelle, du type prenom.nom@….')
  return tips.slice(0, 5)
}

// The whole CV, in the same shape as the AI's (backend/src/services/cvWriter.js).
export function writeCvLocally(form) {
  const { formations, certifications } = trainings(form.formations)
  const { techniques, savoirFaire } = skills(form.competences)
  const experiences = (form.experiences || [])
    .filter((e) => squash(e.poste) || squash(e.entreprise) || squash(e.description))
    .map(experience)
  const cv = {
    titrePoste: sentence(form.posteRecherche),
    experiences: newestFirst(experiences, experienceKey),
    formations,
    certifications,
    competencesTechniques: techniques,
    savoirFaire,
    langues: languages(form.langues),
  }
  cv.conseils = advice(form, cv)
  return cv
}

// ---- For the step-by-step form (CvBuilder.jsx) ---------------------------------

export const MONTH_NAMES = MONTHS

// « Mars 2021 » → { month: 2, year: '2021' }; month -1 when unknown.
export function parseMonthYear(text) {
  const t = normalizeDate(text)
  const year = (t.match(/(?:19|20)\d{2}/) || [''])[0]
  return { month: MONTHS.findIndex((m) => t.startsWith(m)), year }
}

export function isCertificate(intitule) {
  const key = fold(intitule)
  return !!key && !DIPLOMA.test(key) && CERTIFICATE.test(key)
}

// The skills a member typed, one by one (« Pack Office (Word, Excel) » stays whole).
export function splitSkills(text) {
  return String(text || '')
    .split(/\n|;|•|·/)
    .flatMap((line) => splitOutsideBrackets(line, ','))
    .map((s) => squash(s))
    .filter(Boolean)
}

export const sortSkills = skills

// Ideas the member can tap, after the job sought. Only offered, never added
// on their own: the member picks what is true for them.
const SKILL_IDEAS = [
  [/caiss|vend|commerc|boutique|supermarche/, ['Tenue de caisse', 'Encaissement', 'Accueil et conseil client', 'Mise en rayon', 'Prospection', 'Négociation commerciale', 'Fidélisation client']],
  [/compta|financ|banque|gestionnaire/, ['Saisie comptable', 'Sage', 'Excel', 'Rapprochement bancaire', 'Facturation', 'Déclarations fiscales et sociales']],
  [/secret|assistant|administr|accueil|reception|hotesse|standard/, ['Pack Office (Word, Excel)', 'Accueil physique et téléphonique', 'Rédaction de courriers', 'Classement et archivage', 'Gestion d’agenda', 'Saisie de données']],
  [/chauffeu|conduct|livr|transport|coursier/, ['Conduite de véhicules légers', 'Conduite de poids lourds', 'Entretien courant du véhicule', 'Livraison de marchandises', 'Respect du code de la route']],
  [/securit|gardien|vigile|surete/, ['Surveillance des locaux', 'Contrôle d’accès', 'Rondes de sécurité', 'Rédaction de mains courantes', 'Premiers secours']],
  [/electri/, ['Câblage électrique', 'Lecture de schémas électriques', 'Installation et dépannage', 'Habilitation électrique', 'Normes de sécurité électrique']],
  [/mecan|maintenance|technicien/, ['Maintenance préventive', 'Diagnostic de pannes', 'Lecture de plans', 'Soudure', 'GMAO']],
  [/informat|developp|reseau|web|digital|it\b/, ['Maintenance informatique', 'Réseaux informatiques', 'Windows', 'Pack Office', 'Développement web (HTML, CSS)', 'Assistance aux utilisateurs']],
  [/production|operat|petrol|mine|minier|usine/, ['Conduite d’installations', 'Respect des consignes HSE', 'Contrôle qualité', 'Relevé des paramètres de production', 'Rédaction de rapports de quart']],
  [/cuisin|restau|serveu|hotel|boulang|patiss|barman/, ['Préparation des repas', 'Hygiène alimentaire (HACCP)', 'Service en salle', 'Gestion des stocks alimentaires', 'Accueil des clients']],
  [/enseign|professeur|formateu|educat|instit/, ['Préparation des cours', 'Animation de classe', 'Évaluation des élèves', 'Suivi des élèves']],
  [/infirm|sante|soign|medic|pharmac|sage-femme/, ['Soins infirmiers', 'Prise des constantes', 'Accueil des patients', 'Hygiène hospitalière', 'Gestion des dossiers patients']],
  [/logisti|stock|manutention|entrepot|magasinier/, ['Gestion de stock', 'Inventaire', 'Réception des marchandises', 'Conduite de chariot élévateur', 'Préparation de commandes']],
  [/btp|macon|batiment|chantier|menuis|plomb|peint|carrel/, ['Lecture de plans', 'Maçonnerie', 'Coffrage et ferraillage', 'Pose de carrelage', 'Règles de sécurité sur chantier']],
  [/menag|entretien|nettoy|chambre/, ['Nettoyage des locaux', 'Utilisation des produits d’entretien', 'Repassage', 'Tri des déchets']],
  [/marketing|communic|community|reseaux sociaux/, ['Gestion des réseaux sociaux', 'Canva', 'Rédaction de contenus', 'Organisation d’événements', 'Prospection']],
]
const GENERAL_IDEAS = ['Pack Office (Word, Excel)', 'Internet et messagerie', 'Accueil et relation client', 'Rédaction de rapports', 'Classement et archivage', 'Gestion de stock']

export function skillSuggestions(poste) {
  const key = fold(poste)
  const found = SKILL_IDEAS.filter(([pattern]) => key && pattern.test(key)).flatMap(([, ideas]) => ideas)
  return dedupe([...found, ...GENERAL_IDEAS])
}

// How complete the CV is, 0 to 100: the PNPE's sections, weighted.
export function cvCompleteness(form) {
  const id = form?.identite || {}
  const exps = (form?.experiences || []).filter((e) => squash(e.poste) || squash(e.entreprise))
  const checks = [
    [!!squash(id.nom), 8],
    [!!squash(id.telephones), 8],
    [!!squash(id.email), 5],
    [!!squash(id.ville), 4],
    [!!squash(form?.posteRecherche), 10],
    [exps.length > 0, 10],
    [exps.length > 0 && exps.every((e) => squash(e.debut) && (e.enCours || squash(e.fin))), 10],
    [exps.length > 0 && exps.every((e) => splitTasks(e.description).length >= 2), 10],
    [(form?.formations || []).some((f) => squash(f.intitule)), 15],
    [splitSkills(form?.competences).length >= 3, 10],
    [(form?.langues || []).some((l) => squash(l.langue)), 10],
  ]
  return checks.reduce((sum, [ok, weight]) => sum + (ok ? weight : 0), 0)
}

// A skill as it will print: « excel » → « Excel », « gestion de stock » → « Gestion de stock ».
export const tidySkill = (text) => sentence(text, { names: true })
