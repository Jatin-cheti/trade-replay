#!/usr/bin/env bash
# Kafka KRaft mode setup (no Zookeeper) — DigitalOcean Droplet
# Tuned for $6 droplet (1 vCPU / 1GB RAM + 1GB swap)
# Run as root. Installs Kafka 3.7.x with KRaft.
set -euo pipefail

KAFKA_VERSION="3.7.0"
KAFKA_DIR="/opt/kafka"
KAFKA_DATA="/var/lib/kafka"
KAFKA_LOG="/var/log/kafka"
KRAFT_CLUSTER_ID=""

echo "=== Kafka KRaft Setup (v${KAFKA_VERSION}) — memory-tuned ==="

# ---- Java ----
if ! command -v java &> /dev/null; then
  apt-get update
  apt-get install -y openjdk-17-jre-headless
fi
echo "Java: $(java -version 2>&1 | head -1)"

# ---- Download Kafka ----
if [ ! -d "${KAFKA_DIR}" ]; then
  cd /tmp
  curl -fsSL "https://downloads.apache.org/kafka/${KAFKA_VERSION}/kafka_2.13-${KAFKA_VERSION}.tgz" -o kafka.tgz
  mkdir -p "${KAFKA_DIR}"
  tar -xzf kafka.tgz -C "${KAFKA_DIR}" --strip-components=1
  rm kafka.tgz
fi

# ---- Create dirs ----
mkdir -p "${KAFKA_DATA}" "${KAFKA_LOG}"

# ---- Generate cluster ID ----
KRAFT_CLUSTER_ID=$("${KAFKA_DIR}/bin/kafka-storage.sh" random-uuid)
echo "Cluster ID: ${KRAFT_CLUSTER_ID}"

# ---- KRaft properties ----
cat > "${KAFKA_DIR}/config/kraft/server.properties" << 'KRAFTEOF'
# KRaft mode — no Zookeeper
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

# 24h retention — minimal disk usage on $6 droplet
log.retention.hours=24
log.segment.bytes=268435456
log.retention.check.interval.ms=300000

# Memory-saving: smaller fetch/replica buffers
replica.fetch.max.bytes=1048576
fetch.max.bytes=1048576

auto.create.topics.enable=false
delete.topic.enable=true
KRAFTEOF

# ---- IMPORTANT: Replace localhost with droplet private IP for remote access ----
# sed -i "s/PLAINTEXT:\/\/localhost:9092/PLAINTEXT:\/\/DROPLET_PRIVATE_IP:9092/g" "${KAFKA_DIR}/config/kraft/server.properties"

# ---- Format storage ----
"${KAFKA_DIR}/bin/kafka-storage.sh" format -t "${KRAFT_CLUSTER_ID}" -c "${KAFKA_DIR}/config/kraft/server.properties"

# ---- Systemd service ----
cat > /etc/systemd/system/kafka.service << SERVICEEOF
[Unit]
Description=Apache Kafka (KRaft)
After=network.target

[Service]
Type=simple
User=root
# Memory-tuned for 1GB droplet: 128MB heap (default is 1GB which OOMs)
Environment="KAFKA_HEAP_OPTS=-Xmx128m -Xms128m"
ExecStart=${KAFKA_DIR}/bin/kafka-server-start.sh ${KAFKA_DIR}/config/kraft/server.properties
ExecStop=${KAFKA_DIR}/bin/kafka-server-stop.sh
Restart=on-failure
RestartSec=10
LimitNOFILE=100000

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable kafka
systemctl start kafka

echo ""
echo "=== Kafka KRaft started ==="
echo "Broker: localhost:9092"
echo "Cluster ID: ${KRAFT_CLUSTER_ID}"
echo "Config: ${KAFKA_DIR}/config/kraft/server.properties"
echo "Logs: ${KAFKA_DATA}"
echo ""
echo "Test: ${KAFKA_DIR}/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list"
