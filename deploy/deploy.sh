#!/usr/bin/env bash
# Deploy latest code to the DigitalOcean droplet
# Run from local machine: ./deploy/deploy.sh DROPLET_IP [BRANCH] [REMOTE_NAME]
set -euo pipefail

DROPLET_IP="${1:?Usage: deploy.sh DROPLET_IP [BRANCH] [REMOTE_NAME]}"
BRANCH="${2:-main}"
REMOTE_NAME="${3:-jatin}"
REMOTE_DIR="/opt/tradereplay"

echo "=== Deploying ${BRANCH} from ${REMOTE_NAME} to ${DROPLET_IP} ==="

if ! git remote get-url "${REMOTE_NAME}" >/dev/null 2>&1; then
  echo "ERROR: git remote '${REMOTE_NAME}' not found"
  exit 1
fi

REMOTE_URL="$(git remote get-url "${REMOTE_NAME}")"

# Warn if GOOGLE_CLIENT_ID is missing from the secrets file
if ! grep -q "^GOOGLE_CLIENT_ID=" deploy/env/.env.secrets.ci 2>/dev/null && \
   ! grep -q "^GOOGLE_CLIENT_ID=" deploy/env/.env.ci 2>/dev/null; then
  echo "WARNING: GOOGLE_CLIENT_ID not found in deploy/env/.env.ci or .env.secrets.ci"
  echo "         Google login will fail on the server. Add it before deploying."
fi

if ! grep -q "^CHART_SERVICE_URL=" deploy/env/.env.secrets.ci 2>/dev/null && \
   ! grep -q "^CHART_SERVICE_URL=" deploy/env/.env.ci 2>/dev/null; then
  echo "WARNING: CHART_SERVICE_URL not found in deploy/env/.env.ci or .env.secrets.ci"
  echo "         Backend chart delegation may fallback to local compute in production."
fi

# Push selected branch first
git push "${REMOTE_NAME}" "${BRANCH}"

# Pull on remote, install, restart
ssh "root@${DROPLET_IP}" REMOTE_NAME="${REMOTE_NAME}" REMOTE_URL="${REMOTE_URL}" BRANCH="${BRANCH}" REMOTE_DIR="${REMOTE_DIR}" << 'REMOTE'
  set -euo pipefail
  cd "${REMOTE_DIR}"

  # Ensure the target remote exists on droplet and points to the same URL used locally
  if git remote get-url "${REMOTE_NAME}" >/dev/null 2>&1; then
    git remote set-url "${REMOTE_NAME}" "${REMOTE_URL}"
  else
    git remote add "${REMOTE_NAME}" "${REMOTE_URL}"
  fi

  git fetch "${REMOTE_NAME}" "${BRANCH}"
  if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    git checkout "${BRANCH}"
  else
    git checkout -b "${BRANCH}" "${REMOTE_NAME}/${BRANCH}"
  fi
  git pull --ff-only "${REMOTE_NAME}" "${BRANCH}"

  cd backend && npm ci
  cd ../services/logo-service && npm ci
  cd ../services/asset-service && npm ci
  cd ../services/screener-service && npm ci
  cd ../services/alert-service && npm ci
  cd ../services/portfolio-service && npm ci
  cd ../services/simulation-service && npm ci
  cd ../services/datafeed-service && npm ci
  cd ../services/chart-service && npm ci
  cd ../..

  # Verify GOOGLE_CLIENT_ID is set before restarting
  if ! grep -q "^GOOGLE_CLIENT_ID=" /opt/tradereplay/.env 2>/dev/null && \
     ! grep -q "^GOOGLE_CLIENT_ID=" /opt/tradereplay/.env.secrets 2>/dev/null; then
    echo "WARNING: GOOGLE_CLIENT_ID is missing from /opt/tradereplay/.env - Google login will be broken!"
    echo "         Add it: echo 'GOOGLE_CLIENT_ID=519388948862-jgnq690fvh4ipig0ujcagbv671b8uvqh.apps.googleusercontent.com' >> /opt/tradereplay/.env"
  fi

  if ! grep -q "^CHART_SERVICE_URL=" /opt/tradereplay/.env 2>/dev/null && \
     ! grep -q "^CHART_SERVICE_URL=" /opt/tradereplay/.env.secrets 2>/dev/null; then
    echo "WARNING: CHART_SERVICE_URL is missing from /opt/tradereplay/.env(.secrets)"
    echo "         Set CHART_SERVICE_URL=http://127.0.0.1:3009 for explicit delegation."
  fi

  pm2 startOrReload ecosystem.config.cjs --update-env
  pm2 save
  echo "=== Deploy complete ==="
REMOTE

echo "Done. Verify:"
echo "  - https://api.tradereplay.me/api/health"
echo "  - https://api.tradereplay.me/api/chart/health"

