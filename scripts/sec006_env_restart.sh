#!/bin/bash
set -e
if [ -f /opt/tradereplay/.env.production ]; then cp /opt/tradereplay/.env.production /opt/tradereplay/.env; fi
cd /opt/tradereplay
pm2 restart all >/tmp/sec006_pm2_restart3.log 2>&1 || pm2 start ecosystem.config.cjs >/tmp/sec006_pm2_start3.log 2>&1
pm2 status
