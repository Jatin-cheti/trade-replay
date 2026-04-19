#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Verify two-droplet deployment health
# Run from local machine: bash deploy/verify-two-droplet.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DROPLET_A_IP="64.227.184.166"
DROPLET_B_IP="159.89.163.155"
DROPLET_A_PRIVATE="10.122.0.5"
DROPLET_B_PRIVATE="10.122.0.2"

# SSH key: use DEPLOY_SSH_KEY_PATH env var, fallback to default key
SSH_KEY="${DEPLOY_SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"

SSH_A="ssh -i ${SSH_KEY} root@${DROPLET_A_IP}"
SSH_B="ssh -i ${SSH_KEY} root@${DROPLET_B_IP}"

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ "${result}" = "OK" ]; then
    echo "  ✅ ${label}"
    PASS=$((PASS + 1))
  else
    echo "  ❌ ${label}: ${result}"
    FAIL=$((FAIL + 1))
  fi
}

echo "================================================="
echo "  Two-Droplet Health Verification"
echo "================================================="

# ─── Droplet A: Service Health ────────────────────────────
echo ""
echo "=== DROPLET A — User-Facing ==="

for svc in backend:4000 asset-service:3002 screener-service:3004 alert-service:3005 portfolio-service:3006 simulation-service:3007 datafeed-service:3008; do
  name="${svc%%:*}"
  port="${svc##*:}"
  status=$(${SSH_A} "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:${port}/api/health 2>/dev/null || echo 'DOWN'")
  if [ "${status}" = "200" ]; then
    check "${name} (port ${port})" "OK"
  else
    check "${name} (port ${port})" "HTTP ${status}"
  fi
done

# Nginx
nginx_status=$(${SSH_A} "systemctl is-active nginx")
check "nginx" "$([ "${nginx_status}" = "active" ] && echo OK || echo "${nginx_status}")"

# PM2 process count on A
pm2_count_a=$(${SSH_A} "pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin); print(sum(1 for p in d if p.get(\"pm2_env\",{}).get(\"status\")==\"online\"))' 2>/dev/null || echo 0")
check "PM2 processes online (expect 7)" "$([ "${pm2_count_a}" -ge 7 ] && echo OK || echo "only ${pm2_count_a}")"

# ─── Droplet B: Infrastructure Health ─────────────────────
echo ""
echo "=== DROPLET B — Infrastructure ==="

mongo_status=$(${SSH_B} "mongosh --quiet --eval 'db.adminCommand(\"ping\").ok' 2>/dev/null || echo 0")
check "MongoDB" "$([ "${mongo_status}" = "1" ] && echo OK || echo "NOT_RESPONDING")"

redis_status=$(${SSH_B} "redis-cli -a \$(grep requirepass /etc/redis/redis.conf | awk '{print \$2}') ping 2>/dev/null || echo FAIL")
check "Redis" "$(echo "${redis_status}" | grep -q PONG && echo OK || echo "${redis_status}")"

kafka_status=$(${SSH_B} "systemctl is-active kafka")
check "Kafka" "$([ "${kafka_status}" = "active" ] && echo OK || echo "${kafka_status}")"

# PM2 on B
pm2_count_b=$(${SSH_B} "pm2 jlist | python3 -c 'import sys,json; d=json.load(sys.stdin); print(sum(1 for p in d if p.get(\"pm2_env\",{}).get(\"status\")==\"online\"))' 2>/dev/null || echo 0")
check "PM2 processes online (expect 3)" "$([ "${pm2_count_b}" -ge 3 ] && echo OK || echo "only ${pm2_count_b}")"

# ─── Cross-Droplet Connectivity ───────────────────────────
echo ""
echo "=== CROSS-DROPLET CONNECTIVITY ==="

mongo_cross=$(${SSH_A} "mongosh --quiet --eval 'db.adminCommand(\"ping\").ok' 'mongodb://${DROPLET_B_PRIVATE}:27017/tradereplay' 2>/dev/null || echo 0")
check "A → B MongoDB (private network)" "$([ "${mongo_cross}" = "1" ] && echo OK || echo FAIL)"

redis_cross=$(${SSH_A} "redis-cli -h ${DROPLET_B_PRIVATE} -a \$(ssh root@${DROPLET_B_PRIVATE} 'grep requirepass /etc/redis/redis.conf | awk \"{print \\$2}\"' 2>/dev/null) ping 2>/dev/null || echo FAIL")
check "A → B Redis (private network)" "$(echo "${redis_cross}" | grep -q PONG && echo OK || echo FAIL)"

# ─── Security Checks ─────────────────────────────────────
echo ""
echo "=== SECURITY ==="

# MongoDB should NOT be reachable from public IP
mongo_public=$(timeout 3 mongosh --quiet --eval 'db.adminCommand("ping").ok' "mongodb://${DROPLET_B_IP}:27017/tradereplay" 2>/dev/null || echo "BLOCKED")
check "MongoDB NOT reachable from public" "$([ "${mongo_public}" = "BLOCKED" ] && echo OK || echo "EXPOSED!")"

# ─── Memory Usage ─────────────────────────────────────────
echo ""
echo "=== MEMORY USAGE ==="

mem_a=$(${SSH_A} "free -m | awk '/Mem:/ {print \$3\"/\"\$2\"MB\"}'")
echo "  Droplet A: ${mem_a}"

mem_b=$(${SSH_B} "free -m | awk '/Mem:/ {print \$3\"/\"\$2\"MB\"}'")
echo "  Droplet B: ${mem_b}"

# ─── Public Endpoint ──────────────────────────────────────
echo ""
echo "=== PUBLIC ENDPOINT ==="

health=$(curl -sf "https://api.tradereplay.me/api/health" 2>/dev/null || echo "FAIL")
check "api.tradereplay.me/api/health" "$(echo "${health}" | grep -q 'ok' && echo OK || echo "${health}")"

# ─── Summary ──────────────────────────────────────────────
echo ""
echo "================================================="
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "================================================="

if [ "${FAIL}" -gt 0 ]; then
  echo "  ⚠️  Some checks failed. Review above."
  exit 1
else
  echo "  All checks passed!"
fi
