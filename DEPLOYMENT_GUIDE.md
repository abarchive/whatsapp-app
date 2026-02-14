# WhatsApp Automation Platform - Complete Deployment Guide

## 🚀 Production-Ready WhatsApp Web Automation System

This guide covers everything you need to deploy and use the WhatsApp automation platform.

---

## ✅ System Status

**Current Implementation:**
- ✅ Real WhatsApp Web Integration (whatsapp-web.js)
- ✅ QR Code Login System
- ✅ Message Sending (Web + API)
- ✅ User Authentication (JWT)
- ✅ API Key Management
- ✅ Message Logging System
- ✅ MongoDB Database
- ✅ Real-time Socket.IO Updates

---

## 📋 Quick Start Guide

### Step 1: Access the Application
Open your browser and navigate to: `https://msg-sender-5.preview.emergentagent.com`

### Step 2: Create Account
1. Click "Sign up"
2. Enter email and password
3. Click "Create Account"

### Step 3: Login
1. Enter your credentials
2. Click "Login"
3. You'll be redirected to the Dashboard

### Step 4: Connect WhatsApp
1. On the Dashboard, click "Initialize WhatsApp"
2. Wait for QR code to appear (takes 5-10 seconds)
3. Open WhatsApp on your phone
4. Go to: **Settings → Linked Devices → Link a Device**
5. Scan the QR code displayed on your screen
6. Wait for "Connected" status

### Step 5: Send Messages

**Via Web Dashboard:**
1. Navigate to "Send Message"
2. Enter phone number (with or without country code)
3. Type your message
4. Click "Send Message"

**Via API:**
```bash
curl -X GET "https://msg-sender-5.preview.emergentagent.com/api/send?number=9876543210&msg=Hello+World" \
  -H "api_key: YOUR_API_KEY"
```

---

## 🔧 Technical Architecture

### Services Running

1. **Backend (FastAPI)** - Port 8001
   - User authentication
   - API key management
   - Message logging
   - WhatsApp service coordination

2. **WhatsApp Service (Node.js)** - Port 8002
   - WhatsApp Web integration
   - QR code generation
   - Message sending
   - Session management

3. **Frontend (React)** - Port 3000
   - User interface
   - Dashboard
   - Message management

4. **MongoDB** - Port 27017
   - User data
   - Message logs
   - Session data

---

## 📡 API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "...",
    "api_key": "..."
  }
}
```

### WhatsApp Management

#### Initialize Connection
```http
POST /api/whatsapp/initialize
Authorization: Bearer <token>
```

#### Get Status
```http
GET /api/whatsapp/status
Authorization: Bearer <token>

Response:
{
  "status": "connected",
  "connected": true,
  "qrAvailable": false
}
```

#### Get QR Code
```http
GET /api/whatsapp/qr
Authorization: Bearer <token>

Response:
{
  "qr": "2@...",
  "status": "qr_ready"
}
```

#### Disconnect
```http
POST /api/whatsapp/disconnect
Authorization: Bearer <token>
```

### Message Sending

#### Send via Web API (JWT Auth)
```http
POST /api/messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "number": "9876543210",
  "message": "Hello World"
}
```

#### Send via GET API (API Key Auth)
```http
GET /api/send?number=9876543210&msg=Hello+World
api_key: YOUR_API_KEY

Response:
{
  "status": "success",
  "to": "+919876543210",
  "message": "Message sent."
}
```

### Message Logs

#### Get Logs
```http
GET /api/messages/logs?status=sent&limit=50
Authorization: Bearer <token>

Response:
[
  {
    "id": "...",
    "user_id": "...",
    "receiver_number": "+919876543210",
    "message_body": "Hello",
    "status": "sent",
    "source": "web",
    "created_at": "2026-01-08T13:00:00Z"
  }
]
```

### API Key Management

#### Regenerate API Key
```http
POST /api/keys/regenerate
Authorization: Bearer <token>

