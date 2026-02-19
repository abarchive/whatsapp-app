const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Backend URL for WebSocket events
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';

// Helper to send events to backend for WebSocket broadcast
async function emitToBackend(userId, event, data) {
  try {
    await axios.post(`${BACKEND_URL}/api/internal/whatsapp-event`, {
      event,
      userId,
      data
    });
    console.log(`[User ${userId}] Event ${event} sent to backend`);
  } catch (e) {
    console.log(`[User ${userId}] Failed to send ${event} to backend:`, e.message);
  }
}

// Store clients per user
const userClients = new Map(); // userId -> { client, status, qrCode, phoneNumber, browserPid }
const initializingUsers = new Set(); // Track users currently initializing

// Auth path
const AUTH_PATH = '/app/whatsapp-service/.wwebjs_auth';

// Ensure auth directory exists
if (!fs.existsSync(AUTH_PATH)) {
  fs.mkdirSync(AUTH_PATH, { recursive: true });
}

// Function to find Chromium executable
function findChromiumPath() {
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  try {
    const whichResult = execSync('which chromium || which chromium-browser || which google-chrome', { encoding: 'utf8' }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      return whichResult;
    }
  } catch (e) {}
  
  return null;
}

const chromiumPath = findChromiumPath();
console.log('[WhatsApp Service] Server starting on port 8002');
console.log('[WhatsApp Service] Per-user WhatsApp connections enabled');
if (chromiumPath) {
  console.log(`[WhatsApp Service] Found Chromium at: ${chromiumPath}`);
} else {
  console.error('[WhatsApp Service] Chromium not found!');
}

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Kill user's chromium processes
function killUserChromium(userId) {
  try {
    execSync(`pkill -f "session-${userId}" 2>/dev/null || true`, { encoding: 'utf8' });
  } catch (e) {}
}

// Delete user session folder
function deleteUserSession(userId) {
  const sessionPath = path.join(AUTH_PATH, `session-${userId}`);
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`[User ${userId}] Session folder deleted`);
    }
  } catch (e) {
    console.log(`[User ${userId}] Error deleting session:`, e.message);
  }
}

// Full cleanup for a user
async function cleanupUser(userId) {
  console.log(`[User ${userId}] Running full cleanup...`);
  
  const session = userClients.get(userId);
  
  if (session) {
    if (session.client) {
      try {
        await session.client.destroy();
      } catch (e) {
        console.log(`[User ${userId}] Destroy error (ignoring):`, e.message);
      }
    }
    userClients.delete(userId);
  }
  
  initializingUsers.delete(userId);
  killUserChromium(userId);
  deleteUserSession(userId);
  
  console.log(`[User ${userId}] Cleanup complete`);
}

// Initialize WhatsApp for a specific user
async function initializeUserWhatsApp(userId) {
  // Check if already initializing
  if (initializingUsers.has(userId)) {
    console.log(`[User ${userId}] Already initializing, please wait...`);
    const session = userClients.get(userId);
    return { success: true, status: session?.status || 'initializing' };
  }
  
  const existingSession = userClients.get(userId);
  
  // If already connected, return
  if (existingSession?.isConnected && existingSession?.client) {
    return { success: true, status: 'already_connected', phoneNumber: existingSession.phoneNumber };
  }
  
  // If has QR ready, return it
  if (existingSession?.status === 'qr_ready' && existingSession?.qrCode) {
    return { success: true, status: 'qr_ready' };
  }
  
  // Mark as initializing
  initializingUsers.add(userId);
  
  // Full cleanup first
  await cleanupUser(userId);
  
  // Wait for cleanup
  await delay(2000);
  
  console.log(`[User ${userId}] Initializing WhatsApp client...`);
  
  // Create new session
  const session = {
    client: null,
    status: 'initializing',
    qrCode: null,
    phoneNumber: null,
    isConnected: false
  };
  userClients.set(userId, session);
  
  if (!chromiumPath) {
    session.status = 'error';
    initializingUsers.delete(userId);
    throw new Error('Chromium browser not found');
  }
  
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: AUTH_PATH
    }),
    puppeteer: {
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-default-apps',
        '--mute-audio',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--single-process'
      ],
      headless: true,
      timeout: 60000,
      protocolTimeout: 60000
    },
    qrMaxRetries: 5,
    authTimeoutMs: 60000,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 30000
  });
  
  session.client = client;
  
  // QR Code event
  client.on('qr', (qr) => {
    console.log(`[User ${userId}] QR Code received`);
    session.qrCode = qr;
    session.status = 'qr_ready';
    initializingUsers.delete(userId);
    io.emit(`qr_${userId}`, { qr });
    // Send to backend for WebSocket broadcast
    emitToBackend(userId, 'qr_code', { qr, status: 'qr_ready' });
  });
  
  // Ready event
  client.on('ready', async () => {
    console.log(`[User ${userId}] WhatsApp client is ready!`);
    session.isConnected = true;
    session.status = 'connected';
    session.qrCode = null;
    initializingUsers.delete(userId);
    
    // Get connected phone number
    try {
      const info = client.info;
      if (info && info.wid) {
        session.phoneNumber = info.wid.user;
        console.log(`[User ${userId}] Connected phone: ${session.phoneNumber}`);
      }
    } catch (e) {
      console.log(`[User ${userId}] Could not get phone number:`, e.message);
    }
    
    io.emit(`ready_${userId}`, { phoneNumber: session.phoneNumber });
    // Send to backend for WebSocket broadcast
    emitToBackend(userId, 'whatsapp_connected', { 
      status: 'connected', 
      phoneNumber: session.phoneNumber 
    });
  });
  
  // Authenticated event
  client.on('authenticated', () => {
    console.log(`[User ${userId}] WhatsApp authenticated`);
  });
  
  // Auth failure event
  client.on('auth_failure', (msg) => {
    console.error(`[User ${userId}] Authentication failure:`, msg);
    session.status = 'auth_failure';
    session.qrCode = null;
    session.client = null;
    session.isConnected = false;
    initializingUsers.delete(userId);
    
    // Cleanup on auth failure
    cleanupUser(userId);
  });
  
  // Disconnected event
  client.on('disconnected', (reason) => {
    console.log(`[User ${userId}] WhatsApp disconnected:`, reason);
    session.isConnected = false;
    session.status = 'disconnected';
    session.qrCode = null;
    session.phoneNumber = null;
    session.client = null;
    initializingUsers.delete(userId);
    io.emit(`disconnected_${userId}`, { reason });
  });
  
  // Initialize
  try {
    await client.initialize();
    return { success: true, status: session.status };
  } catch (error) {
    console.error(`[User ${userId}] Initialization error:`, error.message);
    session.status = 'error';
    session.client = null;
    initializingUsers.delete(userId);
    
    // Cleanup on error
    await cleanupUser(userId);
    
    throw error;
  }
}

