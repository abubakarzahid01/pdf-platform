#!/usr/bin/env bash
# Fetches Cloudflare's published address ranges, then:
#   - lets only those ranges reach ports 80 and 443 (firewall), and
#   - tells nginx to trust Cloudflare's note of each visitor's real address.
# Run by setup-server.sh, and weekly by cron in case Cloudflare adds ranges.
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsS --max-time 30 https://www.cloudflare.com/ips-v4 -o "$tmp/v4"
curl -fsS --max-time 30 https://www.cloudflare.com/ips-v6 -o "$tmp/v6"

# Keep only lines that really are address ranges, so a bad download can't inject anything.
grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$' "$tmp/v4" > "$tmp/ranges" || true
grep -E '^[0-9a-f:]+/[0-9]{1,3}$' "$tmp/v6" >> "$tmp/ranges" || true
count=$(wc -l < "$tmp/ranges")
if [ "$count" -lt 10 ]; then
  echo "Only $count Cloudflare ranges downloaded; leaving the current settings alone." >&2
  exit 1
fi

{
  echo "# Written by cloudflare-ips.sh. Do not edit by hand."
  while read -r range; do echo "set_real_ip_from $range;"; done < "$tmp/ranges"
  echo "real_ip_header CF-Connecting-IP;"
} > /etc/nginx/cloudflare-realip.conf

while read -r range; do
  ufw allow proto tcp from "$range" to any port 80,443 comment cloudflare > /dev/null
done < "$tmp/ranges"

if systemctl is-active --quiet nginx; then nginx -t -q && systemctl reload nginx; fi
echo "Cloudflare ranges applied: $count"
