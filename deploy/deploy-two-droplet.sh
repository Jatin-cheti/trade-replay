#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Deploy to Two-Droplet Architecture
# Run from local machine: bash deploy/deploy-two-droplet.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────
DROPLET_A_IP="64.227.184.166"         # User-facing (public IP)
DROPLET_B_IP="159.89.163.155"         # Infrastructure (public IP)
DROPLET_A_PRIVATE="10.122.0.5"        # Private IP
DROPLET_B_PRIVATE="10.122.0.2"        # Private IP
REMOTE_DIR="/opt/tradereplay"

# SSH key: use DEPLOY_SSH_KEY_PATH env var, fallback to default key
SSH_KEY="${DEPLOY_SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"

# SSH shortcuts (both droplets use same key)
SSH_A="ssh -i ${SSH_KEY} root@${DROPLET_A_IP}"
SSH_B="ssh -i ${SSH_KEY} root@${DROPLET_B_IP}"

echo "================================================="
echo "  Two-Droplet Deployment"
echo "  Droplet A: ${DROPLET_A_IP} (user-facing)"
echo "  Droplet B: ${DROPLET_B_IP} (infrastructure)"
echo "================================================="

# ─── Push to GitHub ───────────────────────────────────────
echo ""
echo "--- Pushing to GitHub ---"
git push origin main

# ─── Deploy to Droplet A ─────────────────────────────────
echo ""
echo "--- Deploying to Droplet A (user-facing) ---"
${SSH_A} << 'REMOTE_A'
  set -euo pipefail
  cd /opt/tradereplay
  git pull origin main

  # Install deps for user-facing services
  cd backend && npm ci --omit=dev
  cd ../services/asset-service && npm ci --omit=dev 2>/dev/null || true
  cd ../screener-service && npm ci --omit=dev 2>/dev/null || true
  cd ../alert-service && npm ci --omit=dev 2>/dev/null || true
  cd ../portfolio-service && npm ci --omit=dev 2>/dev/null || true
  cd ../simulation-service && npm ci --omit=dev 2>/dev/null || true
  cd ../datafeed-service && npm ci --omit=dev 2>/dev/null || true
  cd /opt/tradereplay

  # Use Droplet A PM2 config
  cp deploy/ecosystem.config.droplet-a.cjs ecosystem.config.cjs
  pm2 startOrReload ecosystem.config.cjs
  pm2 save

  echo "=== Droplet A deploy complete ==="
REMOTE_A

# ─── Deploy to Droplet B ─────────────────────────────────
echo ""
echo "--- Deploying to Droplet B (infrastructure) ---"
${SSH_B} << 'REMOTE_B'
  set -euo pipefail
  cd /opt/tradereplay
  git pull origin main

  # Install deps for background services
  cd backend && npm ci --omit=dev
  cd ../services/logo-service && npm ci --omit=dev
  cd /opt/tradereplay

  # Use Droplet B PM2 config
  cp deploy/ecosystem.config.droplet-b.cjs ecosystem.config.cjs
  pm2 startOrReload ecosystem.config.cjs
  pm2 save

  echo "=== Droplet B deploy complete ==="
REMOTE_B

# ─── Verify Health ────────────────────────────────────────
echo ""
echo "--- Verifying Health ---"

echo "Droplet A services:"
${SSH_A} "pm2 ls"

echo ""
echo "Droplet B services:"
${SSH_B} "pm2 ls"

echo ""
echo "Droplet B infrastructure:"
${SSH_B} "systemctl is-active mongod redis-server kafka"

echo ""
echo "Backend health check:"
curl -sf "https://api.tradereplay.me/api/health" && echo " OK" || echo " FAILED"

echo ""
echo "================================================="
echo "  Deployment complete!"
echo "================================================="
