#!/bin/bash
# Members' photos used to be served only with a signed cookie, checked by
# nginx (an anti-screenshot measure, removed on 30/10/2026: photos asked for
# before the cookie were refused and browsers kept that refusal a day).
#
# protect-uploads.sh off   takes the nginx rules out again (run by deploy.sh;
#                          does nothing once they're gone). The site file is
#                          backed up and nginx checks the config (nginx -t)
#                          before reloading; it's put back if the check fails.
set -euo pipefail

SITE=/etc/nginx/sites-enabled/bomavibes
SNIPPET=/etc/nginx/snippets/bomavibes-uploads.conf
INCLUDE="include $SNIPPET;"

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
    off) step_off ;;
    # Called by the deploy.sh of before the removal: nothing to do any more.
    secret | nginx) exit 0 ;;
    *)
        echo "Usage : $0 off"
        exit 2
        ;;
esac
