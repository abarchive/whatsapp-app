# WhatsApp Automation Bot - Product Requirements Document

## Original Problem Statement
Build a full-stack, production-level web application that functions as a WhatsApp automation system (similar to WhatsBot or Wati). The system should allow multiple users to connect their own WhatsApp accounts via QR code and send messages through web interface or API.

## Core Features
1. **Per-User WhatsApp QR Login**: Each user can connect their own WhatsApp account via QR code
2. **Stable Reconnection**: Users can disconnect and reliably reconnect with new QR codes
3. **Message Sending**: Web form + API endpoint for sending messages
4. **User Authentication**: Email/password login with JWT sessions
5. **Message Logging**: View all sent messages history
6. **Admin Panel**: Manage users, view analytics, monitor WhatsApp sessions

## Tech Stack
- **Frontend**: React 18, Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **WhatsApp Service**: Node.js with whatsapp-web.js library
- **Process Management**: Supervisor

## Architecture
```
/app/
├── backend/server.py           # FastAPI: Auth, APIs, Admin
├── frontend/src/               # React frontend
├── whatsapp-service/index.js   # Node.js WhatsApp service
└── backend/tests/              # Pytest test suite
```

## Key API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/whatsapp/initialize` - Initialize WhatsApp connection
- `GET /api/whatsapp/status` - Get connection status
- `GET /api/whatsapp/qr` - Get QR code
- `POST /api/whatsapp/disconnect` - Disconnect WhatsApp
- `POST /api/messages/send` - Send message (web)
- `GET /api/send` - Send message (API with api_key)

## What's Implemented ✅
- [x] User authentication (login/register)
- [x] JWT-based session management
- [x] Per-user WhatsApp QR code generation
- [x] WhatsApp connection via QR scan
- [x] **FIXED: Disconnect/Reconnect cycle now works reliably**
- [x] Message sending (web + API)
- [x] Message logging
- [x] Admin panel with user management
- [x] Admin session monitoring
- [x] API key management
- [x] Comprehensive test suite (15 tests passing)

## Test Results (Feb 14, 2026)
All 15 tests PASSED including:
- Authentication tests
- WhatsApp status/initialize/QR/disconnect tests
- **CRITICAL: Reconnect cycle QR regeneration - PASSED**
- **CRITICAL: Multiple disconnect-reconnect cycles - PASSED**
- Message sending tests
- API key management tests

## Known Issues (Backlog)
1. **⚠️ Security: Plaintext Passwords** - `plain_password` stored in users collection for admin panel. Should be replaced with password reset functionality.
2. **Rate Limiting** - UI toggle exists but API enforcement needs verification

## Future Tasks (P2/P3)
- [ ] Forgot Password (email-based recovery)
- [ ] Webhooks for message delivery callbacks
- [ ] Rate limiting verification
- [ ] VPS deployment (paused)

## Test Credentials
- **Admin**: admin@admin.com / Admin@7501

## Preview URL
https://msg-sender-5.preview.emergentagent.com
