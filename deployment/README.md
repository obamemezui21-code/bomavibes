# Déploiement BomaVibes

`deploy.sh` (à la racine du projet, sur le VPS dans `/var/www/bomavibes`)
fait tout le déploiement :

1. récupère la dernière version de `main` ;
2. installe le backend ;
3. **publie les règles Firestore** (`frontend-web/firestore.rules`) avec les
   identifiants Firebase Admin du backend — seulement si elles ont changé ;
4. redémarre le backend (`pm2 restart kani-api`) ;
5. construit le frontend et le copie dans `/var/www/html/`.

Lancement à la main :

```bash
cd /var/www/bomavibes && ./deploy.sh
```

## Déploiement automatique — choisir UNE des deux options

### Option A — le VPS vérifie tout seul (recommandée)

Toutes les 5 minutes, `deployment/auto-deploy.sh` regarde s'il y a une
nouvelle version sur GitHub et lance `deploy.sh` si c'est le cas. Ne dépend
pas de GitHub Actions (ni de sa facturation).

Installation (une seule fois, sur le VPS) :

```bash
cd /var/www/bomavibes && git pull origin main
chmod +x deploy.sh deployment/auto-deploy.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/bomavibes/deployment/auto-deploy.sh >> /var/log/bomavibes-deploy.log 2>&1") | crontab -
```

Vérifier : `crontab -l` doit afficher la ligne ; après un push,
`tail -f /var/log/bomavibes-deploy.log` montre le déploiement dans les
5 minutes.

Désactiver : `crontab -e` et supprimer la ligne `auto-deploy.sh`.

⚠️ Tout ce qui est poussé sur `main` part en ligne tout seul dans les
5 minutes.

### Option B — GitHub Actions

`.github/workflows/deploy.yml` se connecte au VPS et lance `deploy.sh` à
chaque push sur `main`. Il ne démarre plus depuis mi-août 2026 : le compte
GitHub est bloqué pour un problème de facturation. Régulariser la
facturation (GitHub › Settings › Billing and plans) suffit à le relancer.

Ne pas activer les deux options en même temps : deux déploiements
pourraient se lancer en parallèle.

## Règles Firestore

Publiées par `deploy.sh`. À la main :

```bash
cd /var/www/bomavibes/backend && npm run deploy-rules
```

Si Firebase refuse (message « permission » ou « PERMISSION_DENIED ») : le
compte de service du backend n'a pas le droit de publier des règles. Dans
Google Cloud Console › IAM, donner le rôle **Firebase Rules Admin** au
compte `firebase-adminsdk-…@bomavibes-cd139.iam.gserviceaccount.com`, ou
publier à la main dans la console Firebase (Firestore Database › Règles).

### Tester les règles avant de les publier

`frontend-web/rules-tests/` vérifie les règles dans l'émulateur Firestore
(matchs, messages et réactions, appels, publications). Nécessite Java 21+.

```bash
cd frontend-web && npm run test:rules
```

À lancer après chaque modification de `firestore.rules`, avant de les
recopier dans la console.

## Appels audio / vidéo

Serveur relais TURN (coturn) : voir `coturn-setup.md`.

## nginx : réglages appliqués par `deploy.sh`

Deux scripts, lancés à chaque déploiement, qui ne font rien quand c'est déjà
en place. Chacun sauvegarde la configuration dans `/root/`, la vérifie avec
`nginx -t` et remet l'ancienne si nginx la refuse.

- `enable-http2.sh` : active HTTP/2 sur le site.
- `protect-uploads.sh off` : retire les règles nginx de l'ancienne protection
  anti-capture des photos (cookie signé, supprimée le 30/10/2026 : les photos
  chargées avant le cookie étaient refusées et ce refus restait 24 h dans le
  cache du navigateur). Les photos sont servies à quiconque a le lien. Si un
  jour on la remet (voir le commit 1cd755b), ne mettre `Cache-Control` que sur
  les réponses 200 (pas `always`), charger les photos une fois le cookie en
  place, et rediriger www.bomavibes.tech vers bomavibes.tech.
