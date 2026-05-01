export TOK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWY1MTA3NzE0YmVmZmJmMjhiMjllZWMiLCJlbWFpbCI6InNlYXJjaHRlc3RAdHJhZGVyZXBsYXkubWUiLCJpYXQiOjE3Nzc2NjgyMTUsImV4cCI6MTc3ODI3MzAxNX0.ofW2LsRZlEF0t1qDl_8acr9HnLRbCD0y9rwf_elmzGA'
for c in stocks crypto forex indices futures funds bonds economy options; do
  echo -n "$c: "
  curl -s "http://127.0.0.1:4000/api/symbol-search?q=A&category=$c&limit=1" \
    -H "Authorization: Bearer $TOK" | head -c 200
  echo ""
done
