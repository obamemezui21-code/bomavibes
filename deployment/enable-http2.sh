#!/bin/bash
# Turns HTTP/2 on in BomaVibes' nginx site (run by deploy.sh; does nothing
# once it's on). Over HTTP/1.1 a browser fetches 6 files at a time, each new
# connection paying its own TLS handshake: on a mobile connection the app's
# ~100 files arrived as a long waterfall (measured 2026-10-29). HTTP/2 sends
# them all over one connection.
#
# Safe by design: the site file is backed up, nginx checks the new config
# (nginx -t) before reloading, and the backup is put back if the check fails.
set -euo pipefail

SITE=/etc/nginx/sites-enabled/bomavibes

if [ ! -e "$SITE" ]; then
    echo "Pas de $SITE : rien à faire."
    exit 0
fi
if grep -Eq 'listen[^;]*443[^;]*http2|^[[:space:]]*http2[[:space:]]+on' "$SITE"; then
    exit 0 # already on
fi
if ! grep -Eq 'listen[^;]*443[^;]*ssl' "$SITE"; then
    echo "Aucune ligne « listen 443 ssl » dans $SITE : HTTP/2 non activé."
    exit 0
fi
if [ ! -w "$SITE" ]; then
    echo "Pas le droit de modifier $SITE (lancer en root) : HTTP/2 non activé."
    exit 1
fi

BACKUP="/root/nginx-bomavibes.$(date +%Y%m%d%H%M%S).bak"
cp --dereference "$SITE" "$BACKUP"

# nginx 1.24 (Ubuntu 24.04): "listen 443 ssl http2;" (http2 is a listen option before 1.25).
sed -i --follow-symlinks -E 's/(listen[[:space:]]+(\[::\]:)?443[[:space:]]+ssl)([[:space:];])/\1 http2\3/' "$SITE"

if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo "HTTP/2 activé (sauvegarde : $BACKUP)."
else
    cp "$BACKUP" "$(readlink -f "$SITE")"
    nginx -t
    echo "La configuration avec HTTP/2 a été refusée par nginx : l'ancienne est remise."
    exit 1
fi
