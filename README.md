# WhatsApp Automation Platform

A production-ready WhatsApp Web automation system that allows users to send WhatsApp messages through a web dashboard and REST API.

## Features

- **WhatsApp QR Login**: Connect WhatsApp using QR code scanning
- **Web Dashboard**: Modern interface for message management
- **REST API**: GET endpoint for programmatic message sending
- **Message Logging**: Complete history of all sent messages
- **API Key Authentication**: Secure API access
- **User Authentication**: JWT-based login system
- **Real-time Status**: Live WhatsApp connection monitoring

## Tech Stack

- **Backend**: FastAPI (Python) + Node.js Express
- **Frontend**: React 19 + React Router
- **Database**: MongoDB
- **WhatsApp**: Simulated (ARM64) / whatsapp-web.js (x86 production)

## Quick Start

### Access the Application
1. Register a new account at the login page
2. Login with your credentials
3. Initialize WhatsApp connection from dashboard
4. Scan QR code with WhatsApp mobile app
5. Start sending messages!

## API Usage

### Send Message via API
```bash
GET /api/send?number=9876543210&msg=Hello+World
Header: api_key: YOUR_API_KEY
```

Get your API key from the "API Keys" page in the dashboard.

## Important Notes

- **Current Mode**: Simulated WhatsApp (ARM64 compatibility)
- **Production**: Deploy on x86 architecture for real WhatsApp Web
- **Rate Limit**: 30 messages/hour per user

## Project Structure

```
/app/
├── backend/          # FastAPI backend
├── frontend/         # React frontend  
├── whatsapp-service/ # Node.js WhatsApp service
└── README.md
```

## Environment Variables

Backend (.env):
- MONGO_URL
- DB_NAME
- JWT_SECRET
- WHATSAPP_SERVICE_URL

Frontend (.env):
- REACT_APP_BACKEND_URL

---

Built with FastAPI, React, and WhatsApp Web
