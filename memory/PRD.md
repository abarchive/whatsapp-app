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
- **Backend**: FastAPI (Python) with asyncpg
- **Database**: PostgreSQL (self-hosted on VPS)
- **WhatsApp Service**: Node.js with whatsapp-web.js library
- **Status Updates**: Polling (2 second interval)
- **Process Management**: Supervisor

## Recent Updates (Feb 19, 2026)

### PostgreSQL Migration ✅
- Migrated from MongoDB Atlas to PostgreSQL
- All tables: users, message_logs, activity_logs, settings
- Migration scripts: `/app/scripts/setup_postgresql.sh`, `/app/scripts/schema.sql`

### SSE Removed ✅
- SSE (Server-Sent Events) implementation was removed
- Reverted to simple polling method for reliability
- Polling interval: 2 seconds

## Architecture
```
/app/
├── backend/server.py           # FastAPI with asyncpg
├── frontend/src/               # React frontend
├── whatsapp-service/index.js   # Node.js WhatsApp service
├── scripts/
│   ├── setup_postgresql.sh     # PostgreSQL VPS setup
│   └── schema.sql              # Database schema
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
- [x] Disconnect/Reconnect cycle works reliably
- [x] Message sending (web + API)
- [x] Message logging
- [x] Admin panel with user management
- [x] Admin session monitoring
- [x] API key management
- [x] PostgreSQL migration complete
- [x] Title: "BotWave – Smart WhatsApp Automation"
- [x] Removed "Made with Emergent" badge

## Database Schema (PostgreSQL)
```sql
-- Users
users (id UUID, email, password_hash, api_key, role, status, rate_limit, created_at)

-- Message Logs
message_logs (id UUID, user_id, receiver_number, message_body, status, source, created_at)

-- Activity Logs
activity_logs (id UUID, user_id, user_email, action, details, ip_address, created_at)

-- Settings
settings (id, default_rate_limit, max_rate_limit, enable_registration, maintenance_mode, updated_at)
```

## Known Issues (Backlog)
1. **⚠️ Security: Plaintext Passwords** - `plain_password` stored for admin panel view
2. **Rate Limiting** - UI toggle exists but API enforcement needs verification

## Future Tasks (P2/P3)
- [ ] Forgot Password (email-based recovery)
- [ ] Webhooks for message delivery callbacks
- [ ] Subscription/Payment integration (Stripe/Razorpay)
- [ ] Rate limiting enforcement
- [ ] Socket.IO for real-time updates (when deployed on VPS)

## Test Users
- **Admin**: admin@admin.com / Admin@7501
- **Test User**: testuser@botwave.pro / Test@123456

## Database Connection (VPS)
```
PostgreSQL: postgresql://botwave_user:BotWave%40SecurePass123@localhost:5432/botwave
```

## VPS Setup Commands
```bash
# 1. Run PostgreSQL setup script
chmod +x scripts/setup_postgresql.sh
./scripts/setup_postgresql.sh

# 2. Update backend/.env
DATABASE_URL=postgresql://botwave_user:YOUR_PASSWORD@localhost:5432/botwave
```

## Preview URL
https://msg-sender-5.preview.emergentagent.com
