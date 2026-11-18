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

## Limites connues

- L’indice IA est une heuristique sur le style, pas une probabilité. Il baisse
  quand un texte généré est fortement reformulé, et monte un peu sur les textes
  très structurés (moins pris en compte aux niveaux licence et master).
- Orthographe et grammaire : contrôle partiel (fautes fréquentes d’une liste),
  pas de correcteur complet.
- Les contradictions et la justesse des idées ne sont pas évaluées.
- Français et anglais seulement ; PDF scannés (images) non lus.
- Une source absente de Crossref / OpenAlex n’est pas forcément fausse.
