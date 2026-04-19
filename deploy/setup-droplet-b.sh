#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Droplet B Setup — Infrastructure + Background Services
# Run as root on a FRESH Ubuntu 22.04/24.04 droplet
# Usage: bash setup-droplet-b.sh <DROPLET_A_PRIVATE_IP>
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DROPLET_A_PRIVATE_IP="${1:?Usage: setup-droplet-b.sh DROPLET_A_PRIVATE_IP}"
DROPLET_B_PRIVATE_IP=$(ip -4 addr show eth1 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

if [ -z "${DROPLET_B_PRIVATE_IP}" ]; then
  echo "ERROR: Could not detect private IP on eth1. Is VPC enabled?"
  exit 1
fi

echo "================================================="
echo "  Droplet B Setup — Infrastructure"
echo "  Private IP (this host): ${DROPLET_B_PRIVATE_IP}"
echo "  Droplet A Private IP:   ${DROPLET_A_PRIVATE_IP}"
echo "================================================="

# ─── System Updates ────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl git nginx ufw snapd gnupg wget

# ─── Swap (critical for 4GB droplet) ──────────────────────
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "Swap: 2GB created"
fi

# ─── Firewall (STRICT — only accept from Droplet A) ───────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow from "${DROPLET_A_PRIVATE_IP}" comment 'Droplet A — all services'
ufw --force enable
echo "Firewall: only SSH + Droplet A (${DROPLET_A_PRIVATE_IP}) allowed"

# ─── Node.js 20 LTS ───────────────────────────────────────
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js $(node -v)"

# ─── PM2 ──────────────────────────────────────────────────
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ─── MongoDB 7 ─────────────────────────────────────────────
if ! command -v mongod &> /dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
    tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update
  apt-get install -y mongodb-org
fi

# Configure MongoDB: bind to private IP + localhost ONLY
cat > /etc/mongod.conf << MONGOEOF
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.5

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1,${DROPLET_B_PRIVATE_IP}

processManagement:
  timeZoneInfo: /usr/share/zoneinfo
MONGOEOF

mkdir -p /var/lib/mongodb /var/log/mongodb
chown -R mongodb:mongodb /var/lib/mongodb /var/log/mongodb
systemctl enable mongod
systemctl restart mongod
echo "MongoDB: bound to 127.0.0.1,${DROPLET_B_PRIVATE_IP}:27017"

# Wait for MongoDB to be ready
for i in $(seq 1 30); do
  if mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1; then
    echo "MongoDB: ready"
    break
  fi
  sleep 1
done

# ─── Redis 7 ──────────────────────────────────────────────
if ! command -v redis-server &> /dev/null; then
  apt-get install -y redis-server
fi

# Generate Redis password
REDIS_PASS=$(openssl rand -hex 16)

cat > /etc/redis/redis.conf << REDISEOF
bind ${DROPLET_B_PRIVATE_IP} 127.0.0.1
port 6379
requirepass ${REDIS_PASS}
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
dir /var/lib/redis
loglevel notice
logfile /var/log/redis/redis-server.log
REDISEOF

systemctl enable redis-server
systemctl restart redis-server
echo "Redis: bound to 127.0.0.1,${DROPLET_B_PRIVATE_IP}:6379 (password set)"

# ─── Kafka KRaft ──────────────────────────────────────────
KAFKA_VERSION="3.7.0"
KAFKA_DIR="/opt/kafka"
if [ ! -d "${KAFKA_DIR}" ]; then
  # Install Java
  apt-get install -y openjdk-17-jre-headless

  cd /tmp
  wget -q "https://archive.apache.org/dist/kafka/${KAFKA_VERSION}/kafka_2.13-${KAFKA_VERSION}.tgz" -O kafka.tgz
  mkdir -p "${KAFKA_DIR}"
  tar -xzf kafka.tgz -C "${KAFKA_DIR}" --strip-components=1
  rm -f kafka.tgz
fi

mkdir -p /var/lib/kafka /var/log/kafka

KRAFT_CLUSTER_ID=$("${KAFKA_DIR}/bin/kafka-storage.sh" random-uuid)

cat > "${KAFKA_DIR}/config/kraft/server.properties" << KEOF
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@localhost:9093
listeners=PLAINTEXT://${DROPLET_B_PRIVATE_IP}:9092,CONTROLLER://localhost:9093
advertised.listeners=PLAINTEXT://${DROPLET_B_PRIVATE_IP}:9092
controller.listener.names=CONTROLLER
inter.broker.listener.name=PLAINTEXT
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
log.dirs=/var/lib/kafka
num.partitions=3
default.replication.factor=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
log.retention.hours=24
log.segment.bytes=268435456
log.retention.check.interval.ms=300000
auto.create.topics.enable=false
delete.topic.enable=true
KEOF

"${KAFKA_DIR}/bin/kafka-storage.sh" format -t "${KRAFT_CLUSTER_ID}" \
  -c "${KAFKA_DIR}/config/kraft/server.properties" 2>/dev/null || true

cat > /etc/systemd/system/kafka.service << SEOF
[Unit]
Description=Apache Kafka (KRaft)
After=network.target

[Service]
Type=simple
User=root
Environment="KAFKA_HEAP_OPTS=-Xmx256m -Xms128m"
ExecStart=${KAFKA_DIR}/bin/kafka-server-start.sh ${KAFKA_DIR}/config/kraft/server.properties
ExecStop=${KAFKA_DIR}/bin/kafka-server-stop.sh
Restart=on-failure
RestartSec=10
LimitNOFILE=100000

[Install]
WantedBy=multi-user.target
SEOF

systemctl daemon-reload
systemctl enable kafka
systemctl start kafka
echo "Kafka KRaft: listening on ${DROPLET_B_PRIVATE_IP}:9092"

# ─── Create app directory + clone repo ────────────────────
mkdir -p /opt/tradereplay /var/log/tradereplay

if [ ! -d "/opt/tradereplay/.git" ]; then
  git clone https://github.com/Jatin-cheti/trade-replay.git /opt/tradereplay
else
  cd /opt/tradereplay && git pull origin main
fi

# Install backend + service deps
cd /opt/tradereplay/backend && npm ci --omit=dev
cd /opt/tradereplay/services/logo-service && npm ci --omit=dev

# ─── Create Kafka topics ─────────────────────────────────
sleep 5
for topic in market.tick alert.fired symbol.logo.enriched symbol.logo.mapped symbol.events portfolio.events; do
  "${KAFKA_DIR}/bin/kafka-topics.sh" --create \
    --topic "${topic}" \
    --partitions 3 \
    --replication-factor 1 \
    --bootstrap-server "${DROPLET_B_PRIVATE_IP}:9092" 2>/dev/null || true
done
echo "Kafka topics created"

# ─── Summary ──────────────────────────────────────────────
echo ""
echo "================================================="
echo "  Droplet B Setup COMPLETE"
echo "================================================="
echo ""
echo "  Private IP:   ${DROPLET_B_PRIVATE_IP}"
echo "  MongoDB:      ${DROPLET_B_PRIVATE_IP}:27017 (no auth — add later)"
echo "  Redis:        ${DROPLET_B_PRIVATE_IP}:6379"
echo "  Redis Pass:   ${REDIS_PASS}"
echo "  Kafka:        ${DROPLET_B_PRIVATE_IP}:9092"
echo ""
echo "  SAVE THE REDIS PASSWORD!"
echo "  You need it for .env on both droplets."
echo ""
echo "  Next: run migrate-to-droplet-b.sh from Droplet A"
echo "================================================="
