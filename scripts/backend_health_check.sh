#!/bin/bash
set -e
for u in \
  'http://127.0.0.1:4000/api/health' \
  'http://127.0.0.1:4000/health' \
  'http://127.0.0.1:4000/api/screener/list?type=stocks&limit=1'; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$u")
  echo "$code $u"
done
pm2 logs tradereplay-backend --lines 15 --nostream | tail -30
