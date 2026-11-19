# EDU-CHECK — assistant de vérification des devoirs

Module indépendant de BomaVibes (`backend/src/eduCheck/`, page `/edu-check`,
rubrique « Outils pédagogiques » des Salons). Il aide les enseignants à
examiner un devoir : indices de rédaction assistée par IA, qualité
rédactionnelle, sources, cohérence, niveau, style.

> Les résultats constituent des indicateurs et ne permettent pas d’établir
> avec certitude l’utilisation d’une intelligence artificielle. Une évaluation
> humaine reste indispensable. Aucune sanction automatique.

## Ce qui tourne, et ce qui coûte

| Niveau | Quoi | Coût |
|---|---|---|
| 1 — local | Lecture PDF / DOCX / TXT, statistiques, indices de style, qualité, cohérence, niveau, comparaison | Gratuit (Node.js sur le serveur) |
| 2 — IA (facultatif) | `ai/provider.js` : interface prête, **désactivée**. Rien n’est envoyé à un modèle. | Aucun tant qu’il n’est pas branché |
| 3 — sources | DOI → Crossref, titre → OpenAlex, mis en cache 30 jours | Gratuit (API publiques) |

Seules les **références** partent vers Crossref / OpenAlex, jamais le devoir.
Les liens donnés par l’étudiant ne sont **jamais ouverts** par le serveur.

## Fichiers

```
eduCheck/
  config.js                  limites, niveaux, avertissement
  access.js                  rôles et permissions
  text.js                    mots, phrases, paragraphes, langue
  documentParser.js          PDF (unpdf), DOCX (mammoth), TXT — contrôle du vrai contenu
  analysis/aiWriting.js      AIWritingAnalysisService
  analysis/writingQuality.js WritingQualityService
  analysis/relevance.js      AssignmentRelevanceService
  analysis/academicLevel.js  niveau académique
  analysis/styleComparison.js StudentStyleComparisonService + mode comparaison
  sources/sourceVerification.js SourceVerificationService
  ai/provider.js             moteur IA facultatif (désactivé)
  engine.js                  enchaîne les étapes (progression réelle)
  controller.js, routes.js   API /api/edu-check
  engine.test.js             tests (npm test)
```

Le rapport PDF (PDFReportService) est produit sur l’appareil de l’enseignant :
`frontend-web/src/lib/eduCheckPdf.js`.

## API (`/api/edu-check`, connexion obligatoire)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/me` | accès, limites, niveaux (répond même sans accès) |
| POST | `/parse` | lit un fichier (multipart `file`), renvoie son texte ; le fichier n’est pas gardé |
| POST | `/analyses` | lance une analyse → `202 { id }` |
| GET | `/analyses/:id` | état, étapes, résultat |
| GET | `/analyses` | historique filtré (`student, className, subject, teacher, from, to, band`) |
| DELETE | `/analyses/:id` | supprime l’analyse et le texte |
| POST | `/compare` | compare 2 à 5 textes (non conservés) |
| GET | `/dashboard` | chiffres et évolution mensuelle |

## Accès et rôles

L’accès est accordé par script (Admin SDK) — aucune route ne permet de se
l’attribuer, et la collection `eduCheckMembers` n’est ouverte par aucune règle
Firestore :

```bash
cd backend
node scripts/setEduRole.js enseignant@ecole.ga teacher "Lycée Léon Mba"
node scripts/setEduRole.js responsable@ecole.ga lead "Lycée Léon Mba"
node scripts/setEduRole.js enseignant@ecole.ga none      # retirer l’accès
```

- **teacher** : ses propres analyses uniquement.
- **lead** (chargé pédagogique, responsable) : aussi celles de son
  établissement (même nom d’établissement).
- Un admin complet de BomaVibes peut l’utiliser comme enseignant (ses propres
  analyses seulement).

## Données (Firestore, serveur uniquement)

