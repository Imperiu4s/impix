#!/usr/bin/env bash
# Impix telepítése Ubuntu 24.04 VPS-re. Egyszer kell lefuttatni, rootként:
#   sudo bash install.sh
# Többször is futtatható (frissíti a kódot, a meglévő beállításokat nem írja felül).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Imperiu4s/impix.git}"
APP_DIR=/opt/impix
ENV_FILE=/etc/impix.env

[ "$(id -u)" -eq 0 ] || { echo "Rootként futtasd: sudo bash install.sh"; exit 1; }

echo "==> Csomagok telepítése (nginx, certbot, git)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx git curl ca-certificates openssl

echo "==> Node.js ellenőrzése (22.13 vagy újabb kell a beépített SQLite-hoz)"
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Felhasználó és kód"
id impix >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin impix
mkdir -p "$APP_DIR"
chown impix:impix "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u impix git -C "$APP_DIR" pull --ff-only
else
  sudo -u impix git clone "$REPO_URL" "$APP_DIR"
fi
(cd "$APP_DIR" && sudo -u impix npm ci --omit=dev)

echo "==> Beállítások ($ENV_FILE)"
GENERATED_PASSWORD=""
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_EMAIL="${ADMIN_EMAIL:-}"
  if [ -z "$ADMIN_EMAIL" ]; then read -rp "Admin e-mail cím: " ADMIN_EMAIL; fi
  GENERATED_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-16)"
  umask 077
  cat > "$ENV_FILE" <<EOF
PORT=3000
TRUST_PROXY=1
IMPIX_DB=/var/lib/impix/impix.db
CORS_ORIGINS=https://www.impix.hu,https://impix.hu,https://imperiu4s.github.io
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$GENERATED_PASSWORD
EOF
  chmod 600 "$ENV_FILE"
else
  echo "   ($ENV_FILE már létezik, nem írom felül)"
fi

echo "==> systemd szolgáltatás"
install -m 644 "$APP_DIR/deploy/impix.service" /etc/systemd/system/impix.service
systemctl daemon-reload
systemctl enable impix
systemctl restart impix

echo "==> nginx"
# Csak első telepítéskor: újrafuttatáskor a certbot által hozzáadott HTTPS-beállítást nem írjuk felül.
if [ ! -f /etc/nginx/sites-available/impix-api ]; then
  install -m 644 "$APP_DIR/deploy/nginx-api.conf" /etc/nginx/sites-available/impix-api
fi
ln -sf /etc/nginx/sites-available/impix-api /etc/nginx/sites-enabled/impix-api
nginx -t
systemctl reload nginx

echo "==> Ellenőrzés"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3000/api/plans >/dev/null 2>&1; then OK=1; break; fi
  sleep 1
done
[ "${OK:-0}" = 1 ] && echo "   A Node szerver fut." || { echo "   HIBA: a szerver nem válaszol. Nézd meg: journalctl -u impix -n 50"; exit 1; }

echo
echo "================ KÉSZ ================"
if [ -n "$GENERATED_PASSWORD" ]; then
  echo " Admin belépés:  $ADMIN_EMAIL"
  echo " Admin jelszó:   $GENERATED_PASSWORD   (jegyezd fel, belépés után változtasd meg)"
fi
echo " Következő lépés (ha az api.impix.hu már erre a szerverre mutat a DNS-ben):"
echo "   certbot --nginx -d api.impix.hu"
echo "======================================"
