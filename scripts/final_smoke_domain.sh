#!/bin/bash
set -e
for u in \
  https://tradereplay.me/ \
  https://tradereplay.me/screener/stocks \
  https://tradereplay.me/symbol/NSE%3ARELIANCE \
  https://api.tradereplay.me/api/health \
  'https://api.tradereplay.me/api/screener/list?type=stocks&limit=1'; do
  code=$(curl -ks -o /dev/null -w '%{http_code}' "$u")
  echo "$code $u"
done
