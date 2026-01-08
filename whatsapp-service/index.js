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

  if (!isConnected) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }

  try {
    const result = await whatsappClient.sendMessage(number, message);
    res.json({
      success: true,
      to: number,
      message: 'Message sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    if (whatsappClient) {
      await whatsappClient.disconnect();
    }
    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
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
  console.log('[WhatsApp Service] Note: Using simulated WhatsApp for ARM64 compatibility');
  console.log('[WhatsApp Service] For production on x86, this will use real whatsapp-web.js');
});
