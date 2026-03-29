# Backend API - Assure Chit Funds

Backend API server for the Assure Chit Funds management platform built with Node.js, Express, PostgreSQL, and AWS services.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Management**: Member registration, KYC verification, profile management
- **Chit Group Management**: Create and manage chit groups
- **Live Auction System**: Real-time bidding with Socket.IO
- **Payment Processing**: Cashfree payment gateway integration
- **Document Management**: AWS S3 integration for document storage
- **Notifications**: SMS (AWS SNS), Email, and Push notifications
- **Credit Scoring**: Automated credit scoring based on payment discipline
- **Referral System**: Member referral tracking and rewards
- **ERPNext Integration**: Financial data synchronization
- **Analytics**: Dividend predictions and payment analytics

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Real-time**: Socket.IO
- **Cloud Services**: AWS (EC2, S3, SNS, RDS)
- **Payment Gateway**: Cashfree
- **Authentication**: JWT
- **Logging**: Winston
- **Validation**: Joi

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── sockets/         # Socket.IO handlers
│   ├── utils/           # Utility functions
│   ├── validators/      # Request validators
│   └── server.js        # Entry point
├── logs/                # Application logs
├── .env.example         # Environment variables template
└── package.json
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - Database credentials
   - AWS credentials
   - Cashfree API keys
   - JWT secrets
   - Other API keys

4. Run database migrations:
```bash
npm run migrate
```

5. (Optional) Seed database:
```bash
npm run seed
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in .env)

## API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Key Endpoints

#### Authentication
- `POST /auth/register` - Register new member
- `POST /auth/login` - Login
- `POST /auth/verify-otp` - Verify OTP
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

#### Users
- `GET /users/profile` - Get current user profile
- `PUT /users/profile` - Update profile
- `GET /users/my-chit-groups` - Get user's chit groups
- `GET /users/payment-history` - Get payment history

#### Chit Groups
- `GET /chit-groups` - List all chit groups
- `GET /chit-groups/:id` - Get chit group details
- `POST /chit-groups/:id/enroll` - Enroll in group
- `GET /chit-groups/:id/analytics` - Get analytics

#### Auctions
- `GET /auctions/upcoming` - Get upcoming auctions
- `GET /auctions/:id` - Get auction details
- `POST /auctions/:id/place-bid` - Place bid
- `GET /auctions/:id/live-status` - Get live auction status

#### Payments
- `POST /payments/create-order` - Create payment order
- `POST /payments/verify` - Verify payment
- `GET /payments/my-payments` - Get user payments
- `GET /payments/due-payments` - Get due payments

#### Dashboard
- `GET /dashboard/member` - Member dashboard
- `GET /dashboard/admin` - Admin dashboard

## Database Models

- **User**: Member and admin users
- **ChitGroup**: Chit group configuration
- **ChitMember**: Group membership records
- **Auction**: Auction events
- **Bid**: Bidding records
- **Payment**: Payment transactions
- **Document**: KYC and other documents
- **Referral**: Referral tracking
- **Notification**: User notifications

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting
- Helmet.js security headers
- Input validation with Joi
- SQL injection protection via Sequelize
- CORS configuration

## Deployment

### AWS EC2 Deployment
1. Set up EC2 instance
2. Install Node.js and PostgreSQL
3. Clone repository
4. Install dependencies
5. Configure environment variables
6. Set up PM2 for process management
7. Configure nginx as reverse proxy

### Environment Variables
See `.env.example` for all required environment variables.

## Monitoring

- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Real-time monitoring via Winston logger

## Support

For issues or questions, contact the development team.

---

**Developer**: Dhanush Padarthi  
**Client**: Assure Chit Funds Private Limited  
**License**: Proprietary
