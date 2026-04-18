# MongoDB Migration Plan — DigitalOcean Self-Hosted

## Overview

Migrate from local development MongoDB to self-hosted MongoDB Community on a DigitalOcean droplet. The database runs on the same droplet as the application (single-server deployment).

---

## 1. Current State

| Metric | Value |
|--------|-------|
| MongoDB version | 7.x (local) |
| Database name | `tradereplay` |
| Raw symbols | 1,586,204 |
| Clean assets (screener) | 114,237 |
| Collections | symbols, cleanassets, users, portfolios, trades, simulationsessions, globalsymbolmasters, ingestionstates |
| DB size estimate | ~2-3 GB |
| Indexes | 15+ compound indexes on symbols collection |

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────┐
│  DigitalOcean Droplet (4GB+ RAM)            │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Node.js  │  │ MongoDB  │  │   Redis   │ │
│  │ (PM2)    │──│ (27017)  │  │  (6379)   │ │
│  │ :4000    │  │ auth: on │  │  DB 0/1/2 │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│       │                                      │
│  ┌──────────┐  ┌──────────┐                 │
│  │  Nginx   │  │  Kafka   │                 │
│  │ :80/:443 │  │  :9092   │                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

---

## 3. Installation Steps

### 3.1 Install MongoDB Community 7.x

```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add repository (Ubuntu 22.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  tee /etc/apt/sources.list.d/mongodb-org-7.0.list

apt-get update
apt-get install -y mongodb-org
```

### 3.2 Configure MongoDB

Edit `/etc/mongod.conf`:

```yaml
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1.5   # ~40% of RAM for 4GB droplet

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1     # Localhost only — no external access

security:
  authorization: enabled

operationProfiling:
  slowOpThresholdMs: 100
```

### 3.3 Create Database User

```bash
# Start without auth first
mongosh

use admin
db.createUser({
  user: "tradereplay_admin",
  pwd: "<STRONG_PASSWORD>",
  roles: [
    { role: "readWrite", db: "tradereplay" },
    { role: "dbAdmin", db: "tradereplay" }
  ]
})

# Verify
db.auth("tradereplay_admin", "<STRONG_PASSWORD>")
```

### 3.4 Update Connection String

In `.env` (production):
```
MONGO_URI_PRODUCTION=mongodb://tradereplay_admin:<PASSWORD>@127.0.0.1:27017/tradereplay?authSource=admin
```

### 3.5 Enable and Start

```bash
systemctl enable mongod
systemctl start mongod
systemctl status mongod
```

---

## 4. Data Migration

### 4.1 Export from Local

```bash
# Full dump (all collections)
mongodump --uri="mongodb://127.0.0.1:27017/tradereplay" --out=./dump

# Compressed (recommended for transfer)
mongodump --uri="mongodb://127.0.0.1:27017/tradereplay" --gzip --out=./dump-gz
```

Expected size: ~800MB compressed

### 4.2 Transfer to Droplet

```bash
# SCP to droplet
scp -r ./dump-gz root@<DROPLET_IP>:/tmp/dump-gz

# Or use rsync for resumable transfer
rsync -avz --progress ./dump-gz/ root@<DROPLET_IP>:/tmp/dump-gz/
```

### 4.3 Import on Droplet

```bash
mongorestore --uri="mongodb://tradereplay_admin:<PASSWORD>@127.0.0.1:27017/tradereplay?authSource=admin" \
  --gzip /tmp/dump-gz/tradereplay

# Verify counts
mongosh --eval "
  use tradereplay;
  db.symbols.countDocuments();
  db.cleanassets.countDocuments();
  db.users.countDocuments();
"
```

### 4.4 Rebuild Indexes

After restore, indexes are preserved. Verify:

```bash
mongosh --eval "
  use tradereplay;
  db.symbols.getIndexes().forEach(idx => print(idx.name));
  db.cleanassets.getIndexes().forEach(idx => print(idx.name));
"
```

---

## 5. Backup Strategy

### 5.1 Automated Daily Backups

