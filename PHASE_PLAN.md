# Assure ChitFunds — Phase Plan
> Last updated: Phase 3 fully complete — mobile feature gap-fill done (Help Center, Support Chat, Analytics 3-tab, Edit Profile, Change Password, Receipt Sharing, Router) + QA audit (9 bugs fixed)
> Based on Annexure-A feature requirements

---

## Legend
- ✅ Done & working
- 🔶 Scaffold exists (file created, UI/logic incomplete)
- ❌ Not started
- ⚠️ Blocked (external dependency)

---

## PHASE 1 — Foundation & Auth ✅ COMPLETE

### Backend
| Item | Status |
|------|--------|
| Node.js / Express project setup | ✅ |
| PostgreSQL models (User, ChitGroup, ChitMember, Auction, Bid, Payment, Document, Referral, Notification) | ✅ |
| JWT auth middleware | ✅ |
| Error handler middleware | ✅ |
| Validation middleware | ✅ |
| Auth controller — register (phone + OTP + MPIN) | ✅ |
| Auth controller — login with MPIN | ✅ |
| Auth controller — OTP send/verify | ✅ API ready, SMS blocked (see ⚠️) |
| User controller — profile CRUD | ✅ |
| Socket.io setup | ✅ |
| AWS S3 document upload config | ✅ |
| AWS SES email config | ✅ |

### Mobile App (Flutter)
| Item | Status |
|------|--------|
| Flutter project structure (features / core) | ✅ |
| GoRouter navigation | ✅ |
| Provider state management | ✅ |
| Theme (colors, typography) | ✅ |
| ApiService (HTTP client, 10s timeout) | ✅ |
| Splash screen | ✅ |
| Welcome screen | ✅ |
| Register screen — 4 steps (phone, OTP, profile, MPIN) | ✅ |
| Login screen — 3 steps (phone, OTP, MPIN) | ✅ |
| MPIN quick-login screen | ✅ |
| AuthProvider (state + API calls) | ✅ |

### ⚠️ Blocked
- **SMS OTP** — MSG91 needs DLT Sender ID approval, Fast2SMS needs website verification, AWS SNS needs India DLT. All parked until provider is approved. OTP flow works in code, just SMS delivery is blocked.

---

## PHASE 2 — Member Dashboard & Chit Groups ✅ COMPLETE (100%)

### Backend
| Item | Status |
|------|--------|
| Dashboard controller (`/dashboard/member`) | ✅ |
| ChitGroup controller — list, detail, enroll | ✅ |
| ChitMember controller | ✅ |
| Payment controller — list, pay installment | ✅ |
| Auction controller — list, detail, live bid | ✅ |
| Referral controller | ✅ |
| KYC controller | ✅ |
| Document controller | ✅ |
| Notification controller | ✅ |
| **Admin routes (`/api/v1/admin/*`)** | ✅ Created & verified |
| **`userController.changePassword` — password_hash field fix** | ✅ |
| **`/users/support` POST endpoint** | ✅ |
| **`/users/change-password` PUT endpoint** | ✅ |

### QA Audit Fixes (cross-cutting)
| Item | Status |
|------|--------|
| Web ChitGroups: `avRes.data.data.groups` → safe fallback for missing `groups` key | ✅ |
| Admin ChitGroups members column: `enrolled_count` from DB join (`is_active: true`) | ✅ |
| Backend admin chit-groups GET: added ChitMember join returning `enrolled_count` | ✅ |
| Accounting CSV export button: added functional onClick downloading real CSV | ✅ |
| `enrollInChitGroup`: `status: 'active'` → `is_active: true` field fix | ✅ |
| Reports: `start_date` → `commencement_date` field name fix | ✅ |
| Dashboard: added `paymentsThisMonth` query (sum of current month successful payments) | ✅ |

### Mobile App
| Item | Status |
|------|--------|
| DashboardProvider (with token-skip logic) | ✅ |
| Dashboard screen — header, stats, quick actions, chit cards, auctions, payments | ✅ |
| Bottom navigation (4 tabs) | ✅ |
| ChitGroupProvider | ✅ |
| Chit Groups list screen | ✅ |
| Chit Group detail screen | ✅ |
| Auctions screen | ✅ |
| Payments screen | ✅ |
| Profile screen — basic info + logout | ✅ |
| AuctionProvider | ✅ |
| PaymentProvider | ✅ |
| NotificationProvider | ✅ |
| Bug fix — `chit_group_details_screen.dart` num→int cast (line 299) | ✅ |

