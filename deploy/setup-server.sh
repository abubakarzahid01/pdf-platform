#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for EditBee. Run as root from this folder:
#   bash setup-server.sh
# Safe to run again: each step checks what is already done.
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" = 0 ] || { echo "Run this as root." >&2; exit 1; }
. /etc/os-release
[ "$VERSION_ID" = "24.04" ] || echo "Warning: written for Ubuntu 24.04, this is $PRETTY_NAME." >&2
export DEBIAN_FRONTEND=noninteractive
step() { printf '\n== %s\n' "$*"; }

step "System updates and basic tools"
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install nginx ufw git curl ca-certificates gnupg openssl unattended-upgrades
# Security updates install themselves every day.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

step "Swap (spare memory for big conversions and builds)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show

step "Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get -y -q install nodejs
fi
node -v

step "LibreOffice and fonts"
# Carlito and Caladea have the same measurements as Calibri and Cambria, and Liberation as
# Arial, Times New Roman and Courier New, so Office layouts keep their line and page breaks.
apt-get -y -q install --no-install-recommends \
  libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui \
  fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation fonts-liberation2 \
  fonts-dejavu-core fonts-noto-core fonts-noto-cjk

step "App user and folders"
id editbee > /dev/null 2>&1 || useradd --system --create-home --home-dir /home/editbee --shell /bin/bash editbee
install -d -o editbee -g editbee /srv/editbee
# Root runs these, so they live where the app user can't change them.
install -m 0755 deploy.sh /usr/local/sbin/editbee-deploy
install -m 0755 cloudflare-ips.sh /usr/local/sbin/editbee-cloudflare-ips

step "GitHub access key (read-only, for downloading the code)"
key=/home/editbee/.ssh/github
if [ ! -f "$key" ]; then
  sudo -u editbee -H mkdir -p -m 0700 /home/editbee/.ssh
  sudo -u editbee -H ssh-keygen -q -t ed25519 -N "" -C "editbee-server deploy key" -f "$key"
fi
sudo -u editbee -H tee /home/editbee/.ssh/config > /dev/null <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github
  IdentitiesOnly yes
EOF
# Only trust GitHub's real key (fingerprint published at docs.github.com, "GitHub's SSH key fingerprints").
github_fp="SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"
scan=$(ssh-keyscan -t ed25519 github.com 2>/dev/null)
if [ "$(echo "$scan" | ssh-keygen -lf - | awk '{print $2}')" = "$github_fp" ]; then
  echo "$scan" | sudo -u editbee -H tee /home/editbee/.ssh/known_hosts > /dev/null
else
  echo "GitHub's key didn't match its published fingerprint; not trusting it." >&2
  exit 1
fi

step "Services"
install -m 0644 editbee-web.service editbee-converter.service /etc/systemd/system/
systemctl daemon-reload
# They start after the first deploy, once the code is there.
systemctl enable editbee-web editbee-converter

step "HTTPS certificate"
install -d -m 0700 /etc/ssl/editbee
if [ ! -f /etc/ssl/editbee/origin.key ]; then
  # The private key is made here and never leaves the server; Cloudflare only gets the request (CSR).
  openssl req -new -newkey rsa:2048 -nodes -subj "/CN=editbee.online" \
    -keyout /etc/ssl/editbee/origin.key -out /etc/ssl/editbee/origin.csr 2> /dev/null
  chmod 600 /etc/ssl/editbee/origin.key
fi
if [ ! -f /etc/ssl/editbee/origin.pem ]; then
  # A temporary certificate so nginx can start; replaced by Cloudflare's origin certificate.
  openssl req -x509 -days 30 -subj "/CN=editbee.online" \
    -key /etc/ssl/editbee/origin.key -out /etc/ssl/editbee/origin.pem 2> /dev/null
fi

step "nginx"
touch /etc/nginx/cloudflare-realip.conf
install -m 0644 nginx-editbee.conf /etc/nginx/sites-available/editbee
ln -sf /etc/nginx/sites-available/editbee /etc/nginx/sites-enabled/editbee
rm -f /etc/nginx/sites-enabled/default

step "Firewall: SSH from anywhere, the website only through Cloudflare"
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH > /dev/null
/usr/local/sbin/editbee-cloudflare-ips
ufw --force enable
cat > /etc/cron.weekly/editbee-cloudflare-ips <<'EOF'
#!/bin/sh
/usr/local/sbin/editbee-cloudflare-ips > /dev/null
EOF
chmod 0755 /etc/cron.weekly/editbee-cloudflare-ips
nginx -t
systemctl restart nginx

step "SSH: key logins only"
if grep -qE '^(ssh-|ecdsa-)' /root/.ssh/authorized_keys 2> /dev/null; then
  # 10- sorts before the provider's own files, so these settings win.
  cat > /etc/ssh/sshd_config.d/10-editbee.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t
  systemctl reload ssh
  echo "Password logins are off; your SSH key still works."
else
  echo "No SSH key found for root, so password logins were left on." >&2
fi

step "Checking LibreOffice"
check=$(sudo -u editbee mktemp -d)
echo "EditBee test" | sudo -u editbee tee "$check/test.txt" > /dev/null
sudo -u editbee env HOME="$check" soffice --headless --convert-to pdf --outdir "$check" "$check/test.txt" > /dev/null 2>&1 || true
if [ -f "$check/test.pdf" ]; then echo "LibreOffice works."; else echo "LibreOffice could not convert a test file." >&2; fi
rm -rf "$check"

step "Done. Two things are needed next:"
echo
echo "1. Add this key to GitHub (repository Settings > Deploy keys > Add deploy key, leave 'Allow write access' off):"
echo
cat "$key.pub"
echo
echo "2. Create the Cloudflare origin certificate from this request (SSL/TLS > Origin Server > Create Certificate >"
echo "   'Use my private key and CSR'), then save the certificate it gives you as /etc/ssl/editbee/origin.pem:"
echo
cat /etc/ssl/editbee/origin.csr
echo
echo "Then run: editbee-deploy"
