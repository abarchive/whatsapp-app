const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode-terminal');

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

// Simulated WhatsApp client for development (replace with real whatsapp-web.js in production on x86)
class SimulatedWhatsAppClient {
  constructor() {
    this.ready = false;
    this.qr = null;
  }

  async initialize() {
    console.log('[WhatsApp Service] Initializing simulated WhatsApp client...');
    connectionStatus = 'qr_ready';
    
    // Generate a demo QR code
    this.qr = 'https://wa.me/qr/DEMO' + Math.random().toString(36).substring(7);
    qrCodeData = this.qr;
    
    io.emit('qr', { qr: this.qr });
    console.log('[WhatsApp Service] QR Code generated (simulated)');
    
    // Auto-connect after 5 seconds (simulating user scanning QR)
    setTimeout(() => {
      this.ready = true;
      isConnected = true;
      connectionStatus = 'connected';
      io.emit('ready', { message: 'WhatsApp connected successfully!' });
      console.log('[WhatsApp Service] Client connected (simulated)');
    }, 5000);
  }

  async sendMessage(number, message) {
    if (!this.ready) {
      throw new Error('WhatsApp client not ready');
    }
    
    // Simulate sending message
    console.log(`[WhatsApp Service] Sending message to ${number}: ${message}`);
    return {
      success: true,
      id: 'msg_' + Date.now(),
      timestamp: new Date().toISOString()
    };
  }

  async disconnect() {
    this.ready = false;
    isConnected = false;
    connectionStatus = 'disconnected';
    qrCodeData = null;
    console.log('[WhatsApp Service] Client disconnected');
  }
}

// Initialize WhatsApp client
async function initializeWhatsApp() {
  try {
    whatsappClient = new SimulatedWhatsAppClient();
    await whatsappClient.initialize();
  } catch (error) {
    console.error('[WhatsApp Service] Error initializing WhatsApp:', error);
    connectionStatus = 'error';
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
