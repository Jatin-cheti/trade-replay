#!/bin/bash
set -e
printf 'home %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://64.227.184.166/)"
printf 'screener %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://64.227.184.166/screener/stocks)"
printf 'symbol %s\n' "$(curl -s -o /dev/null -w '%{http_code}' 'http://64.227.184.166/symbol/NSE%3ARELIANCE')"
printf 'api-health %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://64.227.184.166/api/health)"
printf 'api-screener %s\n' "$(curl -s -o /dev/null -w '%{http_code}' 'http://64.227.184.166/api/screener/list?type=stocks&limit=1')"
