#!/bin/bash
# Members' photos (profile photos, chat attachments) are only served to a
# signed-in member: nginx checks the signed cookie the API hands out
# (backend/src/services/mediaCookie.js) with its secure_link module, so a
# copied link is useless outside the app and expires with the cookie (12 h).
#
# Run by deploy.sh in two steps:
#   protect-uploads.sh secret   before the API restarts: makes sure
#                               backend/.env has a MEDIA_SECRET
#   protect-uploads.sh nginx    once the new app is in place: writes the
#                               nginx rules with that secret and reloads nginx
#
# Safe by design: the site file is backed up, nginx checks the new config
# (nginx -t) before reloading, and everything is put back if the check fails
# (the photos then simply stay public, as before).
set -euo pipefail

APP=/var/www/bomavibes
ENV_FILE="$APP/backend/.env"
UPLOADS="$APP/uploads"
SITE=/etc/nginx/sites-enabled/bomavibes
SNIPPET=/etc/nginx/snippets/bomavibes-uploads.conf
INCLUDE="include $SNIPPET;"

secret() {
    grep -E '^MEDIA_SECRET=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2-
}

step_secret() {
    if [ -z "$(secret)" ]; then
        [ -s "$ENV_FILE" ] && [ -n "$(tail -c1 "$ENV_FILE")" ] && echo >> "$ENV_FILE"
        echo "MEDIA_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        echo "MEDIA_SECRET ajouté à $ENV_FILE."
    fi
}

location_for() {
    cat <<EOF
location ^~ /uploads/$1/ {
    alias $UPLOADS/$1/;
    secure_link \$cookie_bv_m_sig,\$cookie_bv_m_exp;
    secure_link_md5 "\$cookie_bv_m_exp\$cookie_bv_m_uid $2";
    if (\$secure_link = "") { return 403; }
    if (\$secure_link = "0") { return 403; }
    add_header Cache-Control "private, max-age=86400" always;
    add_header X-Content-Type-Options nosniff always;
}
EOF
}

step_nginx() {
    local key
    key="$(secret)"
    if [ -z "$key" ]; then
        echo "Pas de MEDIA_SECRET dans $ENV_FILE : photos non protégées."
        exit 1
    fi
    if [ ! -e "$SITE" ]; then
        echo "Pas de $SITE : photos non protégées."
        exit 0
    fi

    local wanted
    wanted="# BomaVibes — photos des membres réservées aux membres connectés (deployment/protect-uploads.sh)
$(location_for profile-photos "$key")
$(location_for chat-attachments "$key")"

    if [ -f "$SNIPPET" ] && [ "$(cat "$SNIPPET")" = "$wanted" ] && grep -qF "$INCLUDE" "$SITE"; then
        exit 0 # already in place
    fi

    local stamp site_file
    stamp=$(date +%Y%m%d%H%M%S)
    site_file="$(readlink -f "$SITE")"
    cp "$site_file" "/root/nginx-bomavibes.$stamp.bak"
    [ -f "$SNIPPET" ] && cp "$SNIPPET" "/root/nginx-bomavibes-uploads.$stamp.bak"

    mkdir -p "$(dirname "$SNIPPET")"
    printf '%s\n' "$wanted" > "$SNIPPET"
    chmod 600 "$SNIPPET"
    if ! grep -qF "$INCLUDE" "$SITE"; then
        # Right after the first "listen ... 443 ... ssl" line: inside the HTTPS server block.
        awk -v inc="    $INCLUDE" '{ print } !done && /listen[^;]*443[^;]*ssl/ { print inc; done = 1 }' "$site_file" > "$site_file.new"
        mv "$site_file.new" "$site_file"
    fi

    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        echo "Photos des membres protégées (sauvegarde : /root/nginx-bomavibes.$stamp.bak)."
    else
        cp "/root/nginx-bomavibes.$stamp.bak" "$site_file"
        if [ -f "/root/nginx-bomavibes-uploads.$stamp.bak" ]; then
            cp "/root/nginx-bomavibes-uploads.$stamp.bak" "$SNIPPET"
        else
            rm -f "$SNIPPET"
        fi
        nginx -t
        echo "nginx a refusé la protection des photos : l'ancienne configuration est remise."
        exit 1
    fi
}

# Takes the protection off again: photos are served to anyone with the link,
# as before. Same safeguards (backup, nginx -t, put back on failure).
step_off() {
    if [ ! -e "$SITE" ] || { ! grep -qF "$INCLUDE" "$SITE" && [ ! -f "$SNIPPET" ]; }; then
        exit 0 # nothing to take off
    fi
    local stamp site_file
    stamp=$(date +%Y%m%d%H%M%S)
    site_file="$(readlink -f "$SITE")"
    cp "$site_file" "/root/nginx-bomavibes.$stamp.bak"
    grep -vF "$INCLUDE" "$site_file" > "$site_file.new" || true
    mv "$site_file.new" "$site_file"
    if nginx -t 2>/dev/null; then
        rm -f "$SNIPPET"
        systemctl reload nginx
        echo "Protection des photos retirée (sauvegarde : /root/nginx-bomavibes.$stamp.bak)."
    else
        cp "/root/nginx-bomavibes.$stamp.bak" "$site_file"
        nginx -t
        echo "nginx a refusé la configuration sans protection : l'ancienne est remise."
        exit 1
    fi
}

case "${1:-}" in
    secret) step_secret ;;
    nginx) step_nginx ;;
    off) step_off ;;
    *)
        echo "Usage : $0 secret|nginx|off"
        exit 2
        ;;
esac
