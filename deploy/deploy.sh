#!/usr/bin/env bash
# Deploy latest code to the DigitalOcean droplet
# Run from local machine: ./deploy/deploy.sh
set -euo pipefail

DROPLET_IP="${1:?Usage: deploy.sh DROPLET_IP}"
REMOTE_DIR="/opt/tradereplay"

echo "=== Deploying to ${DROPLET_IP} ==="

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
  pm2 startOrReload ecosystem.config.cjs
  pm2 save
  echo "=== Deploy complete ==="
REMOTE

echo "Done. Verify: https://api.tradereplay.me/api/health"
