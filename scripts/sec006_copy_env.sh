#!/bin/bash
set -e
for d in backend services/screener-service services/asset-service services/chart-service services/datafeed-service services/logo-service services/portfolio-service services/simulation-service; do
  if [ -d /opt/tradereplay/$d ]; then
    cp /opt/tradereplay/.env /opt/tradereplay/$d/.env
  fi
done
cd /opt/tradereplay
pm2 restart all --update-env >/tmp/sec006_pm2_restart7.log 2>&1 || true
pm2 status
