#!/bin/bash

echo "🚀 Déploiement BomaVibes..."

cd /var/www/bomavibes

echo "📥 Récupération du code..."
git pull origin main

echo "🔧 Backend..."
cd backend
npm install
pm2 restart kani-api

echo "🎨 Frontend..."
cd ../frontend-web
npm install
npm run build

echo "📦 Copie du build..."
rm -rf /var/www/html/*
cp -r dist/* /var/www/html/

echo "✅ Déploiement terminé !"









