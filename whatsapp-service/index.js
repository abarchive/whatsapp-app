const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');

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

// Initialize WhatsApp client with real whatsapp-web.js
async function initializeWhatsApp() {
  try {
    console.log('[WhatsApp Service] Initializing WhatsApp Web client...');
    connectionStatus = 'initializing';
    
    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: '/app/whatsapp-service/.wwebjs_auth'
      }),
      puppeteer: {
        executablePath: '/usr/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // QR Code event
    whatsappClient.on('qr', (qr) => {
      console.log('[WhatsApp Service] QR Code received');
      qrCodeData = qr;
      connectionStatus = 'qr_ready';
      io.emit('qr', { qr });
    });

    // Ready event
    whatsappClient.on('ready', () => {
      console.log('[WhatsApp Service] WhatsApp client is ready!');
      isConnected = true;
      connectionStatus = 'connected';
      qrCodeData = null;
      io.emit('ready', { message: 'WhatsApp connected successfully!' });
    });

    // Authenticated event
    whatsappClient.on('authenticated', () => {
      console.log('[WhatsApp Service] WhatsApp authenticated');
      connectionStatus = 'authenticated';
    });

    // Authentication failure event
    whatsappClient.on('auth_failure', (msg) => {
      console.error('[WhatsApp Service] Authentication failure:', msg);
      connectionStatus = 'auth_failure';
      io.emit('error', { message: 'Authentication failed' });
    });

    // Disconnected event
    whatsappClient.on('disconnected', (reason) => {
      console.log('[WhatsApp Service] WhatsApp disconnected:', reason);
      isConnected = false;
      connectionStatus = 'disconnected';
      qrCodeData = null;
      io.emit('disconnected', { reason });
    });

    // Initialize the client
    await whatsappClient.initialize();
    
  } catch (error) {
    console.error('[WhatsApp Service] Error initializing WhatsApp:', error);
    connectionStatus = 'error';
    io.emit('error', { message: error.message });
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
    await initializeWhatsApp();
    res.json({ success: true, message: 'WhatsApp initialization started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
      console.log('[WhatsApp Service] Disconnecting WhatsApp client...');
      await whatsappClient.destroy();
      whatsappClient = null;
      isConnected = false;
      connectionStatus = 'disconnected';
      qrCodeData = null;
      
      // Notify all connected sockets about disconnection
      io.emit('disconnected', { message: 'WhatsApp disconnected' });
      io.emit('status', {
        status: 'disconnected',
        connected: false,
        qrAvailable: false
      });
    }
    res.json({ success: true, message: 'Disconnected successfully' });
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
