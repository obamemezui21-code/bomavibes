# BomaVibes Campus — gestion des présences

Module indépendant de BomaVibes (`backend/src/campus/`, page `/campus`, rubrique
« Outils pédagogiques » des Salons). Première utilisation : INASS, Licence 1 (L1),
119 étudiants.

> **Le dépôt GitHub est public : aucun nom d’étudiant dans le code.** La liste
> officielle se garde dans `backend/private/campus/` (ignoré par git) et vit dans
> Firestore. Les tests n’utilisent que des noms inventés.

## Mise en service

1. Déployer (`deploy.sh`, comme d’habitude). Aucune règle Firestore ni index à
   ajouter : toutes les collections `campus*` sont fermées à l’application, seul le
   serveur y accède. Aucune dépendance nouvelle.
2. Importer la liste, au choix :
   - **dans l’application** : Campus → créer la classe L1 → Administration → Liste
     officielle → coller la liste → *Vérifier* → lire le rapport → *Importer* ;
   - **en ligne de commande**, dans `backend/` :
     `node scripts/importCampusRoster.js private/campus/INASS-L1-liste-officielle.txt`
     (contrôle seul, rien n’est écrit), puis la même commande avec `--apply`.
3. Administration → Matières et enseignants : les saisir (un agent peut aussi en
   ajouter en créant une séance).
4. Administration → Utilisateurs : donner les accès. La personne doit avoir un
   compte BomaVibes et une adresse e-mail vérifiée ; elle n’a **pas** besoin de
   profil de rencontre, la page `/campus` s’ouvre sans.

Les photos des feuilles papier sont dans `backend/private/campus-scans/` (à inclure
dans les sauvegardes). `CAMPUS_SCANS_DIR` change cet emplacement.

## Planning des cours

Chaque semaine a son planning (page *Planning*) : périodes, cours, enseignants,
évaluations, note de la direction. Il se modifie en touchant une case, et se reprend
d’une semaine à l’autre en une touche (une évaluation ou une annulation ne se
répète pas). Il reste en brouillon, visible du personnel seulement, jusqu’à ce que
quelqu’un le vérifie et le **publie**. Ensuite :

- le tableau de bord montre les cours du jour ; *Ouvrir la feuille* la crée avec la
  matière, l’enseignant et les horaires, sans aucun statut ; *Préparer les feuilles*
  ouvre toutes celles du jour ;
- les cours passés sans feuille validée sont listés (quatre dernières semaines) ;
  un cours qui n’a pas eu lieu se marque *annulé*, avec un motif ;
- les feuilles vierges du jour ou de la semaine s’impriment en un seul PDF ;
- une évaluation se distingue sur les feuilles, les fiches et les rapports.

Un planning saisi dans un fichier (`backend/private/campus/`, car il nomme des
enseignants) s’enregistre en brouillon avec `scripts/importCampusTimetable.js`.
Collection : `campusTimetables/{classe}_{lundi}`. La feuille d’un cours est retrouvée
par le jour, la matière et les heures : une feuille créée à la main compte aussi.

## Utilisation quotidienne (agent)

1. Depuis le tableau de bord, *Ouvrir la feuille* du cours. Hors planning :
   *Nouvelle séance* (matière, enseignant, date, horaires). La feuille des 119
   étudiants s’ouvre, sans aucun statut.
2. Facultatif : *Feuille vierge PDF* pour le cours ; après le cours, photographier
   ou importer la feuille papier, affichée à côté de la saisie.
3. Saisir. À l’ordinateur : `P`, `R`, `A` (ou 1, 2, 3) marquent et passent au
   suivant ; flèches, `Suppr`, `M` (motif), `/` (rechercher). Au téléphone : les
   trois boutons. L’enregistrement est automatique ; hors connexion, la saisie est
   gardée sur l’appareil et envoyée au retour du réseau.
4. *Valider la feuille* : récapitulatif, liste des non renseignés, confirmation.
5. Ensuite, *Corriger* demande un motif et garde l’ancienne valeur.

## Rôles

Les rôles de l’application (`users/{uid}.role`) ne changent pas. Ceux de Campus sont
dans `campusMembers`, comme EDU-CHECK (`eduCheckMembers`).

| | Administrateur | Agent pédagogique | Enseignant |
|---|---|---|---|
| Qui | admin BomaVibes, ou nommé par lui | nommé par un administrateur | idem, lié à un enseignant |
| Liste, classes, matières, utilisateurs, journal | oui | ajoute matière/enseignant | non |
| Créer, saisir, valider | oui | oui | non |
| Corriger après validation | toujours | les feuilles qu’il a validées, 7 jours | non |
| Modifier date/matière d’une feuille validée, l’annuler | oui, avec motif | non | non |
| Consulter | tout l’établissement | tout l’établissement | ses séances |
| Exporter, imprimer | oui | si autorisé | si autorisé |

## Règles de calcul

- Taux de présence = (présents + retards) / statuts renseignés.
- Taux d’absence = absents / statuts renseignés.
- Séances **validées** seulement. « Non renseigné » n’est ni présent ni absent.

## Données (Firestore, serveur seulement)

| Collection | Contenu |
|---|---|
| `campusClasses/{inass-l1}` | code, intitulé, effectif, version de la liste |
| `campusStudents/{ETU-XXXXXXXX}` | nom exact, n° d’importation, actif, anciennes orthographes |
| `campusImports` | chaque importation : rapport, ajouts, archivés |
| `campusSubjects`, `campusTeachers` | identifiant tiré du nom : pas de doublon |
| `campusSessions` | la séance, sa liste d’étudiants figée, les statuts |
| `campusSessionKeys` | une par classe + date + matière + heure : deux feuilles impossibles |
| `campusAudit` | toutes les modifications, jamais effacées |
| `campusMembers` | accès |

Nouvelle liste : un étudiant est reconnu seulement si le nom est le même (accents,
majuscules et ponctuation mis à part) ; il garde son identifiant et son historique.
Les autres sont ajoutés. Ceux qui ne sont plus sur la liste sont archivés, jamais
supprimés. Rien n’est fusionné : les noms proches sont signalés.

Une feuille n’est jamais supprimée : elle est *annulée*, avec un motif, et reste dans
les archives.

## Lecture automatique (OCR)

Non activée. Les noms et annotations manuscrits ne se lisent pas de façon fiable
avec les outils gratuits et locaux, et un service externe recevrait les noms des
étudiants. La photo sert de modèle à la saisie ; aucun statut n’en est tiré.

## Tests

```
cd backend
node --test src/campus/campus.test.js
java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --host 127.0.0.1 --port 8085
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --test src/campus/campus.emulator.test.js
cd ../frontend-web
npx vitest run src/lib/campus.test.js
npm run test:rules
```
