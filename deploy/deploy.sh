#!/usr/bin/env bash
# Deploy latest code to the DigitalOcean droplet
# Run from local machine: ./deploy/deploy.sh
set -euo pipefail

DROPLET_IP="${1:?Usage: deploy.sh DROPLET_IP}"
REMOTE_DIR="/opt/tradereplay"

echo "=== Deploying to ${DROPLET_IP} ==="

# Warn if GOOGLE_CLIENT_ID is missing from the secrets file
if ! grep -q "^GOOGLE_CLIENT_ID=" deploy/env/.env.secrets.ci 2>/dev/null && \
   ! grep -q "^GOOGLE_CLIENT_ID=" deploy/env/.env.ci 2>/dev/null; then
  echo "WARNING: GOOGLE_CLIENT_ID not found in deploy/env/.env.ci or .env.secrets.ci"
  echo "         Google login will fail on the server. Add it before deploying."
fi

# Push to GitHub first
git push origin main

# Pull on remote, install, restart
ssh "root@${DROPLET_IP}" << REMOTE
  set -euo pipefail
  cd ${REMOTE_DIR}
  git pull origin main
  cd backend && npm ci
  cd ../services/logo-service && npm ci
  cd ../..
  # Verify GOOGLE_CLIENT_ID is set before restarting
  if ! grep -q "^GOOGLE_CLIENT_ID=" /opt/tradereplay/.env 2>/dev/null; then
    echo "WARNING: GOOGLE_CLIENT_ID is missing from /opt/tradereplay/.env — Google login will be broken!"
    echo "         Add it: echo 'GOOGLE_CLIENT_ID=519388948862-jgnq690fvh4ipig0ujcagbv671b8uvqh.apps.googleusercontent.com' >> /opt/tradereplay/.env"
  fi
  pm2 startOrReload ecosystem.config.cjs
  pm2 save
  echo "=== Deploy complete ==="
REMOTE

echo "Done. Verify: https://api.tradereplay.me/api/health"
