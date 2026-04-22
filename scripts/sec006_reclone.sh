#!/bin/bash
set -e
backup=/opt/tradereplay_pre_clean_$(date +%Y%m%d_%H%M%S)
if [ -d /opt/tradereplay ]; then cp -r /opt/tradereplay "$backup"; fi
if [ -f /opt/tradereplay/.env.production ]; then cp /opt/tradereplay/.env.production /tmp/env.production.bak; elif [ -f /opt/tradereplay/.env ]; then cp /opt/tradereplay/.env /tmp/env.production.bak; fi
rm -rf /opt/tradereplay
git clone https://github.com/Jatin-cheti/trade-replay.git /opt/tradereplay
if [ -f /tmp/env.production.bak ]; then cp /tmp/env.production.bak /opt/tradereplay/.env.production; fi
cd /opt/tradereplay
npm install >/tmp/sec006_npm_root.log 2>&1
cd frontend
npm install >/tmp/sec006_npm_frontend.log 2>&1
npm run build >/tmp/sec006_build.log 2>&1
cd /opt/tradereplay
pm2 restart all >/tmp/sec006_pm2_restart.log 2>&1 || pm2 start ecosystem.config.cjs >/tmp/sec006_pm2_start.log 2>&1
pm2 status
