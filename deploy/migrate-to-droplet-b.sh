#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Migrate MongoDB data from Droplet A → Droplet B
# Run this on DROPLET A as root
# Usage: bash migrate-to-droplet-b.sh <DROPLET_B_PRIVATE_IP>
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

DROPLET_B_PRIVATE_IP="${1:?Usage: migrate-to-droplet-b.sh DROPLET_B_PRIVATE_IP}"
BACKUP_DIR="/tmp/mongo-backup-$(date +%Y%m%d-%H%M%S)"

echo "================================================="
echo "  MongoDB Migration: Droplet A → Droplet B"
echo "  Target: ${DROPLET_B_PRIVATE_IP}:27017"
echo "================================================="

# Step 1: Ensure MongoDB is running on Droplet A
echo ""
echo "--- Step 1: Ensuring local MongoDB is running ---"
systemctl start mongod 2>/dev/null || true
sleep 3

MONGO_OK=$(mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null || echo "0")
if [ "${MONGO_OK}" != "1" ]; then
  echo "ERROR: Local MongoDB is not running. Attempting restart..."
  systemctl restart mongod
  sleep 5
  MONGO_OK=$(mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null || echo "0")
  if [ "${MONGO_OK}" != "1" ]; then
    echo "FATAL: Cannot start local MongoDB. Aborting."
    exit 1
  fi
fi
echo "Local MongoDB: running"

# Step 2: Record collection counts (source)
echo ""
echo "--- Step 2: Recording source collection counts ---"
mongosh --quiet tradereplay --eval "
  db.getCollectionNames().forEach(function(c) {
    printjson({ collection: c, count: db.getCollection(c).countDocuments() });
  });
"

# Step 3: Dump
echo ""
echo "--- Step 3: Creating mongodump ---"
mkdir -p "${BACKUP_DIR}"
mongodump --uri="mongodb://127.0.0.1:27017/tradereplay" --out="${BACKUP_DIR}" --gzip
echo "Dump created at ${BACKUP_DIR}"
du -sh "${BACKUP_DIR}"

# Step 4: Transfer to Droplet B over private network
echo ""
echo "--- Step 4: Transferring to Droplet B via private network ---"
rsync -avz --progress "${BACKUP_DIR}/" "root@${DROPLET_B_PRIVATE_IP}:${BACKUP_DIR}/"
echo "Transfer complete"

# Step 5: Restore on Droplet B
echo ""
echo "--- Step 5: Restoring on Droplet B ---"
ssh "root@${DROPLET_B_PRIVATE_IP}" "mongorestore --uri='mongodb://127.0.0.1:27017/tradereplay' --gzip --drop '${BACKUP_DIR}/tradereplay'"
echo "Restore complete"

# Step 6: Verify counts on Droplet B
echo ""
echo "--- Step 6: Verifying collection counts on Droplet B ---"
ssh "root@${DROPLET_B_PRIVATE_IP}" "mongosh --quiet tradereplay --eval \"
  db.getCollectionNames().forEach(function(c) {
    printjson({ collection: c, count: db.getCollection(c).countDocuments() });
  });
\""

# Step 7: Test connectivity from Droplet A to Droplet B
echo ""
echo "--- Step 7: Testing connectivity ---"
REMOTE_PING=$(mongosh --quiet --eval "db.adminCommand('ping').ok" "mongodb://${DROPLET_B_PRIVATE_IP}:27017/tradereplay" 2>/dev/null || echo "0")
if [ "${REMOTE_PING}" == "1" ]; then
  echo "SUCCESS: Can reach MongoDB on Droplet B from Droplet A"
else
  echo "WARNING: Cannot reach MongoDB on Droplet B. Check firewall."
fi

echo ""
echo "================================================="
echo "  Migration COMPLETE"
echo ""
echo "  Source (A): mongodb://127.0.0.1:27017/tradereplay"
echo "  Target (B): mongodb://${DROPLET_B_PRIVATE_IP}:27017/tradereplay"
echo ""
echo "  VERIFY the counts above match between source and target."
echo "  If they match, update .env on Droplet A to point to Droplet B."
echo "================================================="