- `eduCheckMembers/{uid}` : rôle, établissement.
- `eduCheckAnalyses/{id}` : métadonnées, texte du devoir, résultat ; supprimé
  après `EDU_CHECK_RETENTION_DAYS` jours (purge à la lecture de l’historique)
  ou à la demande. Les travaux antérieurs servent à une analyse et ne sont
  jamais enregistrés.
- `eduCheckLogs` : journal (qui, quoi, quand), sans aucun texte.
- `eduCheckSourceCache` : résultats Crossref / OpenAlex, 30 jours.

Aucune migration ni règle Firestore à publier : ces collections sont fermées
aux clients par défaut. Les devoirs ne servent à entraîner aucun modèle.

## Variables d’environnement (toutes facultatives)

| Variable | Défaut | Rôle |
|---|---|---|
| `EDU_CHECK_MAX_FILE_MB` | 5 | taille maximale d’un fichier importé |
| `EDU_CHECK_MAX_WORDS` | 20000 | longueur maximale d’un texte |
| `EDU_CHECK_MIN_WORDS` | 150 | en dessous : « Analyse non concluante » pour le style |
| `EDU_CHECK_RETENTION_DAYS` | 180 | durée de conservation des analyses |
| `EDU_CHECK_MAX_SOURCE_LOOKUPS` | 15 | recherches de sources par analyse |
| `EDU_CHECK_SOURCE_VERIFICATION` | (activée) | `off` : aucune requête vers Crossref / OpenAlex |
| `EDU_CHECK_AI_PROVIDER` | (aucun) | réservé au moteur IA facultatif (non branché) |
| `EDU_CHECK_ISGENAI` | (activé) | `off` : la case « avis d’isGenAI » disparaît, aucun texte n’est envoyé |
| `EDU_CHECK_ML_ENGINE` | `off` | `binoculars` : active l’estimation par modèle de langage (voir « Moteur ML ») |
| `EDU_CHECK_ML_OBSERVER` / `_PERFORMER` | Qwen2.5-0.5B / -Instruct (ONNX) | les deux modèles de Binoculars |
| `EDU_CHECK_ML_DTYPE` | `q8` | quantification des modèles (`q8` ≈ 512 Mo chacun) |
| `EDU_CHECK_ML_THREADS` | 2 | cœurs utilisés par le moteur (le reste sert l’application) |
| `EDU_CHECK_ML_MAX_TOKENS` / `_MAX_WINDOWS` | 320 / 4 | taille d’un passage lu, nombre de passages par devoir |
| `EDU_CHECK_ML_HIGH` / `_MODERATE` | 0.8 / 0.9 | seuils (mesurés, voir « Moteur ML ») |
| `EDU_CHECK_ML_IDLE_MINUTES` | 10 | modèles déchargés de la mémoire après ce délai sans analyse |
| `EDU_CHECK_ML_CACHE_DIR` | `~/.cache/bomavibes-models` | où les modèles sont téléchargés (une fois) |

## Détection IA : trois moteurs, trois résultats séparés

Jamais additionnés, jamais fusionnés en un score.

### A. Preuves de provenance (`provenance/`)
- **Recherche locale** (toujours) : déclarations (« rédigé avec l’aide de
  ChatGPT »), traces d’outil (`utm_source=chatgpt.com`, `【4†source】`,
  `contentReference[oaicite…]`, liens de partage de conversation), phrases
  d’assistant restées dans le texte (« Bien sûr ! Voici… », « [Votre nom] »).
  Un outil n’est nommé que si la preuve le nomme. Une simple mention d’un
  outil (devoir qui parle d’IA) reste du contexte : indication faible.
- **isGenAI** (`POST https://isgenai.com/v1/check`, sans clé, `privacy:
  private`, `public_receipt: false`) : seulement si l’enseignant coche la case
  pour cette analyse. Le texte (16 000 premiers caractères) part alors chez
  isGenAI, qui indique pouvoir le transmettre à son prestataire (DeepSeek).
  isGenAI lit des preuves, pas le style. Testé le 18/11/2026 : il reconnaît
  « Drafted with ChatGPT » mais pas la même déclaration en français. S’il est
  indisponible ou saturé, la recherche locale reste seule.
