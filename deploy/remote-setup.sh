#!/bin/bash
set -euo pipefail

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

echo "=== Completing droplet setup ==="

# ---- Kafka (use archive URL) ----
KAFKA_DIR="/opt/kafka"
if [ ! -d "${KAFKA_DIR}" ]; then
  cd /tmp
  curl -fsSL "https://archive.apache.org/dist/kafka/3.7.0/kafka_2.13-3.7.0.tgz" -o kafka.tgz
  mkdir -p "${KAFKA_DIR}"
  tar -xzf kafka.tgz -C "${KAFKA_DIR}" --strip-components=1
  rm -f kafka.tgz
  echo "Kafka downloaded"
fi

mkdir -p /var/lib/kafka /var/log/kafka

KRAFT_CLUSTER_ID=$("${KAFKA_DIR}/bin/kafka-storage.sh" random-uuid)
echo "Cluster: ${KRAFT_CLUSTER_ID}"

cat > "${KAFKA_DIR}/config/kraft/server.properties" << 'KEOF'
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@localhost:9093
listeners=PLAINTEXT://:9092,CONTROLLER://:9093
advertised.listeners=PLAINTEXT://localhost:9092
controller.listener.names=CONTROLLER
inter.broker.listener.name=PLAINTEXT
listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
log.dirs=/var/lib/kafka
num.partitions=1
default.replication.factor=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
log.retention.hours=24
log.segment.bytes=268435456
log.retention.check.interval.ms=300000
replica.fetch.max.bytes=1048576
fetch.max.bytes=1048576
auto.create.topics.enable=false
delete.topic.enable=true
KEOF

"${KAFKA_DIR}/bin/kafka-storage.sh" format -t "${KRAFT_CLUSTER_ID}" -c "${KAFKA_DIR}/config/kraft/server.properties" --ignore-formatted

cat > /etc/systemd/system/kafka.service << 'SEOF'
[Unit]
Description=Apache Kafka (KRaft)
After=network.target

[Service]
Type=simple
User=root
Environment="KAFKA_HEAP_OPTS=-Xmx128m -Xms128m"
ExecStart=/opt/kafka/bin/kafka-server-start.sh /opt/kafka/config/kraft/server.properties
ExecStop=/opt/kafka/bin/kafka-server-stop.sh
Restart=on-failure
RestartSec=10
LimitNOFILE=100000

[Install]
WantedBy=multi-user.target
SEOF

systemctl daemon-reload
systemctl enable kafka
systemctl start kafka
echo "Kafka started"

# ---- Firewall ----
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable

# ---- Clone repo ----
mkdir -p /opt/tradereplay /var/log/tradereplay
if [ ! -d "/opt/tradereplay/.git" ]; then
  git clone https://github.com/Jatin-cheti/trade-replay.git /opt/tradereplay
fi

cd /opt/tradereplay
git fetch origin "${DEPLOY_BRANCH}"
if git show-ref --verify --quiet "refs/heads/${DEPLOY_BRANCH}"; then
  git checkout "${DEPLOY_BRANCH}"
else
  git checkout -b "${DEPLOY_BRANCH}" "origin/${DEPLOY_BRANCH}"
fi
git pull --ff-only origin "${DEPLOY_BRANCH}"

# ---- Install service deps ----
cd /opt/tradereplay/backend
npm ci
cd /opt/tradereplay/services/logo-service
npm ci
cd /opt/tradereplay/services/asset-service
npm ci
cd /opt/tradereplay/services/screener-service
npm ci
cd /opt/tradereplay/services/alert-service
npm ci
cd /opt/tradereplay/services/portfolio-service
npm ci
cd /opt/tradereplay/services/simulation-service
npm ci
cd /opt/tradereplay/services/datafeed-service
npm ci
cd /opt/tradereplay/services/chart-service
npm ci

# ---- Nginx ----
cp /opt/tradereplay/deploy/nginx/tradereplay.conf /etc/nginx/sites-available/tradereplay
ln -sf /etc/nginx/sites-available/tradereplay /etc/nginx/sites-enabled/tradereplay
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "=== SETUP COMPLETE ==="
