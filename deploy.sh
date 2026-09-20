#!/usr/bin/env bash
# Deploy AlgebraAce to webapp01 → https://math.pnpsolutions.ca/learning-algebra/
#
# Production layout (webapp01.pnpsolutions.ca):
#   /var/www/learning-algebra/          app (this repo; built on server)
#   /var/www/learning-algebra/server/.env  DATABASE_URL only (backup script reads it;
#                                          NOT in git — do not delete)
#   /etc/learning-algebra.env           root:600 — DATABASE_URL, JWT_SECRET, PORT=3004
#   systemd: learning-algebra.service   Express serves API + built client on 127.0.0.1:3004
#   nginx:   /etc/nginx/conf.d/math.pnpsolutions.ca.conf
#            location /learning-algebra/{,/api/} → proxy to :3004 (prefix stripped)
#   Backups: /home/nzhang/scripts/website-backup.sh learning-algebra (daily 00:00
#            Edmonton, files + pg dump) → /backup/learning-algebra →
#            gs://luminous-return-219217-site-backups/learning-algebra/ (00:30)
set -euo pipefail
HOST=webapp01.pnpsolutions.ca
APP=/var/www/learning-algebra

rsync -a --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude client/dist \
  --exclude server/.env \
  ./ "$HOST:$APP/"

ssh "$HOST" "set -e
  cd $APP
  npm --prefix server ci --omit=dev
  npm --prefix client ci
  npm --prefix client run build
  sudo systemctl restart learning-algebra
  sleep 2
  systemctl is-active learning-algebra
  curl -sf http://127.0.0.1:3004/api/health
"
echo
echo "✅ Deployed: https://math.pnpsolutions.ca/learning-algebra/"
