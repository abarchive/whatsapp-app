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
7. **Real-time Updates**: Socket.IO for instant status updates (requires proper WebSocket support)

## Tech Stack
- **Frontend**: React 18, Tailwind CSS, socket.io-client
- **Backend**: FastAPI (Python) with asyncpg, python-socketio
- **Database**: PostgreSQL (self-hosted on VPS)
- **WhatsApp Service**: Node.js with whatsapp-web.js library
- **Real-time**: Socket.IO with fallback polling
- **Process Management**: Supervisor

## Recent Updates (Feb 19, 2026)

### Socket.IO Implementation ✅
- Backend: python-socketio with ASGI
- Frontend: socket.io-client
- WhatsApp Service: Events emission to backend
- Nginx config with WebSocket support

### Architecture Flow
```
WhatsApp Service → POST /api/internal/ws-event → Backend Socket.IO → Frontend
       ↓                                              ↓
   Events:                                      Real-time UI:
   - qr_code                                    - QR displayed
   - whatsapp_connected                         - Status: Connected
   - whatsapp_disconnected                      - Status: Disconnected
```

## File Structure
```
/app/
├── backend/server.py           # FastAPI + Socket.IO (socket_app)
├── frontend/src/               # React + socket.io-client
├── whatsapp-service/index.js   # Node.js with axios for events
├── nginx/botwave.conf          # Nginx config with WebSocket support
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
- `POST /api/internal/ws-event` - **Internal** Socket.IO event receiver

## Socket.IO Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `authenticate` | Client → Server | Send JWT token for auth |
| `authenticated` | Server → Client | Confirm authentication |
| `qr_code` | Server → Client | QR code ready |
| `whatsapp_connected` | Server → Client | WhatsApp connected |
| `whatsapp_disconnected` | Server → Client | WhatsApp disconnected |

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
- [x] **Socket.IO real-time updates**
- [x] Nginx WebSocket config

## VPS Deployment Notes

### Nginx WebSocket Configuration
The `/app/nginx/botwave.conf` file contains WebSocket-enabled Nginx config:
- `/socket.io` path with upgrade headers
- 7 day timeout for WebSocket connections
- Proper proxy headers

### Supervisor Configuration
```ini
[program:backend]
command=/root/.venv/bin/uvicorn server:socket_app --host 0.0.0.0 --port 8001 --workers 1
```
**Note**: Use `socket_app` NOT `app`, and NO `--reload` flag for Socket.IO to work.

## Known Limitations

### Preview Environment (Kubernetes)
- WebSocket upgrade not fully supported by ingress
- Socket.IO falls back to polling
- Connection keeps reconnecting

### VPS (Nginx)
- Full WebSocket support ✅
- Stable connections ✅
- Real-time updates work instantly ✅

## Test Users
- **Admin**: admin@admin.com / Admin@7501
- **Test User**: testuser@botwave.pro / Test@123456

## Database Connection (VPS)
```
PostgreSQL: postgresql://botwave_user:BotWave%40SecurePass123@localhost:5432/botwave
```

## Preview URL
https://msg-sender-5.preview.emergentagent.com

## Future Tasks
- [ ] Forgot Password (email-based recovery)
- [ ] Webhooks for message delivery callbacks
- [ ] Subscription/Payment integration (Stripe/Razorpay)
- [ ] Rate limiting enforcement