Response:
{
  "api_key": "new-key-here",
  "message": "API key regenerated successfully"
}
```

---

## 🔐 Security Best Practices

### API Keys
- Never share your API key publicly
- Don't commit API keys to version control
- Regenerate keys if compromised
- Use environment variables in production

### Passwords
- Minimum 6 characters required
- Passwords are hashed with bcrypt
- JWT tokens expire after 7 days

### WhatsApp Session
- Session data stored locally on server
- Auto-reconnects on disconnection
- Can be disconnected anytime from dashboard

---

## 📊 Message Logging

All messages are automatically logged with:
- Receiver number
- Message content
- Timestamp
- Delivery status (sent/failed)
- Source (web/api)

View logs from the "Message Logs" page with filtering options.

---

## 🛠️ Troubleshooting

### QR Code Not Appearing
1. Check WhatsApp service status: `sudo supervisorctl status whatsapp-service`
2. View logs: `tail -f /var/log/supervisor/whatsapp-service.out.log`
3. Restart service: `sudo supervisorctl restart whatsapp-service`

### Message Sending Failed
1. Ensure WhatsApp is connected (green status)
2. Check number format (10 digits or +91XXXXXXXXXX)
3. Verify WhatsApp is active on the phone
4. Check message logs for error details

### Cannot Login
1. Verify email and password
2. Check backend service: `sudo supervisorctl status backend`
3. View backend logs: `tail -f /var/log/supervisor/backend.out.log`

### WhatsApp Disconnected
1. Reconnect by clicking "Initialize WhatsApp"
2. Scan QR code again
3. Previous session data will be restored

---

## 🔄 Rate Limiting

- **Default**: 30 messages per hour per user
- Prevents API abuse
- Can be configured in backend code

---

## 💾 Data Storage

### MongoDB Collections

1. **users**
   - User credentials
   - API keys
   - Created timestamps

2. **message_logs**
   - All sent messages
   - Status tracking
   - Source identification

3. **whatsapp_sessions**
   - Session authentication
   - Connection state

---

## 📱 WhatsApp Number Format

Supported formats:
- `9876543210` (default +91 added)
- `+919876543210`
- `919876543210`

The system automatically:
- Adds +91 if missing (India default)
- Removes special characters
- Formats for WhatsApp API

---

## 🚀 Production Deployment

### Environment Variables

**Backend (.env):**
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="whatsapp_automation"
JWT_SECRET="your-production-secret-key"
WHATSAPP_SERVICE_URL="http://localhost:8002"
CORS_ORIGINS="https://yourdomain.com"
```

**Frontend (.env):**
```env
REACT_APP_BACKEND_URL="https://api.yourdomain.com"
```

### Deployment Checklist

- [ ] Update JWT_SECRET to secure random string
- [ ] Configure production MongoDB URL
- [ ] Set CORS_ORIGINS to frontend domain
- [ ] Update REACT_APP_BACKEND_URL to backend domain
- [ ] Install Chromium on production server
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up process monitoring (PM2/Supervisor)
- [ ] Configure automated backups
- [ ] Set up logging and monitoring
- [ ] Test QR code scanning
- [ ] Test message sending
- [ ] Verify API endpoints

---

## 📖 Usage Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function sendMessage(number, message, apiKey) {
  try {
    const response = await axios.get(
      `https://msg-sender-5.preview.emergentagent.com/api/send`,
      {
        params: { number, msg: message },
        headers: { 'api_key': apiKey }
      }
    );
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
}

sendMessage('9876543210', 'Hello from Node.js!', 'YOUR_API_KEY');
```

### Python
```python
import requests

def send_message(number, message, api_key):
    url = 'https://msg-sender-5.preview.emergentagent.com/api/send'
    headers = {'api_key': api_key}
    params = {'number': number, 'msg': message}
    
    response = requests.get(url, headers=headers, params=params)
    return response.json()

result = send_message('9876543210', 'Hello from Python!', 'YOUR_API_KEY')
print(result)
```

### cURL
```bash
curl -X GET "https://msg-sender-5.preview.emergentagent.com/api/send?number=9876543210&msg=Hello+from+cURL" \
  -H "api_key: YOUR_API_KEY"
```

---

## 🎯 Features Summary

✅ **User Management**
- Registration and login
- JWT authentication
- Password encryption
- Profile management

✅ **WhatsApp Integration**
- Real WhatsApp Web connection
- QR code authentication
- Session persistence
- Auto-reconnection

✅ **Message Sending**
- Web dashboard interface
- REST API (GET endpoint)
- Number formatting
- Real-time status updates

✅ **API Access**
- Unique API keys per user
- Key regeneration
- API documentation
- Example code snippets

✅ **Message Logging**
- Complete history
- Status tracking
- Filter by status
- Source identification

✅ **Security**
- Password hashing (bcrypt)
- JWT tokens
- API key authentication
- CORS protection

✅ **UI/UX**
- Modern, clean design
- Responsive layout
- Real-time updates
- Easy navigation

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. View application logs
3. Test with provided examples
4. Verify all services are running

---

## 🔒 Privacy & Security

- Messages are not stored in plain text
- User passwords are hashed
- API keys are securely generated
- Session data is encrypted
- HTTPS recommended for production

---

**Built with FastAPI, React, WhatsApp Web JS, and MongoDB**

© 2026 WhatsApp Automation Platform
