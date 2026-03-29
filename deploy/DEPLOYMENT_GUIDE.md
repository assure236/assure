# Assure ChitFunds — Hostinger VPS Deployment Guide

## Prerequisites
- **Hostinger VPS** (Ubuntu 22.04 recommended, minimum 2GB RAM)
- **Domain**: `assurechitfunds.com` (or your domain) pointed to VPS IP
- **3 DNS A records** pointing to your VPS IP:
  - `assurechitfunds.com` → VPS IP
  - `api.assurechitfunds.com` → VPS IP
  - `admin.assurechitfunds.com` → VPS IP

---

## STEP 1: Set Up DNS in Hostinger Dashboard

1. Login to **hpanel.hostinger.com**
2. Go to **Domains → DNS Zone**
3. Add **A records**:

| Type | Name    | Value (VPS IP)  | TTL  |
|------|---------|-----------------|------|
| A    | @       | YOUR_VPS_IP     | 3600 |
| A    | www     | YOUR_VPS_IP     | 3600 |
| A    | api     | YOUR_VPS_IP     | 3600 |
| A    | admin   | YOUR_VPS_IP     | 3600 |

Wait 5–10 minutes for DNS propagation.

---

## STEP 2: SSH into VPS & Install Software

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node -v   # should show v20.x
npm -v    # should show 10.x

# Install MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Install Nginx
apt install -y nginx

# Install PM2 (keeps Node.js running)
npm install -g pm2

# Install Certbot (free SSL)
apt install -y certbot python3-certbot-nginx

# Install Git
apt install -y git
```

---

## STEP 3: Upload Project to VPS

### Option A: Git (recommended)
```bash
# On VPS
mkdir -p /var/www/assurechitfunds
cd /var/www/assurechitfunds
git clone https://github.com/YOUR_REPO.git .
```

### Option B: SFTP/SCP from your PC
```powershell
# From your Windows PC (PowerShell)
scp -r "D:\Bhai Agency\Assure ChitFunds\backend" root@YOUR_VPS_IP:/var/www/assurechitfunds/
scp -r "D:\Bhai Agency\Assure ChitFunds\web" root@YOUR_VPS_IP:/var/www/assurechitfunds/
scp -r "D:\Bhai Agency\Assure ChitFunds\admin" root@YOUR_VPS_IP:/var/www/assurechitfunds/
```

---

## STEP 4: Set Up Backend

```bash
cd /var/www/assurechitfunds/backend
npm install --production

# Create production .env
cp .env.production .env
nano .env
```

**Edit `.env` — update these values:**
```
BACKEND_URL=https://api.assurechitfunds.com
WEB_CLIENT_URL=https://assurechitfunds.com
ADMIN_CLIENT_URL=https://admin.assurechitfunds.com
MONGO_URI=mongodb://localhost:27017/assure_chitfunds
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
```

Generate secrets:
```bash
openssl rand -hex 32    # copy output → JWT_SECRET
openssl rand -hex 32    # copy output → JWT_REFRESH_SECRET
```

**Start backend with PM2:**
```bash
pm2 start src/server.js --name "assure-backend"
pm2 save
pm2 startup    # makes it auto-start on reboot
```

Test: `curl http://localhost:5000/health`

---

## STEP 5: Build & Deploy Web Portal

```bash
cd /var/www/assurechitfunds/web
npm install

# Copy production env
cp .env.production .env
# Build production bundle
npm run build

# Move build output to nginx serve directory
mkdir -p /var/www/assurechitfunds/web-static
cp -r build/* /var/www/assurechitfunds/web-static/
```

---

## STEP 6: Build & Deploy Admin Portal

```bash
cd /var/www/assurechitfunds/admin
npm install

cp .env.production .env
npm run build

mkdir -p /var/www/assurechitfunds/admin-static
cp -r build/* /var/www/assurechitfunds/admin-static/
```

---

## STEP 7: Configure Nginx

```bash
# Copy nginx config
nano /etc/nginx/sites-available/assurechitfunds
```

Paste the content from `deploy/nginx.conf` but update the `root` paths:
- Web: `root /var/www/assurechitfunds/web-static;`
- Admin: `root /var/www/assurechitfunds/admin-static;`

```bash
# Enable the site
ln -s /etc/nginx/sites-available/assurechitfunds /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default    # remove default site

# Test config
nginx -t

# Reload
systemctl reload nginx
```

---

## STEP 8: SSL Certificates (Free with Let's Encrypt)

```bash
# Get SSL for all 3 domains
certbot --nginx -d assurechitfunds.com -d www.assurechitfunds.com
certbot --nginx -d api.assurechitfunds.com
certbot --nginx -d admin.assurechitfunds.com

# Auto-renew (certbot adds this automatically)
certbot renew --dry-run
```

---

## STEP 9: Cashfree Domain Whitelisting

1. Login to **merchant.cashfree.com**
2. Go to **Developers → Whitelisting**
3. Add:
   - `https://assurechitfunds.com`
   - `https://api.assurechitfunds.com`
   - Android package: `com.assure.chitfunds.assure_chitfunds`

---

## STEP 10: Update Mobile App & Rebuild APK

The mobile app now uses `lib/core/config/app_config.dart`:

```dart
// Already set to production:
static const _env = Environment.production;
static const _prodBackend = 'https://api.assurechitfunds.com';
```

**Update the domain** in `app_config.dart` if your domain is different, then rebuild:

```powershell
# On your Windows PC
cd "D:\Bhai Agency\Assure ChitFunds\mobile"
flutter build apk --debug
# Install on device
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

---

## STEP 11: Seed/Migrate Database (if needed)

```bash
cd /var/www/assurechitfunds/backend
node src/database/migrate.js
node src/database/seed.js
```

---

## Quick Reference — All URLs After Deployment

| Service      | URL                                       |
|-------------|-------------------------------------------|
| Web Portal  | https://assurechitfunds.com               |
| Admin Panel | https://admin.assurechitfunds.com         |
| Backend API | https://api.assurechitfunds.com/api/v1    |
| Socket.IO   | wss://api.assurechitfunds.com             |
| Health Check| https://api.assurechitfunds.com/health    |

---

## Useful PM2 Commands

```bash
pm2 list                    # see running apps
pm2 logs assure-backend     # view logs
pm2 restart assure-backend  # restart
pm2 monit                   # monitor CPU/RAM
```

## Troubleshooting

```bash
# Check if backend is running
pm2 status

# Check nginx errors
tail -f /var/log/nginx/error.log

# Check MongoDB
systemctl status mongod

# Test backend directly
curl http://localhost:5000/health

# Check firewall (allow ports 80, 443)
ufw allow 80
ufw allow 443
ufw allow ssh
ufw enable
```