### Web Portal (React)
| Item | Status |
|------|--------|
| React project setup | ✅ |
| Auth — Login page | ✅ |
| Auth — Register page | ✅ |
| Auth — Forgot Password page | ✅ |
| PrivateRoute guard | ✅ |
| Dashboard page | ✅ |
| Chit Groups list page | ✅ |
| Chit Group detail page | ✅ |
| Auctions list page | ✅ |
| Auction Room (live bidding) | ✅ |
| Payments page | ✅ |
| Profile page | ✅ |
| Documents page | ✅ |
| Referrals page | ✅ |
| Help Center page | ✅ |
| Bug fix — `web/Dashboard.js` duplicate component/export removed | ✅ |
| **Bug fix — Login.js: email/password → mobile/mpin fields, await login before navigate** | ✅ |
| **Bug fix — Dashboard.js: Sequelize camelCase aliases (chitGroup)** | ✅ |
| **Bug fix — Profile.js: phone_number→mobile, correct change-password endpoint/method** | ✅ |
| **Bug fix — Payments.js: chitGroup camelCase association** | ✅ |
| **Bug fix — Auctions.js + AuctionRoom.js: chitGroup camelCase association** | ✅ |
| **Bug fix — ChitGroupDetails.js: mobile/phone_number field** | ✅ |

### Admin Panel (React)
| Item | Status |
|------|--------|
| Admin project setup | ✅ |
| Auth pages | ✅ |
| Dashboard page | ✅ |
| Users management | ✅ |
| ChitGroups management | ✅ |
| Create ChitGroup form | ✅ |
| Auctions management | ✅ |
| Payments management | ✅ |
| Reports | ✅ |
| Settings | ✅ |
| Bug fix — `admin/Dashboard.js` orphaned scaffold JSX removed | ✅ |
| **Bug fix — AuthContext.js: axios baseURL, token restoration on reload** | ✅ |
| **All admin endpoints now wired to real DB queries (dashboard, users, chit-groups, auctions, payments, reports, settings)** | ✅ |

---

## PHASE 3 — Core Feature Completion ✅ COMPLETE

### Mobile App — Priority Order
| # | Feature | Status |
|---|---------|--------|
| 1 | Chit Groups screen — full list, search, filter, enroll button | ✅ (Phase 2) |
| 2 | Chit Group detail — info, members, payment schedule, auction history | ✅ (Phase 2) |
| 3 | Payments screen — history list + Pay Installment button | ✅ (Phase 2) |
| 4 | Auctions screen — upcoming/live/past tabs | ✅ (Phase 2) |
| 5 | Live Auction Room — real-time bidding via Socket.io, bid timer, bid history | ✅ |
| 6 | KYC screen — PAN entry, DigiLocker flow | ✅ |
| 7 | Document Vault screen — view/upload docs with status | ✅ |
| 8 | Notifications screen — list, mark read, delete, tabs | ✅ |
| 9 | Analytics screen — 6-month chart + payment pie chart (fl_chart) | ✅ |
| 10 | Refer & Earn screen — share referral code, track rewards | ✅ |
| 11 | NotificationProvider — full implementation | ✅ |
| 12 | Router — all new routes wired (/kyc, /documents, /notifications, /referrals, /analytics, /auctions/:id) | ✅ |
| 13 | ApiService — uploadFile multipart method added | ✅ |
| 14 | pubspec.yaml — share_plus added | ✅ |
| 15 | **Help Center screen** — Tutorials + FAQs tabs, 6 tutorials, 8 FAQs, links to /support | ✅ |
| 16 | **Support Chat screen** — chatbot UI, typing indicator, quick replies, auto-responses, API ticket submission | ✅ |
| 17 | **Analytics screen** — rewritten with 3-tab structure (Overview / Dividends / Calculator) | ✅ |
| 18 | **Edit Profile screen** — fullName, email, PAN form with validators, calls `updateProfile()` | ✅ |
| 19 | **Change Password screen** — current/new/confirm fields, strength tips, calls `/auth/change-password` | ✅ |
| 20 | **Payments: Receipt sharing** — tappable receipts, bottom sheet details, share_plus export | ✅ |
| 21 | **Profile screen** — avatar taps to /edit-profile, Help Center/Support/Change Password wired | ✅ |
| 22 | **Router** — /help, /support, /edit-profile, /change-password routes added | ✅ |
| 23 | **Auctions screen** — removed dead `_showBidDialog` stub (entry via AuctionRoom handles bidding) | ✅ |

