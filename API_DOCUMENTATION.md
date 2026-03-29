# API Documentation

## Base URL
```
Development: http://localhost:5000/api/v1
Production: https://api.assurechits.com/api/v1
```

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### Register New User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass@123",
  "date_of_birth": "1990-01-15",
  "address": "123 Main St, City"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify OTP sent to your phone.",
  "data": {
    "userId": 1,
    "otpSent": true
  }
}
```

---

### Verify OTP
```http
POST /auth/verify-otp
```

**Request Body:**
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "role": "member"
    }
  }
}
```

---

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "phone": "9876543210",
  "password": "SecurePass@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "full_name": "John Doe",
      "email": "john@example.com",
      "kyc_status": "verified",
      "credit_score": 750
    }
  }
}
```

---

### Forgot Password
```http
POST /auth/forgot-password
```

**Request Body:**
```json
{
  "phone": "9876543210"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your phone"
}
```

---

### Reset Password
```http
POST /auth/reset-password
```

**Request Body:**
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "newPassword": "NewPass@123"
}
```

---

## 👤 User Endpoints

### Get User Profile
```http
GET /users/profile
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "kyc_status": "verified",
    "credit_score": 750,
    "total_groups": 3,
    "total_invested": 150000
  }
}
```

---

### Update Profile
```http
PUT /users/profile
```
🔒 **Requires Authentication**

**Request Body:**
```json
{
  "full_name": "John Smith",
  "email": "johnsmith@example.com",
  "address": "456 New Street"
}
```

---

### Upload KYC Documents
```http
POST /users/kyc-upload
```
🔒 **Requires Authentication**

**Request:** Multipart Form Data
```
aadhaar_front: File
aadhaar_back: File
pan_card: File
photo: File
```

---

## 💰 Chit Group Endpoints

### Get All Chit Groups
```http
GET /chit-groups
```
🔒 **Requires Authentication**

