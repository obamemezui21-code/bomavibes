# Appels de groupe et lives — serveur média LiveKit

Les appels à deux passent directement d'un téléphone à l'autre (voir
`coturn-setup.md`). Les appels de groupe (jusqu'à 8 personnes) passent par un
**serveur média LiveKit** installé sur le VPS : chaque téléphone envoie sa
vidéo une seule fois, le serveur la redistribue aux autres. Le backend donne à
chaque participant un accès temporaire (3 h) à la salle de son appel.

Le serveur tourne dans Docker, son point d'entrée passe par nginx :
`wss://bomavibes.tech/livekit` → `127.0.0.1:7880`. Pas de sous-domaine ni de
certificat en plus.

## 1. Installer et démarrer LiveKit

```bash
mkdir -p /etc/livekit
KEY="API$(openssl rand -hex 6)"
SECRET="$(openssl rand -hex 32)"
cat > /etc/livekit/livekit.yaml <<EOF
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true
keys:
  $KEY: $SECRET
room:
  empty_timeout: 60
  max_participants: 50
logging:
  level: info
EOF
docker run -d --name livekit --restart unless-stopped --network host \
  -v /etc/livekit/livekit.yaml:/livekit.yaml \
  livekit/livekit-server --config /livekit.yaml

sed -i '/^LIVEKIT_/d' /var/www/bomavibes/backend/.env
printf '\nLIVEKIT_URL="wss://bomavibes.tech/livekit"\nLIVEKIT_API_KEY="%s"\nLIVEKIT_API_SECRET="%s"\n' "$KEY" "$SECRET" >> /var/www/bomavibes/backend/.env
```

## 2. Ouvrir les ports du média

```bash
ufw allow 7881/tcp
ufw allow 50000:50100/udp
```

Les ajouter aussi dans le pare-feu du panneau de l'hébergeur s'il y en a un
(Hostinger : VPS › Pare-feu) : **TCP 7881** et **UDP 50000–50100**.
Le port 7880 reste fermé : nginx y accède en local.

## 3. Brancher nginx

```bash
cat > /etc/nginx/snippets/livekit.conf <<'EOF'
location /livekit/ {
    proxy_pass http://127.0.0.1:7880/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
}
EOF
SITE=/etc/nginx/sites-enabled/bomavibes
cp "$SITE" /root/bomavibes-nginx.bak
grep -q 'snippets/livekit.conf' "$SITE" || sed -i '0,/location \/api/s//include snippets\/livekit.conf;\n    location \/api/' "$SITE"
nginx -t && systemctl reload nginx || cp /root/bomavibes-nginx.bak "$SITE"
```

## 4. Relancer l'API

```bash
pm2 restart kani-api --update-env
```

## Vérifier

```bash
docker ps --filter name=livekit --format '{{.Status}}'   # "Up …"
curl -s https://bomavibes.tech/livekit/                   # "OK"
grep -c '^LIVEKIT_' /var/www/bomavibes/backend/.env       # 3
```

Puis dans l'app : ouvrir une conversation › bouton 👥 › choisir 2 matchs ›
Audio ou Vidéo. Les invités reçoivent une sonnerie « Appel de groupe ».

Les lives utilisent le même serveur : dans le **Fil**, une bande « En direct »
apparaît avec le bouton « Lancer un live » (profils vérifiés). Tant que
LIVEKIT_* manque dans backend/.env, les appels de groupe et les lives restent
cachés dans l'app.

Journaux du serveur média : `docker logs --tail 50 livekit`.
Mise à jour : `docker pull livekit/livekit-server && docker rm -f livekit`
puis relancer la commande `docker run` de l'étape 1.