### Web Portal — Priority Order
| # | Feature | Status |
|---|---------|--------|
| 1 | Public landing page — hero, features, chit schemes, how-it-works, footer | ✅ |
| 2 | Dashboard — analytics charts (AreaChart + PieChart via recharts) | ✅ |
| 3 | Live Auction Room — Socket.io real-time, fallback to polling | ✅ |
| 4 | Notifications page — tabs, mark read/all, delete, load more | ✅ |
| 5 | Backend analytics endpoint (`GET /dashboard/analytics`) | ✅ |
| 6 | Backend enhanced member detail (`GET /admin/users/:id`) | ✅ |

### Admin Panel — Priority Order
| # | Feature | Status |
|---|---------|--------|
| 1 | Member detail — tabbed dialog (Profile / Payments / Chit Groups / Documents) | ✅ |

---

## PHASE 4 — Integrations ❌ PLANNED

| Integration | Status | Notes |
|-------------|--------|-------|
| Payment Gateway (Razorpay) | ❌ | For online installment collection |
| Automatic receipt generation (PDF) | ❌ | Email via AWS SES after payment |
| Automatic disbursal to auction winners | ❌ | Bank transfer via Razorpay Payouts |
| Late fee auto-calculation | ❌ | Cron job on payment due dates |
| Credit scoring engine | ❌ | Based on payment discipline / defaults |
| ERPNext integration | ❌ | Real-time financial sync |
| DigiLocker API (e-KYC) | ❌ | For instant PAN/Aadhaar verification |
| SMS Gateway | ⚠️ | MSG91/Fast2SMS blocked; retry after DLT approval |
| Push Notifications (FCM) | ❌ | Firebase Cloud Messaging |
| AWS SES email | ✅ Config done | Needs domain verification in SES |
| AWS S3 document storage | ✅ Config done | |
| Socket.io real-time auctions | ✅ Backend + web + mobile wired | |

---

## PHASE 5 — Security & Production Hardening ❌ PLANNED

| Item | Status |
|------|--------|
| Remove dev "Skip" button from login | ❌ |
| Lock all routes behind auth in router | ❌ |
| Rotate any previously exposed AWS credentials | ❌ URGENT |
| HTTPS / SSL certificate | ❌ |
| Rate limiting on OTP + auth endpoints | ❌ |
| Input sanitization / SQL injection protection | ❌ |
| Regular DB backup setup | ❌ |
| Encrypted comms (HTTPS enforced) | ❌ |
| Data privacy / PDPA compliance review | ❌ |

---

## PHASE 6 — Deployment ❌ PLANNED

| Item | Status |
|------|--------|
| Domain configuration | ❌ |
| Server/cloud hosting setup (EC2 / Render / Railway) | ❌ |
| PostgreSQL production DB (RDS or managed) | ❌ |
| Backend deployment + PM2 process manager | ❌ |
| Web portal deployment (Vercel / Netlify / S3 CloudFront) | ❌ |
| Admin panel deployment | ❌ |
| Flutter app — Play Store submission | ❌ |
| Flutter app — App Store submission (if iOS needed) | ❌ |
| CI/CD pipeline | ❌ |

---

## PHASE 7 — Documentation & Training ❌ PLANNED

| Item | Status |
|------|--------|
| User manual (member-facing) | ❌ |
| Admin user manual | ❌ |
| API documentation | ✅ API_DOCUMENTATION.md exists |
| Training videos | ❌ |
| System/technical documentation | ❌ |

---

## Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation & Auth | ✅ Complete |
| 2 | Dashboard & Chit Groups | ✅ Complete |
| 3 | Core Feature Completion + Mobile Gap-Fill | ✅ Complete |
| 4 | Integrations | ❌ Planned |
| 5 | Security & Production Hardening | ❌ Planned |
| 6 | Deployment | ❌ Planned |
| 7 | Documentation & Training | ❌ Planned |
| 4 | Integrations | ❌ ~20% (S3/SES config only) |
| 5 | Security & Hardening | ❌ Not started |
| 6 | Deployment | ❌ Not started |
| 7 | Documentation & Training | ❌ Not started |

**Overall estimate: ~20% complete**

---

## Immediate Next Steps (Phase 2 completion)

1. **Mobile** — Build Chit Groups screen (full, not scaffold)
2. **Mobile** — Build Payments screen with real data
3. **Mobile** — Build Auctions screen + Live Auction Room
4. **Mobile** — KYC screen + Document Vault
5. **Web** — Build all scaffold pages into real working screens
6. **Admin** — Build members + chit group management
7. **Integration** — Wire Razorpay for payments
8. **Integration** — Wire FCM for push notifications
9. **SMS** — Get DLT approved and enable OTP
10. **Security** — Rotate AWS keys, lock routes, add rate limiting
