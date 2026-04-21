#!/bin/bash
for sym in 'NSE%3ARELIANCE' 'NSE%3AHDFCBANK' 'NASDAQ%3AAAPL' 'BSE%3A500325' 'AMFI%3A119598'; do
  page=$(curl -s -o /dev/null -w '%{http_code}' "https://tradereplay.me/symbol/$sym")
  api=$(curl -s -o /dev/null -w '%{http_code}' "https://api.tradereplay.me/api/symbol/$sym")
  echo "$sym page=$page api=$api"
done
