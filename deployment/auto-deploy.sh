#!/bin/bash
# Automatic deploys without GitHub Actions: run by cron on the VPS every few
# minutes (see deployment/README.md). When main on GitHub has moved past what
# is deployed, runs deploy.sh; otherwise does nothing.
set -euo pipefail

cd /var/www/bomavibes

# Never two deploys at once (a slow build overlapping the next cron tick).
exec 9>/tmp/bomavibes-auto-deploy.lock
flock -n 9 || exit 0

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nouvelle version ${REMOTE:0:7} — déploiement…"
if ./deploy.sh; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Déploiement ${REMOTE:0:7} terminé."
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ÉCHEC du déploiement ${REMOTE:0:7} — nouvel essai au prochain passage."
    exit 1
fi
