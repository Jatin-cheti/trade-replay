#!/usr/bin/env bash
# DigitalOcean Droplet Setup Script — Trade Replay Backend
# Optimized for $6 droplet (1 vCPU / 1GB RAM)
# Run as root on a fresh Ubuntu 22.04/24.04 droplet
set -euo pipefail

echo "=== Trade Replay — Droplet Setup (cost-optimized) ==="

# ---- System updates ----
apt-get update && apt-get upgrade -y
apt-get install -y curl git nginx ufw snapd

# ---- Swap (critical for 1GB droplet) ----
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "Swap: 1GB created"
fi

# ---- Node.js 20 LTS ----
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js $(node -v)"

# ---- PM2 ----
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ---- Redis (local, saves $10/mo vs managed) ----
if ! command -v redis-server &> /dev/null; then
  apt-get install -y redis-server
fi
# Harden: bind to localhost, set memory limit for 1GB droplet
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
sed -i 's/^# maxmemory .*/maxmemory 100mb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
# Require password
REDIS_PASS=$(openssl rand -hex 16)
sed -i "s/^# requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server
echo "Redis running on redis://redis:6379 expectation for app config (password saved below)"

# ---- Firewall ----
ufw allow OpenSSH
ufw allow 'Nginx Full'
# Do NOT expose Redis or Kafka ports externally
ufw --force enable

# ---- Create app directory ----
mkdir -p /opt/tradereplay
mkdir -p /var/log/tradereplay

# ---- Clone repo ----
if [ ! -d "/opt/tradereplay/.git" ]; then
  git clone https://github.com/Jatin-cheti/trade-replay.git /opt/tradereplay
else
  cd /opt/tradereplay && git pull origin main
fi

# ---- Install backend deps ----
cd /opt/tradereplay/backend
npm ci --omit=dev

# ---- Nginx config ----
cp /opt/tradereplay/deploy/nginx/tradereplay.conf /etc/nginx/sites-available/tradereplay
ln -sf /etc/nginx/sites-available/tradereplay /etc/nginx/sites-enabled/tradereplay
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# ---- SSL (run after DNS is pointed) ----
# snap install --classic certbot
# ln -s /snap/bin/certbot /usr/bin/certbot
# certbot --nginx -d api.tradereplay.me --non-interactive --agree-tos -m YOUR_EMAIL

echo ""
echo "============================================="
echo "  Setup complete — Cost-optimized ($6 plan)"
echo "============================================="
echo ""
echo "Redis password: ${REDIS_PASS}"
echo "(Save this! You need it for REDIS_URL_LOCAL or REDIS_URL_DOCKER)"
echo ""
echo "Next steps:"
echo "  1. Run: bash /opt/tradereplay/deploy/setup-kafka-kraft.sh"
echo "  2. Create MongoDB Atlas FREE cluster (M0) at https://cloud.mongodb.com"
echo "     - Whitelist this droplet IP: $(curl -s ifconfig.me)"
echo "     - Create DB user and get connection string"
echo "  3. Create .env at /opt/tradereplay/.env with:"
echo "       APP_ENV=local"
echo "       MONGO_URI_LOCAL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/tradereplay?retryWrites=true&w=majority"
echo "       REDIS_URL_LOCAL=redis://default:${REDIS_PASS}@127.0.0.1:6379"
echo "       KAFKA_BROKER_LOCAL=127.0.0.1:9092"
echo "       GOOGLE_CLIENT_ID=519388948862-jgnq690fvh4ipig0ujcagbv671b8uvqh.apps.googleusercontent.com"
echo "       CLIENT_URL=https://tradereplay.me"
echo "       (plus shared settings like PORT/JWT_SECRET/KAFKA_ENABLED)"
echo "  4. Run: cd /opt/tradereplay && pm2 start ecosystem.config.cjs"
echo "  5. Run: pm2 save"
echo "  6. Point DNS: api.tradereplay.me → $(curl -s ifconfig.me)"
echo "  7. Run: bash /opt/tradereplay/deploy/setup-ssl.sh"
