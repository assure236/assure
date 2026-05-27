# Assure ChitFunds — Login Credentials

Security note: keep real credentials only on your VPS/local secret manager. Do not commit actual passwords or tokens to git.

## Admin Panel (http://localhost:3001)

| Role  | Email                        | Password      |
|-------|------------------------------|---------------|
| Admin | admin@assurechitfunds.com    | <set-locally> |

---

## Web Portal (http://localhost:3000)

| Name          | Email                         | Password       | Mobile     |
|---------------|-------------------------------|----------------|------------|
| Test Member   | test@assurechitfunds.com      | <set-locally>  | 9876543210 |
| Priya Sharma  | priya@assurechitfunds.com     | <set-locally>  | 9123456780 |

---

## Backend API

| URL   | http://localhost:5000/api/v1 |
|-------|------------------------------|

---

## Database (PostgreSQL)

| Field    | Value             |
|----------|-------------------|
| Host     | localhost         |
| Port     | 5432              |
| Database | assure_chitfunds  |
| User     | postgres          |
| Password | <set-locally>     |
