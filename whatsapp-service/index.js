const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
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

let whatsappClient = null;
let qrCodeData = null;
let isConnected = false;
let connectionStatus = 'disconnected';

// Function to find Chromium executable
function findChromiumPath() {
  const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log(`[WhatsApp Service] Found Chromium at: ${path}`);
      return path;
    }
  }
  
  // Try to find using 'which' command
  try {
    const whichResult = execSync('which chromium || which chromium-browser || which google-chrome', { encoding: 'utf8' }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      console.log(`[WhatsApp Service] Found Chromium using which: ${whichResult}`);
      return whichResult;
    }
  } catch (e) {
    console.log('[WhatsApp Service] Could not find Chromium using which command');
  }
  
  console.error('[WhatsApp Service] ⚠️  Chromium not found in any standard location!');
  return null;
}

// Initialize WhatsApp client with real whatsapp-web.js
async function initializeWhatsApp() {
  try {
    // If client already exists and is initializing, don't create a new one
    if (whatsappClient) {
      console.log('[WhatsApp Service] Client already exists, destroying old instance...');
      try {
        await whatsappClient.destroy();
      } catch (e) {
        console.log('[WhatsApp Service] Error destroying old client:', e.message);
      }
      whatsappClient = null;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    console.log('[WhatsApp Service] Initializing WhatsApp Web client...');
    connectionStatus = 'initializing';
    qrCodeData = null;
    isConnected = false;
    
    // Find Chromium executable
    const chromiumPath = findChromiumPath();
    if (!chromiumPath) {
      throw new Error('Chromium browser not found! Please install: sudo apt-get install chromium');
    }
    
    // Notify all sockets about initialization
    io.emit('status', {
      status: 'initializing',
      connected: false,
      qrAvailable: false
    });
    
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
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
          '--disable-gpu',
          '--disable-features=VizDisplayCompositor'
        ],
        headless: true,
        timeout: 60000 // 60 second timeout for browser launch
      }
    });

    // Set timeout for initialization
    const initTimeout = setTimeout(() => {
      console.error('[WhatsApp Service] Initialization timeout after 90 seconds');
      if (whatsappClient) {
        whatsappClient.destroy().catch(err => console.error('Error destroying on timeout:', err));
        whatsappClient = null;
      }
      connectionStatus = 'error';
      qrCodeData = null;
      io.emit('error', { message: 'Initialization timeout' });
      io.emit('status', {
        status: 'disconnected',
        connected: false,
        qrAvailable: false
      });
    }, 90000);

    // QR Code event
    whatsappClient.on('qr', (qr) => {
      clearTimeout(initTimeout);
      console.log('[WhatsApp Service] QR Code received');
      qrCodeData = qr;
      connectionStatus = 'qr_ready';
      io.emit('qr', { qr });
      io.emit('status', {
        status: 'qr_ready',
        connected: false,
        qrAvailable: true
      });
    });

    // Ready event
    whatsappClient.on('ready', () => {
      clearTimeout(initTimeout);
      console.log('[WhatsApp Service] WhatsApp client is ready!');
      isConnected = true;
      connectionStatus = 'connected';
      qrCodeData = null;
      io.emit('ready', { message: 'WhatsApp connected successfully!' });
      io.emit('status', {
        status: 'connected',
        connected: true,
        qrAvailable: false
      });
    });

    // Authenticated event
    whatsappClient.on('authenticated', () => {
      clearTimeout(initTimeout);
      console.log('[WhatsApp Service] WhatsApp authenticated');
      connectionStatus = 'authenticated';
      io.emit('status', {
        status: 'authenticated',
        connected: false,
        qrAvailable: false
      });
    });

    // Authentication failure event
    whatsappClient.on('auth_failure', (msg) => {
      clearTimeout(initTimeout);
      console.error('[WhatsApp Service] Authentication failure:', msg);
      connectionStatus = 'auth_failure';
      qrCodeData = null;
      whatsappClient = null;
      io.emit('error', { message: 'Authentication failed' });
      io.emit('status', {
        status: 'disconnected',
        connected: false,
        qrAvailable: false
      });
    });

    // Disconnected event
    whatsappClient.on('disconnected', (reason) => {
      clearTimeout(initTimeout);
      console.log('[WhatsApp Service] WhatsApp disconnected:', reason);
      isConnected = false;
      connectionStatus = 'disconnected';
      qrCodeData = null;
      whatsappClient = null;
      io.emit('disconnected', { reason });
      io.emit('status', {
        status: 'disconnected',
        connected: false,
        qrAvailable: false
      });
    });

    // Initialize the client
    await whatsappClient.initialize();
    
  } catch (error) {
    console.error('[WhatsApp Service] Error initializing WhatsApp:', error);
    connectionStatus = 'error';
    qrCodeData = null;
    isConnected = false;
    whatsappClient = null;
    io.emit('error', { message: error.message });
    io.emit('status', {
      status: 'disconnected',
      connected: false,
      qrAvailable: false
    });
  }
}

