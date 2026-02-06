# WhatsApp Automation System - PRD

## Original Problem Statement
Build a full-stack, production-level WhatsApp automation system (similar to WhatsBot/Wati) that allows users to:
- Connect their WhatsApp via QR code
- Send messages through a web dashboard or external GET API
- Manage users and view analytics through an admin panel

## Core Features

### 1. WhatsApp QR Login
- Generate QR code on dashboard
- Uses `whatsapp-web.js` library (Node.js service)
- Stored authenticated sessions
- Auto-reconnect functionality
- Real-time connection status

### 2. Message Sending (Web + API)
- **Web App**: Form to input mobile number and message, real-time message logs
- **GET API**: `/api/send?api_key=...&number=...&msg=...` with API key authentication

### 3. User Authentication
- Full login/register system with email/password (bcrypt)
- JWT sessions (30-day expiry)
- Role-based access (user/admin)

### 4. Message Logging
- Logs all messages: sender, receiver, body, timestamp, status, origin
- Message History UI with filters

### 5. Admin Panel (COMPLETED)
- User Management (CRUD)
- Message Analytics with bar charts
- System Status monitoring
- WhatsApp Session Management
- Global Settings configuration
- Activity Logs with pagination

## Tech Stack
- **Frontend**: React + Tailwind CSS
- **Main Backend**: FastAPI (Python)
- **WhatsApp Service**: Node.js/Express with whatsapp-web.js
- **Database**: MongoDB
- **Process Manager**: Supervisor

## Architecture
```
/app/
├── backend/           # FastAPI backend
│   ├── server.py      # All API routes
│   ├── tests/         # pytest tests
│   └── .env
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   └── ui/
│   │   ├── pages/
│   │   │   ├── admin/  # Admin panel pages
│   │   │   └── ...     # User pages
│   │   └── App.js
│   └── package.json
├── whatsapp-service/  # Node.js WhatsApp integration
│   ├── index.js
│   └── .wwebjs_auth/  # Session storage
└── scripts/           # Health monitoring scripts
```

## Implemented Features (as of Dec 2025)

### User Features
- [x] User Registration & Login
- [x] JWT Authentication
- [x] Dashboard with QR Code generation
- [x] Send Message (Web UI)
- [x] Send Message (GET API)
- [x] Message Logs with filters
- [x] API Key Management
- [x] User Profile

### Admin Features (NEW)
- [x] Admin Login (/admin/login)
- [x] Admin Dashboard with charts (/admin/dashboard)
- [x] User Management CRUD (/admin/users)
- [x] Message Analytics with bar charts (/admin/analytics)
- [x] System Status monitoring (/admin/system)
- [x] WhatsApp Session Management (/admin/whatsapp)
- [x] Global Settings (/admin/settings)
- [x] Activity Logs with pagination (/admin/logs)
- [x] Admin Route Protection

## API Endpoints

### User Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### WhatsApp
- GET /api/send (API key auth)
- POST /api/messages/send (JWT auth)
- GET /api/whatsapp/status
- POST /api/whatsapp/initialize
- POST /api/whatsapp/disconnect
- GET /api/whatsapp/qr

### Admin
- GET /api/admin/users
- POST /api/admin/users
- PUT /api/admin/users/{user_id}
- DELETE /api/admin/users/{user_id}
- GET /api/admin/analytics/overview
- GET /api/admin/analytics/messages
- GET /api/admin/analytics/users-activity
- GET /api/admin/system/status
- GET /api/admin/whatsapp/sessions
- POST /api/admin/whatsapp/disconnect
- GET /api/admin/settings
- PUT /api/admin/settings
- GET /api/admin/logs

## Credentials
- **Admin**: admin@admin.com / Admin@7501

## Pending/Backlog Features
- [ ] Forgot Password (SMTP integration needed)
- [ ] Backend Rate Limiting implementation
- [ ] Webhook callbacks for message delivery
- [ ] Dark/Light mode toggle
- [ ] WebSocket-based real-time updates (instead of polling)

## Known Issues
1. **WhatsApp Service Stability**: The chromium dependency may disappear after long idle periods. Pre-start scripts and health monitoring daemon implemented as workaround.
2. **QR Code Scanning**: Sometimes requires 2-3 scans (tied to Issue #1)

## Test Reports
- Backend tests: /app/backend/tests/test_admin_api.py
- Test results: /app/test_reports/iteration_1.json
