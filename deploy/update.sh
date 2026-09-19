#!/usr/bin/env bash
# Frissítés a GitHubról: sudo bash /opt/impix/deploy/update.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo bash "$0" "$@"

cd /opt/impix
sudo -u impix git pull --ff-only
sudo -u impix npm ci --omit=dev
install -m 644 deploy/impix.service /etc/systemd/system/impix.service
# Az nginx-konfigot nem írjuk felül (a certbot módosította a HTTPS-hez).
systemctl daemon-reload
systemctl restart impix

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3000/api/plans >/dev/null 2>&1; then echo "OK: a szerver fut ($(git rev-parse --short HEAD))"; exit 0; fi
  sleep 1
done
echo "HIBA: a szerver nem válaszol. Nézd meg: journalctl -u impix -n 50"
exit 1
