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
- **Status: active/deactive** - Deactive users cannot login

### 4. Message Logging
- Logs all messages: sender, receiver, body, timestamp, status, origin
- Message History UI with filters

### 5. Admin Panel (COMPLETED - Light Theme)
- **Dashboard**: Real data - user stats, message stats, charts
- **User Management**: CRUD with email, password (visible), role, status (active/deactive), rate limit
- **Message Analytics**: Bar charts with real data from database
- **System Status**: All services monitoring (filtered code-server)
- **WhatsApp Session Management**: Connection status, disconnect option
- **Settings**: Rate limiting, Enable/Disable Registration, Maintenance Mode
- **Activity Logs**: Shows target user email for updates/deletes

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
│   │   │   │   └── AdminLayout.js  # Light theme sidebar
│   │   │   └── ui/
│   │   ├── pages/
│   │   │   ├── admin/  # Admin panel pages (all light theme)
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
- [x] User Registration & Login (respects enable_registration setting)
- [x] JWT Authentication
- [x] Deactive user cannot login (shows proper error)
- [x] Dashboard with QR Code generation
- [x] Send Message (Web UI)
- [x] Send Message (GET API)
- [x] Message Logs with filters
- [x] API Key Management
- [x] User Profile

### Admin Features (Light Theme)
- [x] Admin Login (/admin/login)
- [x] Admin Dashboard with real data charts (/admin/dashboard)
- [x] User Management - email, password visible, active/deactive status (/admin/users)
- [x] Message Analytics with bar charts - real data (/admin/analytics)
- [x] System Status - filtered code-server (/admin/system)
- [x] WhatsApp Session Management (/admin/whatsapp)
- [x] Settings - Rate limits, Registration toggle, Maintenance mode (/admin/settings)
- [x] Activity Logs with target user email (/admin/logs)
- [x] Admin Route Protection
- [x] Admin can login during maintenance mode

## Settings Functionality (Working)
- **Enable Registration**: When disabled, new users cannot register
- **Maintenance Mode**: When enabled, non-admin users cannot login (shows maintenance message)
- **Rate Limiting**: Configurable per-user rate limits

## API Endpoints

### User Auth
- POST /api/auth/register (respects enable_registration)
- POST /api/auth/login (checks deactive status, maintenance mode)
- GET /api/auth/me

### WhatsApp
- GET /api/send (API key auth)
- POST /api/messages/send (JWT auth)
- GET /api/whatsapp/status
- POST /api/whatsapp/initialize
- POST /api/whatsapp/disconnect
- GET /api/whatsapp/qr

### Admin
- GET /api/admin/users (includes plain_password for new users)
- POST /api/admin/users (stores plain_password)
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

## Changes Made in This Session
1. Admin panel converted to **light theme**
2. Users page shows **password** (visible with eye icon for new users)
3. Status uses **active/deactive** instead of suspended
4. **Deactive users cannot login** - proper error message shown
5. Analytics shows **real data** from database
6. **Registration toggle** working - disabled users can't register
7. **Maintenance mode** working - non-admin users blocked (admin can still login)
8. Activity logs show **target user email** for update/delete actions
9. Sidebar **Logout button fixed** - no overlap
10. System Status filters out **code-server** (not needed for app)

## Pending/Backlog Features
- [ ] Forgot Password (SMTP integration needed)
- [ ] Backend Rate Limiting implementation (per-request)
- [ ] Webhook callbacks for message delivery
- [ ] Dark/Light mode toggle for user panel
- [ ] WebSocket-based real-time updates (instead of polling)

## Known Issues
1. **WhatsApp Service Stability**: The chromium dependency may disappear after long idle periods. Pre-start scripts and health monitoring daemon implemented as workaround.
2. **Old Users Password**: Users created before this update won't have visible passwords

## Test Reports
- Backend tests: /app/backend/tests/
- Test results: /app/test_reports/
