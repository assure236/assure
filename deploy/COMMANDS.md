# Deployment Commands — Step by Step
# VPS IP:  187.127.139.125
# Domain:  assure.fund
# GitHub:  https://github.com/assure236/assure.git
# Token:   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

=======================================================
WHERE TO RUN:
  [VPS]  = Hostinger browser terminal (VPS panel → Terminal button)
  [PC]   = Your Windows PowerShell (VS Code terminal)
=======================================================

STATUS: Steps 1-6 already DONE. Start from STEP 7.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Update system  [VPS]  ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apt update && apt upgrade -y


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Install Node.js 20  [VPS]  ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Install MongoDB 7  [VPS]  ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list && apt update && apt install -y mongodb-org && systemctl start mongod && systemctl enable mongod


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Install Nginx, Certbot, Git  [VPS]  ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apt install -y nginx certbot python3-certbot-nginx git


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Install PM2  [VPS]  ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
npm install -g pm2


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Create folder  [VPS]  ✅ DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
mkdir -p /var/www/assurechitfunds


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Clone code from GitHub  [VPS]  ← START HERE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /var/www/assurechitfunds
git clone https://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@github.com/assure236/assure.git .


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — Set up backend  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd /var/www/assurechitfunds/backend
cp .env.production .env
npm install --production

-- Generate JWT secrets. Run this command TWICE.
-- Copy the output each time — different value each run:
openssl rand -hex 32
openssl rand -hex 32

-- Open .env to paste the two secrets:
nano .env

  Inside nano editor:
  - Find line: JWT_SECRET=
    → paste the FIRST random string after the =
  - Find line: JWT_REFRESH_SECRET=
    → paste the SECOND random string after the =
  - Save: press Ctrl+X → then Y → then Enter

-- Start backend with PM2:
pm2 start src/server.js --name "assure-backend"
pm2 save
pm2 startup
  !! Copy the command pm2 startup prints and run it !!

-- Test backend is running (should return JSON):
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
STEP 11 — Copy Nginx config  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cp /var/www/assurechitfunds/deploy/nginx.conf /etc/nginx/sites-available/assurechitfunds
ln -s /etc/nginx/sites-available/assurechitfunds /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 12 — DNS setup  (Hostinger Domain panel — NOT VPS)
          Do this BEFORE SSL. Wait 5-10 mins after saving.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Go to: hpanel.hostinger.com → Domains → assure.fund → DNS Zone

Add these 4 A records, all pointing to: 187.127.139.125

  Name: @        Type: A    Value: 187.127.139.125   (for assure.fund)
  Name: www      Type: A    Value: 187.127.139.125   (for www.assure.fund)
  Name: api      Type: A    Value: 187.127.139.125   (for api.assure.fund)
  Name: admin    Type: A    Value: 187.127.139.125   (for admin.assure.fund)

-- To check if DNS has propagated (run on VPS after 5-10 mins):
nslookup assure.fund
nslookup api.assure.fund


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 13 — SSL Certificates (free HTTPS)  [VPS]
          Only run AFTER DNS records show 187.127.139.125
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
certbot --nginx -d assure.fund -d www.assure.fund -d api.assure.fund -d admin.assure.fund

  -- When asked "Enter email": enter your email
  -- When asked agree to terms: A
  -- When asked share email: N


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 14 — Firewall  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ufw allow ssh && ufw allow 80 && ufw allow 443 && ufw enable
  -- When asked "proceed?": y


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT COMPLETE — Your live URLs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Web app   → https://assure.fund
  Admin     → https://admin.assure.fund
  API       → https://api.assure.fund
  Health    → https://api.assure.fund/health


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUTURE CODE UPDATES — When you change code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On PC [PC]:
  cd "D:\Bhai Agency\Assure ChitFunds"
  git add .
  git commit -m "describe your change"
  git push

On VPS [VPS]:
  cd /var/www/assurechitfunds
  git pull
  pm2 restart assure-backend

  -- If you changed web or admin, also rebuild:
  cd /var/www/assurechitfunds/web && npm run build && cp -r build/* /var/www/assurechitfunds/web-static/
  cd /var/www/assurechitfunds/admin && npm run build && cp -r build/* /var/www/assurechitfunds/admin-static/


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USEFUL PM2 COMMANDS  [VPS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pm2 list                     → see if backend is running
pm2 logs assure-backend      → view live logs
pm2 restart assure-backend   → restart backend
pm2 monit                    → monitor CPU/RAM
pm2 stop assure-backend      → stop backend


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASHFREE WHITELISTING  (after HTTPS is working)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Go to: merchant.cashfree.com → Developers → Whitelisting
Add domains:
  https://assure.fund
  https://api.assure.fund
Add Android package: com.assure.chitfunds.assure_chitfunds
