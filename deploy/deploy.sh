#!/usr/bin/env bash
# Puts the latest code from GitHub live. Run on the server as root:  bash /srv/editbee/deploy.sh
# The first run downloads the code; later runs update it.
set -euo pipefail

APP=/srv/editbee/app
REPO=git@github.com:abubakarzahid01/pdf-platform.git
as_app() { sudo -u editbee -H "$@"; }

if [ ! -d "$APP/.git" ]; then
  as_app git clone --quiet "$REPO" "$APP"
else
  as_app git -C "$APP" pull --quiet --ff-only
fi
cd "$APP"
echo "Code at: $(as_app git log --oneline -1)"

as_app npm ci --no-audit --no-fund
# The site reaches the converter at /converter on its own address (see nginx-editbee.conf).
as_app env NEXT_PUBLIC_CONVERTER_URL=/converter NEXT_TELEMETRY_DISABLED=1 npm run build

systemctl restart editbee-converter editbee-web

# Check both are answering before saying it worked.
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/ && curl -fsS -o /dev/null http://127.0.0.1:4000/health; then
    echo "Live: website and converter are running."
    exit 0
  fi
  sleep 2
done
echo "Something didn't start. See: journalctl -u editbee-web -u editbee-converter -n 50" >&2
exit 1
