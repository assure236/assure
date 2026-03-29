# Assure ChitFunds - Technology Stack

## Overview
This document outlines the complete technology stack for the Assure ChitFunds digital platform, including infrastructure, development frameworks, and third-party integrations.

---

## 1. Domain & DNS
- **Provider:** GoDaddy
- **Purpose:** Domain registration and DNS management

---

## 2. Cloud Infrastructure
**Provider:** Amazon Web Services (AWS)

### Services Used:
- **Amazon EC2** - Backend API server hosting
- **Amazon S3** - File storage and frontend hosting
- **Amazon CloudFront** - Content Delivery Network (CDN) for fast content delivery
- **Amazon RDS PostgreSQL** - Database management system
- **Amazon SNS** - SMS OTP service and notifications

---

## 3. Frontend (Web Application)
- **Framework:** React.js
- **Purpose:** Web application development for member and admin portals

---

## 4. Backend (API Server)
- **Runtime:** Node.js
- **Purpose:** Backend API development and business logic

---

## 5. Mobile Application
**Framework:** Flutter

### Distribution Channels:
- **Android Application** - Published on Google Play Store
- **iOS Application** - Published on Apple App Store

---

## 6. Payment Gateway
- **Provider:** Cashfree Payments
- **Purpose:** 
  - Installment payment processing
  - Transaction management
  - Digital collections

---

## 7. KYC Verification
- **Provider:** DigiLocker
- **Purpose:** 
  - Digital identity verification
  - Secure document access
  - e-KYC compliance

---

## 8. Push Notifications & OTP Service
- **Provider:** Amazon SNS (AWS)
- **Services:**
  - SMS OTP delivery
  - Push notification delivery
  - Transaction alerts
  - Payment reminders

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interfaces                         │
├──────────────────┬──────────────────┬──────────────────────┤
│   Web (React)    │  Android (Flutter) │   iOS (Flutter)    │
└────────┬─────────┴──────────┬────────┴──────────┬──────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  CloudFront (CDN)  │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   EC2 (Node.js)   │
                    │   Backend API     │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐      ┌────────▼────────┐   ┌──────▼──────┐
    │   RDS   │      │   S3 Storage    │   │  Amazon SNS │
    │PostgreSQL│      │  (Files/Docs)   │   │ (SMS/Push) │
    └─────────┘      └─────────────────┘   └─────────────┘

External Integrations:
├─ Cashfree (Payments)
├─ DigiLocker (KYC)
└─ GoDaddy (DNS)
```

---

## Development & Deployment Notes

### Frontend Hosting
- Static files hosted on Amazon S3
- Distributed via CloudFront CDN for optimal performance

### Backend Hosting
- Node.js API hosted on EC2 instances
- Scalable infrastructure for handling concurrent users

### Database
- PostgreSQL on Amazon RDS
- Managed database service with automatic backups

### Mobile Apps
- Cross-platform development using Flutter
- Single codebase for both Android and iOS
- Published on official app stores

### Security
- SSL/TLS encryption via CloudFront
- Secure API communication
- AWS SNS for secure OTP delivery
- DigiLocker for KYC compliance

---

**Last Updated:** March 16, 2026
