# Deployment Commands — Step by Step
# VPS IP: 187.127.139.125
# Domain: assure.fund

=======================================================
WHERE TO RUN:
  [VPS]   = Hostinger browser terminal (Terminal button in VPS dashboard)
  [PC]    = Your Windows PowerShell
=======================================================


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Update system  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apt update && apt upgrade -y


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Install Node.js 20  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Install MongoDB  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list && apt update && apt install -y mongodb-org && systemctl start mongod && systemctl enable mongod


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Install Nginx, Certbot, Git  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apt install -y nginx certbot python3-certbot-nginx git


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Install PM2  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
npm install -g pm2


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Create folder on VPS  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
mkdir -p /var/www/assurechitfunds


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Upload project files from PC  [PC PowerShell]
         Run one by one, wait for each to finish
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
scp -r "D:\Bhai Agency\Assure ChitFunds\backend" root@187.127.139.125:/var/www/assurechitfunds/

scp -r "D:\Bhai Agency\Assure ChitFunds\web" root@187.127.139.125:/var/www/assurechitfunds/

scp -r "D:\Bhai Agency\Assure ChitFunds\admin" root@187.127.139.125:/var/www/assurechitfunds/


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — Set up backend  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /var/www/assurechitfunds/backend

cp .env.production .env

npm install --production

-- Generate JWT secrets (run twice, copy each output):
openssl rand -hex 32

-- Open .env to paste the secrets:
nano .env

  Inside nano:
  - Find JWT_SECRET=  → paste first random string
  - Find JWT_REFRESH_SECRET=  → paste second random string
  - Save: press Ctrl+X → then Y → then Enter

-- Start backend with PM2:
pm2 start src/server.js --name "assure-backend"

pm2 save

pm2 startup
  (copy the command it gives you and run it)

-- Test backend is running:
curl http://localhost:5000/health


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 9 — Build Web portal  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /var/www/assurechitfunds/web

npm install

cp .env.production .env

npm run build

mkdir -p /var/www/assurechitfunds/web-static

cp -r build/* /var/www/assurechitfunds/web-static/


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 10 — Build Admin portal  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /var/www/assurechitfunds/admin

npm install

cp .env.production .env

npm run build

mkdir -p /var/www/assurechitfunds/admin-static

cp -r build/* /var/www/assurechitfunds/admin-static/


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 11 — Upload Nginx config  [PC PowerShell]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
scp "D:\Bhai Agency\Assure ChitFunds\deploy\nginx.conf" root@187.127.139.125:/etc/nginx/sites-available/assurechitfunds


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 12 — Update Nginx paths & enable  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Fix the static folder paths in nginx config:
sed -i 's|/var/www/assurechitfunds/web;|/var/www/assurechitfunds/web-static;|g' /etc/nginx/sites-available/assurechitfunds
sed -i 's|/var/www/assurechitfunds/admin;|/var/www/assurechitfunds/admin-static;|g' /etc/nginx/sites-available/assurechitfunds

-- Enable the site:
ln -s /etc/nginx/sites-available/assurechitfunds /etc/nginx/sites-enabled/

rm -f /etc/nginx/sites-enabled/default

-- Test & reload:
nginx -t

systemctl reload nginx


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 13 — DNS (Hostinger Domain panel)
          Do this BEFORE SSL. Wait 5-10 mins after.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add these A records pointing to 187.127.139.125:

  @      → 187.127.139.125   (assure.fund)
  www    → 187.127.139.125   (www.assure.fund)
  api    → 187.127.139.125   (api.assure.fund)
  admin  → 187.127.139.125   (admin.assure.fund)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 14 — SSL Certificates (free HTTPS)  [VPS]
          Only after DNS records are set!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
certbot --nginx -d assure.fund -d www.assure.fund -d api.assure.fund -d admin.assure.fund


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 15 — Firewall  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ufw allow ssh && ufw allow 80 && ufw allow 443 && ufw enable


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DONE! Your URLs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Web     → https://assure.fund
  Admin   → https://admin.assure.fund
  API     → https://api.assure.fund
  Health  → https://api.assure.fund/health


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USEFUL PM2 COMMANDS  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pm2 list                     → see if backend is running
pm2 logs assure-backend      → view live logs
pm2 restart assure-backend   → restart backend
pm2 monit                    → monitor CPU/RAM
