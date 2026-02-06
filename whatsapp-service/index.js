const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Store clients per user
const userClients = new Map(); // userId -> { client, status, qrCode, phoneNumber }

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
console.log('[WhatsApp Service] Server running on port 8002');
console.log('[WhatsApp Service] Per-user WhatsApp connections enabled');
if (chromiumPath) {
  console.log(`[WhatsApp Service] Found Chromium at: ${chromiumPath}`);
} else {
  console.error('[WhatsApp Service] Chromium not found!');
}

// Get or create user session
function getUserSession(userId) {
  if (!userClients.has(userId)) {
    userClients.set(userId, {
      client: null,
      status: 'disconnected',
      qrCode: null,
      phoneNumber: null,
      isConnected: false
    });
  }
  return userClients.get(userId);
}

// Initialize WhatsApp for a specific user
async function initializeUserWhatsApp(userId) {
  const session = getUserSession(userId);
  
  // If already connected, return
  if (session.isConnected && session.client) {
    return { success: true, status: 'already_connected', phoneNumber: session.phoneNumber };
  }
  
  // If already initializing, return
  if (session.status === 'initializing') {
    return { success: true, status: 'initializing' };
  }
  
  // Destroy old client if exists
  if (session.client) {
    try {
      await session.client.destroy();
    } catch (e) {
      console.log(`[User ${userId}] Error destroying old client:`, e.message);
    }
    session.client = null;
  }
  
  console.log(`[User ${userId}] Initializing WhatsApp client...`);
  session.status = 'initializing';
  session.qrCode = null;
  session.isConnected = false;
  session.phoneNumber = null;
  
  if (!chromiumPath) {
    session.status = 'error';
    throw new Error('Chromium browser not found');
  }
  
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: '/app/whatsapp-service/.wwebjs_auth'
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
        '--disable-gpu'
      ],
      headless: true,
      timeout: 60000
    }
  });
  
  session.client = client;
  
  // QR Code event
  client.on('qr', (qr) => {
    console.log(`[User ${userId}] QR Code received`);
    session.qrCode = qr;
    session.status = 'qr_ready';
    io.emit(`qr_${userId}`, { qr });
  });
  
  // Ready event
  client.on('ready', async () => {
    console.log(`[User ${userId}] WhatsApp client is ready!`);
    session.isConnected = true;
    session.status = 'connected';
    session.qrCode = null;
    
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
  });
  
  // Authenticated event
  client.on('authenticated', async () => {
    console.log(`[User ${userId}] WhatsApp authenticated`);
    session.status = 'authenticated';
  });
  
  // Auth failure event
  client.on('auth_failure', (msg) => {
    console.error(`[User ${userId}] Authentication failure:`, msg);
    session.status = 'auth_failure';
    session.qrCode = null;
    session.client = null;
    session.isConnected = false;
  });
  
  // Disconnected event
  client.on('disconnected', (reason) => {
    console.log(`[User ${userId}] WhatsApp disconnected:`, reason);
    session.isConnected = false;
    session.status = 'disconnected';
    session.qrCode = null;
    session.phoneNumber = null;
    session.client = null;
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
    throw error;
  }
}

// API Routes

// Get status for a user
app.get('/status', (req, res) => {
  const userId = req.query.userId;
  
  if (!userId) {
    // Return global status for backward compatibility
    return res.json({
      status: 'disconnected',
      connected: false,
      qrAvailable: false,
      message: 'Per-user connections enabled. Provide userId parameter.'
    });
  }
  
  const session = getUserSession(userId);
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
  
  const session = getUserSession(userId);
  if (session.qrCode) {
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
  
  const session = getUserSession(userId);
  
  if (!session.isConnected || !session.client) {
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
  
  const session = getUserSession(userId);
  
  try {
    if (session.client) {
      console.log(`[User ${userId}] Disconnecting WhatsApp...`);
      await session.client.destroy();
      session.client = null;
    }
    
    session.isConnected = false;
    session.status = 'disconnected';
    session.qrCode = null;
    session.phoneNumber = null;
    
    // Delete session data
    const sessionPath = path.join('/app/whatsapp-service/.wwebjs_auth', `session-${userId}`);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`[User ${userId}] Session data deleted`);
    }
    
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error(`[User ${userId}] Error disconnecting:`, error);
    res.status(500).json({ success: false, error: error.message });
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
