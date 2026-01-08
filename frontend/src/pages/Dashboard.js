import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WHATSAPP_SERVICE_URL = 'http://localhost:8002';

export default function Dashboard({ user }) {
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    checkStatus();
    
    // Connect to WhatsApp service socket
    const newSocket = io(WHATSAPP_SERVICE_URL);
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('Connected to WhatsApp service');
    });

    newSocket.on('qr', (data) => {
      console.log('QR code received');
      setQrCode(data.qr);
      setStatus('qr_ready');
    });

    newSocket.on('ready', () => {
      console.log('WhatsApp connected!');
      setStatus('connected');
      setQrCode(null);
    });

    newSocket.on('authenticated', () => {
      console.log('WhatsApp authenticated');
      setStatus('authenticated');
    });

    newSocket.on('disconnected', () => {
      console.log('WhatsApp disconnected');
      setStatus('disconnected');
      setQrCode(null);
    });

    newSocket.on('status', (data) => {
      console.log('Status update:', data);
      setStatus(data.status);
      if (data.qrAvailable && data.qr) {
        setQrCode(data.qr);
      }
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.status);
      
      if (response.data.status === 'qr_ready') {
        try {
          const qrResponse = await axios.get(`${API}/whatsapp/qr`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setQrCode(qrResponse.data.qr);
        } catch (error) {
          console.error('Error fetching QR code:', error);
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    setStatus('initializing');
    setQrCode(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error initializing:', error);
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp? Session will be cleared and you can connect a different account.')) {
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('disconnected');
      setQrCode(null);
      
      // Wait a moment then show initialize button
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error disconnecting:', error);
      setLoading(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="page-header">
        <h1 data-testid="page-title">Dashboard</h1>
        <p>Manage your WhatsApp connection and automation</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>WhatsApp Connection Status</h3>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <span className={`status-badge ${status === 'connected' || status === 'authenticated' ? 'connected' : status === 'qr_ready' ? 'qr_ready' : 'disconnected'}`} data-testid="connection-status">
            {(status === 'connected' || status === 'authenticated') && '🟢 Connected'}
            {status === 'disconnected' && '🔴 Disconnected'}
            {status === 'qr_ready' && '🟡 Waiting for QR Scan'}
            {status === 'initializing' && '🟡 Initializing...'}
          </span>
        </div>

        {status === 'disconnected' && (
          <div>
            <p style={{ marginBottom: '16px', color: '#64748b' }}>
              Initialize WhatsApp connection to start sending messages. You can connect any WhatsApp account.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleInitialize}
              disabled={loading}
              data-testid="initialize-button"
            >
              {loading ? 'Initializing...' : 'Initialize WhatsApp & Generate QR Code'}
            </button>
          </div>
        )}

        {status === 'initializing' && (
          <div>
            <div className="alert alert-info">
              🔄 Initializing WhatsApp connection... Please wait for QR code.
            </div>
          </div>
        )}

        {status === 'qr_ready' && qrCode && (
          <div>
            <div className="alert alert-info">
              Scan this QR code with your WhatsApp mobile app to connect
            </div>
            <div className="qr-container" data-testid="qr-code-container">
              <QRCodeSVG value={qrCode} size={256} />
            </div>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={handleDisconnect}
                disabled={loading}
                style={{ fontSize: '14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {(status === 'connected' || status === 'authenticated') && (
          <div>
            <div className="alert alert-success" data-testid="connected-message">
              ✓ WhatsApp is connected and ready to send messages!
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <Link to="/send-message">
                <button className="btn btn-primary" data-testid="send-message-button">
                  Send Message
                </button>
              </Link>
              <button
                className="btn btn-danger"
                onClick={handleDisconnect}
                disabled={loading}
                data-testid="disconnect-button"
              >
                {loading ? 'Disconnecting...' : 'Disconnect & Clear Session'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <Link to="/send-message" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
              <h4 style={{ marginBottom: '8px', color: '#1e293b' }}>📤 Send Message</h4>
              <p style={{ color: '#64748b', fontSize: '14px' }}>Send WhatsApp messages</p>
            </div>
          </Link>
          <Link to="/message-logs" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
              <h4 style={{ marginBottom: '8px', color: '#1e293b' }}>📊 Message Logs</h4>
              <p style={{ color: '#64748b', fontSize: '14px' }}>View message history</p>
            </div>
          </Link>
          <Link to="/api-keys" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
              <h4 style={{ marginBottom: '8px', color: '#1e293b' }}>🔑 API Keys</h4>
              <p style={{ color: '#64748b', fontSize: '14px' }}>Manage API access</p>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
