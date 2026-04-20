#!/bin/bash
set -e

PRIVATE_IP="10.122.0.2"
REDIS_PASS="cc11949b6d3d409c14665e05310b6abb"

ENV_FILES=(
  /opt/tradereplay/.env
  /opt/tradereplay/services/datafeed-service/.env
  /opt/tradereplay/services/asset-service/.env
  /opt/tradereplay/services/portfolio-service/.env
  /opt/tradereplay/services/simulation-service/.env
  /opt/tradereplay/services/screener-service/.env
  /opt/tradereplay/services/alert-service/.env
)

# Backup all .env files
echo "=== Backing up .env files ==="
for f in "${ENV_FILES[@]}"; do
  if [ -f "$f" ]; then
    cp "$f" "${f}.pre-split"
    echo "Backed up: $f"
  fi
done

# Update all .env files
echo "=== Updating .env files ==="
for f in "${ENV_FILES[@]}"; do
  if [ -f "$f" ]; then
    # MongoDB: all variants -> private IP
    sed -i "s|mongodb://127.0.0.1:27017|mongodb://${PRIVATE_IP}:27017|g" "$f"
    # Redis: all variants -> private IP with password
    sed -i "s|redis://127.0.0.1:6379|redis://:${REDIS_PASS}@${PRIVATE_IP}:6379|g" "$f"
    # Kafka: all variants -> private IP
    sed -i "s|KAFKA_BROKER=localhost:9092|KAFKA_BROKER=${PRIVATE_IP}:9092|g" "$f"
    sed -i "s|KAFKA_BROKER_LOCAL=localhost:9092|KAFKA_BROKER_LOCAL=${PRIVATE_IP}:9092|g" "$f"
    sed -i "s|KAFKA_BROKER_DOCKER=localhost:9092|KAFKA_BROKER_DOCKER=${PRIVATE_IP}:9092|g" "$f"
    sed -i "s|KAFKA_BROKER_PRODUCTION=localhost:9092|KAFKA_BROKER_PRODUCTION=${PRIVATE_IP}:9092|g" "$f"
    # APP_ENV: local -> production
    sed -i "s|APP_ENV=local|APP_ENV=production|g" "$f"
    echo "Updated: $f"
  fi
done

# Verify
echo "=== Verify root .env ==="
grep -E 'MONGO_URI=|REDIS_URL=|KAFKA_BROKER=|APP_ENV=' /opt/tradereplay/.env
echo "=== Verify screener .env (PORT check) ==="
grep -E 'PORT=|MONGO_URI=|REDIS_URL=' /opt/tradereplay/services/screener-service/.env | head -5
echo "=== DONE ==="
