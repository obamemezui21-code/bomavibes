# Appels audio / vidéo — mise en service

Les appels passent en direct entre les deux téléphones (WebRTC). Quand c'est
impossible (réseaux mobiles, box, pare-feux), le son et l'image passent par un
**serveur relais TURN (coturn)** installé sur le VPS. Le backend distribue des
identifiants temporaires (6 h) pour ce relais : aucun mot de passe n'est écrit
dans l'app.

Sans l'étape 1, les appels fonctionnent déjà, mais une partie échouera
(surtout en 4G).

## 1. Installer coturn sur le VPS (Ubuntu / Debian)

```bash
sudo apt update && sudo apt install -y coturn
sudo sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn

# Secret partagé entre coturn et le backend — le copier, il sert à l'étape 2
openssl rand -hex 32
```

Remplacer tout le contenu de `/etc/turnserver.conf` par (mettre le secret
généré à la place de `COLLER_LE_SECRET`) :

```
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=COLLER_LE_SECRET
realm=bomavibes.tech
external-ip=187.77.100.93
min-port=49160
max-port=49200
total-quota=100
stale-nonce=600
no-cli
no-multicast-peers
no-tlsv1
no-tlsv1_1
# Empêche d'utiliser le relais pour atteindre le réseau interne du serveur
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
```

Ouvrir les ports puis démarrer :

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49160:49200/udp
sudo systemctl enable --now coturn
sudo systemctl restart coturn
sudo systemctl status coturn --no-pager
```

Si l'hébergeur a aussi un pare-feu dans son panneau (Hostinger, OVH…), y
ouvrir les mêmes ports.

## 2. Brancher le backend sur le relais

Ajouter dans `/var/www/bomavibes/backend/.env` :

```
TURN_SECRET="le même secret qu'à l'étape 1"
TURN_HOST="187.77.100.93"
```

Puis :

```bash
cd /var/www/bomavibes && ./deploy.sh
pm2 restart kani-api --update-env
```

## 3. Publier les règles Firestore

`deploy.sh` ne publie pas les règles. Dans la console Firebase :
**Firestore Database → Règles**, remplacer le contenu par celui de
`frontend-web/firestore.rules`, puis **Publier**.

Sans cette étape, les appels échouent avec une erreur de permission.

## Vérifier

- `curl -s -H "Authorization: Bearer <idToken>" https://bomavibes.tech/api/calls/ice-servers`
  doit renvoyer un serveur `turn:187.77.100.93:3478…` avec `username` et
  `credential`.
- Tester un appel entre un téléphone en 4G et un ordinateur en Wi-Fi.
- Test du relais seul : https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
  avec les `urls` / `username` / `credential` renvoyés ci-dessus → une ligne
  `relay` doit apparaître.
