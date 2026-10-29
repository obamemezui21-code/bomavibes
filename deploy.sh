#!/bin/bash
set -e

echo "🚀 Déploiement BomaVibes..."

cd /var/www/bomavibes

echo "📥 Récupération du code..."
# npm regenerates these lockfiles slightly on install (platform-specific
# optional deps) — always safe to discard before pulling, never a real
# hand-made change since nothing is ever committed directly on the server.
git checkout -- backend/package-lock.json frontend-web/package-lock.json 2>/dev/null || true
git pull origin main

echo "🔧 Backend..."
cd backend
npm install

echo "🔐 Règles Firestore..."
# Publishes frontend-web/firestore.rules with the backend's Firebase Admin
# credentials (skipped when already up to date). A failure here must not
# block the rest of the deploy — the previous rules simply stay live.
node scripts/deployFirestoreRules.js || echo "⚠️  Règles Firestore non publiées (voir le message ci-dessus) — le déploiement continue."

pm2 restart kani-api

echo "🎨 Frontend..."
cd ../frontend-web
npm install
npm run build

echo "📦 Copie du build..."
# The previous build's files stay a week: a tab opened before this deploy
# still asks for them when the member opens another page (deleting them first
# left that page stuck, and the whole site empty while the copy ran).
# index.html goes last, once everything it points to is in place.
mkdir -p /var/www/html/assets
cp -r dist/assets/. /var/www/html/assets/
find dist -mindepth 1 -maxdepth 1 ! -name assets ! -name index.html -exec cp -r {} /var/www/html/ \;
cp dist/index.html /var/www/html/index.html
find /var/www/html/assets -type f -mtime +7 -delete

echo "⚡ HTTP/2..."
bash ../deployment/enable-http2.sh || echo "⚠️  HTTP/2 non activé (voir le message ci-dessus) — le déploiement continue."

echo "✅ Déploiement terminé !"