- Limite : un texte recopié ou reformulé ne garde aucune preuve ; l’absence de
  preuve ne montre rien.

### B. Moteur ML (`ml/`) — désactivé par défaut
Binoculars (Hans et al., 2024) : perplexité / perplexité croisée de deux
modèles ouverts (Qwen2.5-0.5B et Qwen2.5-0.5B-Instruct, Apache 2.0, ONNX q8,
~512 Mo chacun), dans un *worker thread* (le serveur de l’application n’est
jamais bloqué), un devoir à la fois, déchargé après 10 min sans analyse.
Zéro-shot : entraîné sur aucun chatbot, il ne reconnaît pas le fournisseur.

Avant de l’activer : vérifier le VPS (≥ 2 Go de RAM libres en plus des
services, disque ≥ 2 Go pour les modèles). Puis :

```bash
cd /var/www/bomavibes/backend && npm install @huggingface/transformers@3.7.6
# .env : EDU_CHECK_ML_ENGINE=binoculars   puis   pm2 restart kani-api
```

(Le paquet doit aussi être ajouté à `package.json`, sinon le prochain
déploiement le retire.)

Mesures (18/11/2026, PC Pentium N5030, 8 Go) : ~1,5 Go de RAM avec les deux
modèles, ~3 min par passage de 300 tokens. Corpus : 38 textes français, 24
humains d’avant 2022 (12 critiques Allociné, 12 extraits de Wikipédia) et 14
textes écrits par Claude dans 6 registres (dissertation, commentaire, copie
d’élève, rapport, encyclopédie, critique).

| Score Binoculars | humains | Claude |
|---|---|---|
| min · médiane · max | 0,74 · 1,10 · 1,32 | 0,87 · 1,05 · 1,28 |

AUC 0,64 seulement (0,5 = hasard). Au seuil 0,9 : 4 textes d’IA sur 14
repérés, 1 texte humain sur 24 signalé à tort (une critique pleine de fautes,
à 0,74). Au seuil 1,0 : 7 sur 14, mais 3 humains sur 24. **Conclusion : avec
ces modèles de 0,5 milliard de paramètres, le moteur B n’est pas assez
fiable en français pour être activé.** Pistes : une paire plus grosse
(Qwen2.5-1.5B, ~3,5 Go de RAM, 3 fois plus lente) ou le profil français de
`linagora/binoculars-eu` (Luciole 1B, Python, AUC 0,96 annoncée mais mesurée
sur des textes de Luciole seulement) — à mesurer sur ce même corpus avant
toute activation. Textes de ChatGPT, Gemini, DeepSeek : non testés.

Écarté après mesure : le classifieur XLM-R `mujian2026/multilingual-ai-text-detector`
(MIT) répond « humain » à 99,9 % sur les 38 textes, y compris les 14 de Claude
(il n’a été entraîné qu’en anglais, chinois et vietnamien).

### C. Analyse stylistique (`analysis/aiWriting.js`)
Règles locales (uniformité, formules, transitions…). Sur le même corpus, elle
range plutôt bien les textes qu’elle peut lire (AUC 0,89 sur 23 textes ; 15
extraits de ~200 mots sont « non concluants ») mais ne dépasse pas 27/100 sur
les textes de Claude : elle repère le style caricatural, pas une IA bien
utilisée.

## Limites connues

- L’indice IA est une heuristique sur le style, pas une probabilité. Il baisse
  quand un texte généré est fortement reformulé, et monte un peu sur les textes
  très structurés (moins pris en compte aux niveaux licence et master).
- Orthographe et grammaire : contrôle partiel (fautes fréquentes d’une liste),
  pas de correcteur complet.
- Les contradictions et la justesse des idées ne sont pas évaluées.
- Français et anglais seulement ; PDF scannés (images) non lus.
- Une source absente de Crossref / OpenAlex n’est pas forcément fausse.