// API Routes
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    connected: isConnected,
    qrAvailable: qrCodeData !== null
  });
});

app.get('/qr', (req, res) => {
  if (qrCodeData) {
    res.json({ qr: qrCodeData, status: connectionStatus });
  } else {
    res.status(404).json({ error: 'QR code not available' });
  }
});

app.post('/initialize', async (req, res) => {
  try {
    // Check if already initializing
    if (connectionStatus === 'initializing') {
      return res.json({ 
        success: true, 
        message: 'WhatsApp initialization already in progress',
        status: 'initializing'
      });
    }
    
    // If client exists and is connected, inform user
    if (isConnected && whatsappClient) {
      return res.json({ 
        success: true, 
        message: 'WhatsApp already connected',
        status: 'connected'
      });
    }
    
    await initializeWhatsApp();
    res.json({ success: true, message: 'WhatsApp initialization started' });
  } catch (error) {
    console.error('[WhatsApp Service] Error in initialize endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: {
      connectionStatus,
      isConnected,
      qrAvailable: qrCodeData !== null,
      clientExists: whatsappClient !== null
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  
  if (!number || !message) {
    return res.status(400).json({ error: 'Number and message are required' });
  }

  if (!isConnected || !whatsappClient) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }

  try {
    // Format number to WhatsApp format (remove + and @ if present)
    let formattedNumber = number.replace(/[^\d]/g, '');
    
    // Add country code if not present (default to India +91)
    if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
      formattedNumber = '91' + formattedNumber;
    }
    
    // WhatsApp ID format: number@c.us
    const chatId = formattedNumber + '@c.us';
    
    console.log(`[WhatsApp Service] Sending message to ${chatId}: ${message}`);
    
    // Send message using whatsapp-web.js
    const result = await whatsappClient.sendMessage(chatId, message);
    
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
    console.error('[WhatsApp Service] Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    if (whatsappClient) {
      console.log('[WhatsApp Service] Disconnecting and clearing session...');
      await whatsappClient.destroy();
      whatsappClient = null;
      isConnected = false;
      connectionStatus = 'disconnected';
      qrCodeData = null;
      
      // Delete saved session data to allow new account connection
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join(__dirname, '.wwebjs_auth');
      
      try {
        if (fs.existsSync(sessionPath)) {
          console.log('[WhatsApp Service] Deleting saved session data...');
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('[WhatsApp Service] Session data deleted successfully');
        }
      } catch (err) {
        console.error('[WhatsApp Service] Error deleting session:', err);
      }
      
      // Notify all connected sockets about disconnection
      io.emit('disconnected', { message: 'WhatsApp disconnected' });
      io.emit('status', {
        status: 'disconnected',
        connected: false,
        qrAvailable: false
      });
    }
    res.json({ success: true, message: 'Disconnected and session cleared successfully' });
  } catch (error) {
    console.error('[WhatsApp Service] Error disconnecting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('[WhatsApp Service] Client connected to socket:', socket.id);
  
  // Send current status
  socket.emit('status', {
    status: connectionStatus,
    connected: isConnected,
    qrAvailable: qrCodeData !== null
  });

  if (qrCodeData) {
    socket.emit('qr', { qr: qrCodeData });
  }

  socket.on('disconnect', () => {
    console.log('[WhatsApp Service] Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8002;
server.listen(PORT, () => {
  console.log(`[WhatsApp Service] Server running on port ${PORT}`);
  console.log('[WhatsApp Service] Using real WhatsApp Web integration');
  console.log('[WhatsApp Service] Ready to connect via QR code');
});