Create `/opt/scripts/mongodb-backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/mongodb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

mongodump \
  --uri="mongodb://tradereplay_admin:<PASSWORD>@127.0.0.1:27017/tradereplay?authSource=admin" \
  --gzip \
  --out="$BACKUP_DIR/$TIMESTAMP"

# Prune old backups
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +

echo "Backup complete: $BACKUP_DIR/$TIMESTAMP"
```

### 5.2 Cron Schedule

```bash
# Daily at 3 AM UTC
echo "0 3 * * * root /opt/scripts/mongodb-backup.sh >> /var/log/mongodb-backup.log 2>&1" \
  > /etc/cron.d/mongodb-backup
```

### 5.3 Optional: S3 Offsite Backup

```bash
# After local backup, sync to S3
aws s3 sync "$BACKUP_DIR/$TIMESTAMP" "s3://tradereplay-backups/mongodb/$TIMESTAMP/" --storage-class STANDARD_IA
```

---

## 6. Performance Tuning

### 6.1 System Settings

```bash
# Disable Transparent Huge Pages (THP)
echo 'never' > /sys/kernel/mm/transparent_hugepage/enabled
echo 'never' > /sys/kernel/mm/transparent_hugepage/defrag

# Increase file descriptors
echo "* soft nofile 64000" >> /etc/security/limits.conf
echo "* hard nofile 64000" >> /etc/security/limits.conf

# vm.swappiness
sysctl -w vm.swappiness=1
echo 'vm.swappiness=1' >> /etc/sysctl.conf
```

### 6.2 Memory Allocation

For a 4GB droplet:
- MongoDB WiredTiger cache: 1.5 GB
- Node.js (PM2): 1 GB
- Redis: 256 MB
- Kafka: 512 MB
- OS + buffers: 736 MB

For an 8GB droplet:
- MongoDB WiredTiger cache: 3 GB
- Node.js (PM2): 2 GB
- Redis: 512 MB
- Kafka: 1 GB
- OS + buffers: 1.5 GB

---

## 7. Monitoring

### 7.1 MongoDB Metrics

```bash
# Quick health check
mongosh --eval "db.serverStatus().connections"
mongosh --eval "db.serverStatus().opcounters"
mongosh --eval "db.serverStatus().wiredTiger.cache"
```

### 7.2 PM2 Integration

The backend health endpoint (`/api/health`) already checks MongoDB connectivity.

### 7.3 Alert on Disk Usage

```bash
# Add to crontab — alert if disk > 80%
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d '% ')
if [ "$DISK_USAGE" -gt 80 ]; then
  echo "ALERT: Disk usage at ${DISK_USAGE}%"
fi
```

---

## 8. Security Checklist

- [x] `bindIp: 127.0.0.1` — no external network access
- [x] `authorization: enabled` — require auth
- [ ] Create dedicated app user (not admin)
- [ ] UFW: block port 27017 from external
- [ ] Enable audit log for production
- [ ] Rotate MongoDB log files
- [ ] Store connection string in `.env.secrets` (not `.env`)

---

## 9. Rollback Plan

If migration fails:
1. Stop PM2 backend: `pm2 stop all`
2. Revert `.env` to old MongoDB URI
3. Restart: `pm2 restart all`
4. Local MongoDB backup is still intact

---

## 10. Migration Checklist

- [ ] Provision DigitalOcean droplet (4GB+ RAM, 80GB SSD)
- [ ] Install MongoDB 7.x
- [ ] Configure mongod.conf (auth, bind, cache)
- [ ] Create database user
- [ ] Export local database (`mongodump --gzip`)
- [ ] Transfer to droplet (`scp` or `rsync`)
- [ ] Import on droplet (`mongorestore`)
- [ ] Verify collection counts match
- [ ] Verify indexes are intact
- [ ] Update `.env.secrets` with production URI
- [ ] Restart backend via PM2
- [ ] Verify `/api/health` returns OK
- [ ] Verify screener returns 114K+ symbols
- [ ] Set up automated backups
- [ ] Set up monitoring