// API Routes

// Get status for a user
app.get('/status', (req, res) => {
  const userId = req.query.userId;
  
  if (!userId) {
    return res.json({
      status: 'disconnected',
      connected: false,
      qrAvailable: false,
      message: 'Per-user connections enabled. Provide userId parameter.'
    });
  }
  
  const session = userClients.get(userId);
  if (!session) {
    return res.json({
      status: 'disconnected',
      connected: false,
      qrAvailable: false,
      phoneNumber: null
    });
  }
  
  res.json({
    status: session.status,
    connected: session.isConnected,
    qrAvailable: session.qrCode !== null,
    phoneNumber: session.phoneNumber
  });
});

// Get QR code for a user
app.get('/qr', (req, res) => {
  const userId = req.query.userId;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const session = userClients.get(userId);
  if (session && session.qrCode) {
    res.json({ qr: session.qrCode, status: session.status });
  } else {
    res.status(404).json({ error: 'QR code not available' });
  }
});

// Initialize WhatsApp for a user
app.post('/initialize', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  try {
    const result = await initializeUserWhatsApp(userId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`[User ${userId}] Initialize error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send message for a user
app.post('/send', async (req, res) => {
  const { userId, number, message } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  if (!number || !message) {
    return res.status(400).json({ error: 'number and message are required' });
  }
  
  const session = userClients.get(userId);
  
  if (!session || !session.isConnected || !session.client) {
    return res.status(400).json({ error: 'WhatsApp not connected. Please scan QR code first.' });
  }
  
  try {
    let formattedNumber = number.replace(/[^\d]/g, '');
    
    if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
      formattedNumber = '91' + formattedNumber;
    }
    
    const chatId = formattedNumber + '@c.us';
    
    console.log(`[User ${userId}] Sending message to ${chatId}`);
    
    // Check if number is registered
    try {
      const isRegistered = await session.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        return res.status(400).json({
          success: false,
          error: `Number ${number} is not registered on WhatsApp`
        });
      }
    } catch (checkError) {
      console.log(`[User ${userId}] Could not verify number, attempting send anyway`);
    }
    
    const result = await session.client.sendMessage(chatId, message);
    
    console.log(`[User ${userId}] Message sent successfully`);
    
    res.json({
      success: true,
      to: number,
      message: 'Message sent successfully',
      data: {
        id: result.id.id,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    console.error(`[User ${userId}] Error sending message:`, error.message);
    
    if (error.message && error.message.includes('No LID for user')) {
      return res.status(400).json({
        success: false,
        error: 'This number is not registered on WhatsApp'
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect WhatsApp for a user
app.post('/disconnect', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  console.log(`[User ${userId}] Disconnect request received`);
  
  const session = userClients.get(userId);
  
  if (!session) {
    console.log(`[User ${userId}] No session found`);
    return res.json({ success: true, message: 'No session to disconnect' });
  }
  
  try {
    // Try to logout first (this invalidates the session on WhatsApp servers)
    if (session.client) {
      console.log(`[User ${userId}] Logging out from WhatsApp...`);
      try {
        await session.client.logout();
        console.log(`[User ${userId}] Logged out successfully`);
      } catch (e) {
        console.log(`[User ${userId}] Logout error (ignoring):`, e.message);
      }
    }
    
    // Full cleanup
    await cleanupUser(userId);
    
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error(`[User ${userId}] Error disconnecting:`, error);
    
    // Force cleanup even on error
    await cleanupUser(userId);
    
    res.json({ success: true, message: 'Disconnected with errors' });
  }
});

// Health check
app.get('/health', (req, res) => {
  const activeUsers = [];
  userClients.forEach((session, odlUserId) => {
    if (session.isConnected) {
      activeUsers.push({ odlUserId, phoneNumber: session.phoneNumber });
    }
  });
  
  res.json({
    status: 'ok',
    activeConnections: activeUsers.length,
    users: activeUsers,
    uptime: process.uptime()
  });
});

// Admin: Get all sessions
app.get('/admin/sessions', (req, res) => {
  const sessions = [];
  userClients.forEach((session, odlUserId) => {
    sessions.push({
      odlUserId,
      userId: odlUserId,
      status: session.status,
      connected: session.isConnected,
      phoneNumber: session.phoneNumber
    });
  });
  
  res.json({ sessions, total: sessions.length });
});

// Start server
const PORT = process.env.PORT || 8002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[WhatsApp Service] Ready to accept per-user connections`);
});
