# Quick Start Guide

## 🚀 Run All Applications

### 1. Setup Backend (5 minutes)

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env file - Add these minimal configs:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/assure_chitfunds
# JWT_SECRET=mysecretkey123
# PORT=5000

# Create PostgreSQL database
# Open pgAdmin or psql and run:
# CREATE DATABASE assure_chitfunds;

# Start server
npm run dev
```

✅ Backend should now be running on **http://localhost:5000**

---

### 2. Setup Web Portal (3 minutes)

```bash
# Open NEW terminal
cd web

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env:
# REACT_APP_API_URL=http://localhost:5000/api/v1

# Start web app
npm start
```

✅ Web portal opens automatically at **http://localhost:3000**

---

### 3. Setup Admin Panel (3 minutes)

```bash
# Open NEW terminal
cd admin

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env:
# REACT_APP_API_URL=http://localhost:5000/api/v1

# Start admin panel on different port
set PORT=3001 && npm start
```

✅ Admin panel opens at **http://localhost:3001**

---

### 4. Setup Mobile App (5 minutes)

```bash
# Open NEW terminal
cd mobile

# Install Flutter dependencies
flutter pub get

# Run on connected device/emulator
flutter run
```

✅ Mobile app launches on emulator/device

---

## 🔧 Quick Configuration

### Database Setup (PostgreSQL)

If you don't have PostgreSQL installed:

1. **Download PostgreSQL**: https://www.postgresql.org/download/windows/
2. **Install** with default settings
3. **Remember password** for postgres user
4. **Create database**:
   ```sql
   CREATE DATABASE assure_chitfunds;
   ```

### Create First Admin User

Once backend is running, create admin user directly in database:

```sql
-- Using pgAdmin or psql
INSERT INTO users (
  full_name, 
  email, 
  phone, 
  password, 
  role, 
  is_verified,
  created_at,
  updated_at
) VALUES (
  'Admin User',
  'admin@assurechits.com',
  '9999999999',
  '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', -- You'll need to update this
  'super_admin',
  true,
  NOW(),
  NOW()
);
```

**Better way - Use Node.js to hash password:**

Create `backend/scripts/createAdmin.js`:
```javascript
const bcrypt = require('bcrypt');

async function hashPassword() {
  const password = 'Admin@123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Hashed password:', hash);
}

hashPassword();
```

Run: `node scripts/createAdmin.js`

Use the output hash in the SQL INSERT above.

---

## ✅ Verify Everything Works

### Test Backend API

```bash
curl http://localhost:5000/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Test Web Portal

1. Open http://localhost:3000
2. Click "Register"
3. Fill form and submit
4. Check if it connects to backend

### Test Admin Panel

1. Open http://localhost:3001
2. Login with admin credentials
3. Should see dashboard

### Test Mobile App

1. App should launch
2. Try login/register screen
3. Check API connection

---

## 🐛 Common Issues

### Issue: "Cannot connect to PostgreSQL"

**Solution:**
- Ensure PostgreSQL service is running
- Check database name in DATABASE_URL
- Verify username/password
- Try: `postgresql://postgres:yourpassword@localhost:5432/assure_chitfunds`

### Issue: "Port 3000 already in use"

**Solution:**
```bash
set PORT=3002 && npm start
```

### Issue: "Module not found"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Flutter app not running

**Solution:**
```bash
flutter doctor
flutter clean
flutter pub get
flutter run
```

---

## 📱 Development Workflow

### Making Changes

1. **Backend changes** → Auto-reloads with nodemon
2. **Web/Admin changes** → Hot reload automatically
3. **Mobile changes** → Hot reload (press 'r' in terminal)

### Stop All Services

- Press `Ctrl + C` in each terminal
- Or close terminals

### Daily Startup

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Web
cd web && npm start

# Terminal 3 - Admin
cd admin && set PORT=3001 && npm start

# Terminal 4 - Mobile (optional)
cd mobile && flutter run
```

---

## 🎯 Quick Commands Reference

### Backend
```bash
npm run dev          # Development mode
npm start            # Production mode
npm test             # Run tests
```

### Web/Admin
```bash
npm start            # Development server
npm run build        # Production build
npm test             # Run tests
```

### Mobile
```bash
flutter run          # Run app
flutter build apk    # Build Android
flutter build ios    # Build iOS
flutter test         # Run tests
```

---

## 📞 Need Help?

If you encounter issues:

1. Check PROGRESS.md for current status
2. Review README.md for detailed docs
3. Check backend logs in terminal
4. Verify database connection
5. Ensure all dependencies installed

---

**Ready to develop! 🎉**

**Default Ports:**
- Backend: 5000
- Web: 3000
- Admin: 3001
- Mobile: Device/Emulator