**Query Parameters:**
- `status` (optional): active | pending | completed
- `page` (default: 1)
- `limit` (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": 1,
        "group_name": "Premium Chit 100K",
        "total_amount": 100000,
        "monthly_installment": 4166,
        "duration_months": 24,
        "member_count": 20,
        "status": "active",
        "next_auction_date": "2025-02-01T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### Get Chit Group Details
```http
GET /chit-groups/:id
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "group_name": "Premium Chit 100K",
    "total_amount": 100000,
    "monthly_installment": 4166,
    "duration_months": 24,
    "commission_percentage": 5,
    "start_date": "2024-01-01",
    "members": [
      {
        "user_id": 1,
        "full_name": "John Doe",
        "ticket_number": 1,
        "status": "active"
      }
    ],
    "auctions": [
      {
        "auction_number": 1,
        "scheduled_date": "2024-02-01",
        "status": "completed",
        "winning_bid": 15000,
        "winner_name": "Jane Smith"
      }
    ]
  }
}
```

---

### Join Chit Group
```http
POST /chit-groups/:id/join
```
🔒 **Requires Authentication**

**Request Body:**
```json
{
  "ticket_number": 5
}
```

---

### Create Chit Group (Admin Only)
```http
POST /chit-groups
```
🔒 **Requires Admin Role**

**Request Body:**
```json
{
  "group_name": "Premium Chit 200K",
  "total_members": 25,
  "total_amount": 200000,
  "duration_months": 25,
  "commission_percentage": 5,
  "monthly_installment": 8000,
  "start_date": "2025-03-01"
}
```

---

## 🎯 Auction Endpoints

### Get Upcoming Auctions
```http
GET /auctions/upcoming
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "chit_group_id": 1,
      "group_name": "Premier Chit 100K",
      "auction_number": 5,
      "scheduled_date": "2025-02-01T10:00:00Z",
      "prize_amount": 100000,
      "status": "scheduled"
    }
  ]
}
```

---

### Get Auction Details
```http
GET /auctions/:id
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 10,
    "chit_group_id": 1,
    "auction_number": 5,
    "scheduled_date": "2025-02-01T10:00:00Z",
    "actual_date": null,
    "prize_amount": 100000,
    "status": "live",
    "current_highest_bid": 12000,
    "current_bidder": "Participant #7",
    "total_participants": 15,
    "time_remaining": "00:05:30"
  }
}
```

---

### Place Bid
```http
POST /auctions/:id/bid
```
🔒 **Requires Authentication**

**Request Body:**
```json
{
  "bid_amount": 13000
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Bid placed successfully",
  "data": {
    "bid_id": 45,
    "bid_amount": 13000,
    "is_leading": true
  }
}
```

---

### Finalize Auction (Admin Only)
```http
POST /auctions/:id/finalize
```
🔒 **Requires Admin Role**

---

## 💳 Payment Endpoints

### Get Payment History
```http
GET /payments
```
🔒 **Requires Authentication**

**Query Parameters:**
- `status`: pending | success | failed
- `page`: Page number
- `limit`: Results per page

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "chit_group_id": 1,
        "group_name": "Premium Chit 100K",
        "amount": 4166,
        "payment_type": "installment",
        "status": "success",
        "payment_method": "upi",
        "transaction_id": "TXN123456",
        "payment_date": "2025-01-15T14:30:00Z"
      }
    ],
    "total": 12,
    "page": 1
  }
}
```

---

### Initiate Payment
```http
POST /payments/initiate
```
🔒 **Requires Authentication**

**Request Body:**
```json
{
  "chit_group_id": 1,
  "amount": 4166,
  "payment_type": "installment"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment_id": 25,
    "order_id": "ORDER_123456",
    "payment_url": "https://cashfree.com/pay/ORDER_123456",
    "amount": 4166
  }
}
```

---

### Verify Payment
```http
POST /payments/verify
```
🔒 **Requires Authentication**

**Request Body:**
```json
{
  "payment_id": 25,
  "order_id": "ORDER_123456",
  "signature": "abc123xyz"
}
```

---

## 📊 Dashboard Endpoints

### Get Dashboard Stats
```http
GET /dashboard/stats
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_groups": 3,
    "active_groups": 2,
    "total_invested": 125000,
    "total_received": 50000,
    "pending_payments": 4166,
    "next_auction": {
      "group_name": "Premium Chit 100K",
      "date": "2025-02-01T10:00:00Z"
    },
    "credit_score": 750,
    "recent_notifications": [
      {
        "title": "Upcoming Auction",
        "message": "Auction for Premium Chit 100K on Feb 1",
        "date": "2025-01-28"
      }
    ]
  }
}
```

---

## 📄 Document Endpoints

### Get Documents
```http
GET /documents
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "document_type": "agreement",
      "chit_group_id": 1,
      "group_name": "Premium Chit 100K",
      "file_name": "agreement_group1.pdf",
      "file_url": "https://s3.amazonaws.com/...",
      "uploaded_at": "2024-01-01"
    }
  ]
}
```

---

### Upload Document
```http
POST /documents/upload
```
🔒 **Requires Authentication**

**Request:** Multipart Form Data
```
document_type: agreement | receipt | other
chit_group_id: 1
file: File
```

---

## 🔔 Notification Endpoints

### Get Notifications
```http
GET /notifications
```
🔒 **Requires Authentication**

**Query Parameters:**
- `unread`: true | false
- `page`: Page number

---

### Mark as Read
```http
PUT /notifications/:id/read
```
🔒 **Requires Authentication**

---

## 🤝 Referral Endpoints

### Get Referral Stats
```http
GET /referrals/stats
```
🔒 **Requires Authentication**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "referral_code": "JOHN2025",
    "total_referrals": 5,
    "successful_joins": 3,
    "total_earnings": 1500,
    "pending_earnings": 500
  }
}
```

---

### Get Referral History
```http
GET /referrals
```
🔒 **Requires Authentication**

---

## ⚠️ Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 🔌 WebSocket Events (Socket.IO)

### Connect to Auction Room
```javascript
socket.emit('join_auction', { auctionId: 10 });
```

### Place Bid (Real-time)
```javascript
socket.emit('place_bid', {
  auctionId: 10,
  bidAmount: 13000
});
```

### Listen for New Bids
```javascript
socket.on('new_bid', (data) => {
  console.log('New bid:', data);
  // { bidder: "User #7", bidAmount: 13500, timestamp: "..." }
});
```

### Auction Updates
```javascript
socket.on('auction_update', (data) => {
  // Real-time auction status updates
});
```

### Leave Auction
```javascript
socket.emit('leave_auction', { auctionId: 10 });
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- Amounts are in INR (Indian Rupees)
- File uploads use multipart/form-data
- Maximum file size: 5MB
- Supported image formats: JPG, PNG, PDF
- Rate limit: 100 requests per 15 minutes
- Token expiry: 7 days

---

**Version:** 1.0.0  
**Last Updated:** January 2025
