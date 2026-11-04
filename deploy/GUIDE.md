# Putting EditBee live

The setup: **Hostinger VPS** (Ubuntu 24.04) runs the site and the converter, **Cloudflare** (free plan) sits
in front for DNS, HTTPS and protection, and the domain **editbee.online** is registered at Hostinger.

```
visitor ── HTTPS ──> Cloudflare ── HTTPS (origin certificate) ──> nginx on the VPS
                                                                   ├─ /            → website  (127.0.0.1:3000)
                                                                   └─ /converter/  → converter (127.0.0.1:4000)
```

The firewall lets only Cloudflare reach ports 80 and 443, so nobody can bypass it. SSH (port 22) stays open,
key logins only.

## Files in this folder

| File | What it does |
|---|---|
| `setup-server.sh` | One-time setup: updates, Node.js 22, LibreOffice and fonts, app user, firewall, nginx, services |
| `deploy.sh` | Downloads the latest code from GitHub, builds it and restarts (installed as `editbee-deploy`) |
| `cloudflare-ips.sh` | Keeps the firewall and nginx in step with Cloudflare's addresses (runs weekly) |
| `nginx-editbee.conf` | Web server: HTTPS, `www` → main address, converter route, rate limit |
| `editbee-web.service`, `editbee-converter.service` | Keep the site and converter running and restart them if they stop |

## Steps

### 1. First setup (once)

From the project folder on the PC, copy this folder to the server and run the setup
(replace `SERVER_IP`):

```bash
scp -r deploy root@SERVER_IP:/root/editbee-setup
ssh root@SERVER_IP "bash /root/editbee-setup/setup-server.sh"
```

It ends by printing a **GitHub deploy key** and a **certificate request (CSR)**.

### 2. Let the server download the code

GitHub → the `pdf-platform` repository → **Settings → Deploy keys → Add deploy key**. Title `editbee-server`,
paste the key, leave **Allow write access** off, and save.

### 3. Point the domain at the server (Cloudflare → DNS → Records)

- **A** record: name `@`, IPv4 address = the server's IP, **Proxied** (orange cloud).
- **AAAA** record (only if the VPS has an IPv6 address): name `@`, the IPv6 address, **Proxied**.
- The **CNAME** `www` → `editbee.online` record is already there; keep it **Proxied**.

### 4. HTTPS between Cloudflare and the server

1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate**.
2. Choose **Use my private key and CSR**, paste the CSR from step 1, keep the hostnames
   `editbee.online` and `*.editbee.online`, validity 15 years, and create it.
3. Save the certificate on the server as `/etc/ssl/editbee/origin.pem` (it's public, not a secret), then
   `systemctl reload nginx`.
4. Cloudflare → **SSL/TLS → Overview**: set the mode to **Full (strict)**.
5. **SSL/TLS → Edge Certificates**: turn on **Always Use HTTPS**, set **Minimum TLS Version** to **1.2**.

### 5. Go live

```bash
ssh root@SERVER_IP editbee-deploy
```

It ends with "Live: website and converter are running." Then open https://editbee.online.

## Later updates

After pushing new code to GitHub: `ssh root@SERVER_IP editbee-deploy`

## Useful commands (on the server)

| Task | Command |
|---|---|
| Are the services running? | `systemctl status editbee-web editbee-converter` |
| Recent logs | `journalctl -u editbee-web -u editbee-converter -n 100` |
| Converter health | `curl http://127.0.0.1:4000/health` |
| Firewall rules | `ufw status` |

## Limits on the live site

- Office conversions: 50 MB per file, 90 seconds per file (Cloudflare stops any request at 100 seconds).
- About 10 conversions a minute per visitor, with short bursts allowed; above that they're asked to wait.
- The converter can't use more than 3 GB of memory, so the website keeps running during big conversions.
