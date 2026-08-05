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
npm ci
pm2 restart kani-api

echo "🎨 Frontend..."
cd ../frontend-web
npm install
npm run build

echo "📦 Copie du build..."
rm -rf /var/www/html/*
cp -r dist/* /var/www/html/

echo "✅ Déploiement terminé !"









