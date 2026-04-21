#!/bin/bash
# Symbol page + API smoke. Real API path is /api/screener/symbol/:symbol
for sym in 'NSE:RELIANCE' 'NSE:HDFCBANK' 'NASDAQ:AAPL' 'BSE:500325' 'AMFI:119598'; do
  enc=$(printf '%s' "$sym" | sed 's|:|%3A|g')
  page=$(curl -s -o /dev/null -w '%{http_code}' "https://tradereplay.me/symbol/$enc")
  api=$(curl -s -o /tmp/r.json -w '%{http_code}' "https://api.tradereplay.me/api/screener/symbol/$enc")
  name=$(node -e 'try{const j=require("/tmp/r.json"); const d=j.data||j; process.stdout.write(((d.name||d.companyName||"")+"").slice(0,45))}catch(e){}')
  icon=$(node -e 'try{const j=require("/tmp/r.json"); const d=j.data||j; process.stdout.write(d.iconUrl?"Y":"N")}catch(e){process.stdout.write("?")}')
  echo "$sym  page=$page  api=$api  icon=$icon  name=\"$name\""
done
