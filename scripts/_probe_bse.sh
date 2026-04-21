#!/bin/bash
set +e
for U in \
  'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active' \
  'https://api.bseindia.com/BseIndiaAPI/api/ListOfScrips/w?Group=&Scripcode=&industry=&segment=Equity&status=Active' \
  'https://api.bseindia.com/BseIndiaAPI/api/Equity/w?Group=&Scripcode=&industry=&segment=Equity&status=Active' \
  'https://api.bseindia.com/BseIndiaAPI/api/GetScripHeaderData/w?Debtflag=&scripcode=' \
  'https://www.bseindia.com/corporates/List_Scrips.html' \
  ; do
  echo "==== $U ===="
  curl -sSL --max-time 20 \
    -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
    -H 'Referer: https://www.bseindia.com/' \
    -H 'Origin: https://www.bseindia.com' \
    -H 'Accept: application/json, text/plain, */*' \
    -w 'HTTP=%{http_code} CT=%{content_type} LEN=%{size_download}\n' \
    "$U" -o /tmp/bse_probe_body.txt
  head -c 250 /tmp/bse_probe_body.txt; echo
  echo
done
