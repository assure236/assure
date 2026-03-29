# Assure Chit Funds - Complete Application

A full-stack chit fund management system with backend API, web portal, mobile app, and admin panel.

## 📋 Project Overview

This project implements a complete chit fund management solution as per the Software Development Agreement (SDA).

**Project Cost:** ₹85,000  
**Development Timeline:** 3 months  
**Support Period:** 12 months  

## 🏗️ System Architecture

### Technology Stack

**Backend:**
- Node.js 18+
- Express.js 4.18
- PostgreSQL with Sequelize ORM
- Socket.IO for real-time features
- AWS SDK (S3, SNS, SES)
- JWT Authentication

**Web Portal (Member):**
- React 18.2
- Material-UI 5.15
- React Router 6.20
- Axios
- Socket.IO Client

**Mobile App (Member):**
- Flutter 3.0+
- Provider State Management
- Dio HTTP Client
- Firebase Integration

**Admin Panel:**
- React 18.2
- Material-UI 5.15
- MUI Data Grid
- Recharts for Analytics

**Infrastructure:**
- AWS EC2 (Backend Hosting)
- AWS RDS (PostgreSQL Database)
- AWS S3 (Document Storage)
- AWS CloudFront (CDN)
- AWS SNS (SMS/Notifications)

## 📱 Key Features

### Member Features
- ✅ eKYC verification via DigiLocker
- ✅ Create/Join chit groups
- ✅ Real-time auction participation
- ✅ Online payment via Cashfree
- ✅ Document vault (agreements, receipts)
- ✅ Referral system with rewards
- ✅ Credit scoring system
- ✅ SMS/Email/Push notifications
- ✅ Track payments & auction history

### Admin Features
- ✅ User management (KYC approval)
- ✅ Create & manage chit groups
- ✅ Schedule & conduct auctions
- ✅ Payment verification
- ✅ Reports & analytics
- ✅ System configuration
- ✅ ERPNext integration

## 📂 Project Structure

```
Assure ChitFunds/
├── backend/               # Node.js API Server
│   ├── src/
│   │   ├── config/       # Database & AWS configs
│   │   ├── models/       # Database models (9 models)
│   │   ├── routes/       # API routes
│   │   ├── controllers/  # Business logic
│   │   ├── middleware/   # Auth, validation, errors
│   │   ├── services/     # SMS, email, notifications
│   │   ├── validators/   # Request validation (Joi)
│   │   ├── sockets/      # WebSocket handlers
│   │   └── utils/        # Helper functions
│   ├── package.json
│   └── .env.example
│
├── web/                  # React Member Portal
│   ├── public/
│   ├── src/
│   │   ├── components/   # Layout, PrivateRoute
│   │   ├── context/      # AuthContext
│   │   ├── pages/        # Login, Dashboard, etc.
│   │   └── App.js
│   └── package.json
│
├── mobile/               # Flutter Mobile App
│   ├── lib/
│   │   ├── core/
│   │   │   ├── models/
│   │   │   ├── providers/
│   │   │   ├── services/
│   │   │   ├── router/
│   │   │   └── theme/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── chit_groups/
│   │   │   ├── auctions/
│   │   │   ├── payments/
│   │   │   └── profile/
│   │   └── main.dart
│   └── pubspec.yaml
│
└── admin/                # React Admin Panel
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── context/
    │   ├── pages/
    │   └── App.js
    └── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Flutter 3.0+
- AWS Account
- Cashfree Account
- Firebase Account

### Backend Setup

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npx sequelize-cli db:migrate

# Start server
npm run dev
```

**Backend runs on:** http://localhost:5000

### Web Portal Setup

```bash
cd web
npm install

# Configure environment
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:5000/api/v1

# Start development server
npm start
```

**Web portal runs on:** http://localhost:3000

### Mobile App Setup

```bash
cd mobile
flutter pub get

# Configure Firebase
# Add google-services.json (Android)
# Add GoogleService-Info.plist (iOS)

# Run app
flutter run
```

### Admin Panel Setup

```bash
cd admin
npm install

# Configure environment
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:5000/api/v1

# Start development server
npm start
```

**Admin panel runs on:** http://localhost:3001

## 🔧 Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/assure_chitfunds
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET=assure-documents
AWS_SNS_SMS_SENDER_ID=ASSURE

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password

# Cashfree
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret

# DigiLocker
DIGILOCKER_CLIENT_ID=your_client_id
DIGILOCKER_CLIENT_SECRET=your_secret
```

## 📊 Database Models

1. **User** - Member details, KYC status, credit score
2. **ChitGroup** - Chit group configuration
3. **ChitMember** - Member participation in groups
4. **Auction** - Auction schedules & results
5. **Bid** - Auction bids
6. **Payment** - Payment transactions
7. **Document** - Document vault
8. **Referral** - Referral tracking
9. **Notification** - Notification history

## 🔐 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new member
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/forgot-password` - Request reset
- `POST /api/v1/auth/reset-password` - Reset password

### Chit Groups
- `GET /api/v1/chit-groups` - List all groups
- `POST /api/v1/chit-groups` - Create group (admin)
- `GET /api/v1/chit-groups/:id` - Group details
- `POST /api/v1/chit-groups/:id/join` - Join group

### Auctions
- `GET /api/v1/auctions` - List auctions
- `GET /api/v1/auctions/:id` - Auction details
- `POST /api/v1/auctions/:id/bid` - Place bid
- `POST /api/v1/auctions/:id/finalize` - Finalize (admin)

### Payments
- `GET /api/v1/payments` - Payment history
- `POST /api/v1/payments/initiate` - Start payment
- `POST /api/v1/payments/verify` - Verify payment

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Web tests
cd web
npm test

# Mobile tests
cd mobile
flutter test
```

## 📦 Deployment

### Backend (AWS EC2)
```bash
# Build
npm run build

# Deploy with PM2
pm2 start ecosystem.config.js
```

### Web & Admin (AWS S3 + CloudFront)
```bash
npm run build
aws s3 sync build/ s3://your-bucket
```

### Mobile (Play Store & App Store)
```bash
# Android
flutter build apk --release
flutter build appbundle

# iOS
flutter build ios --release
```

## 📝 Integration Guides

### Cashfree Payment Gateway
- Configure credentials in backend .env
- Test with sandbox first
- Implement webhook handlers

### DigiLocker KYC
- Register app at digilocker.gov.in
- Configure OAuth credentials
- Implement document fetch

### ERPNext Sync
- Configure ERPNext API URL
- Map chit groups to ERPNext
- Schedule cron jobs

### Firebase (Mobile)
- Create Firebase project
- Enable Cloud Messaging
- Download config files

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- SQL injection prevention
- XSS protection
- CORS configured
- Rate limiting
- Helmet.js security headers

## 📞 Support

**Development Support:** 12 months  
**Contact:** As per agreement

## 📄 License

Proprietary - All rights reserved to Assure Chit Funds

## 🤝 Development Team

Developed as per Software Development Agreement dated [Date]

---

**Version:** 1.0.0  
**Last Updated:** January 2025
