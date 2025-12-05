import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user }) {
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    const socket = io('http://localhost:8002');
    
    socket.on('qr', (data) => {
      setQrCode(data.qr);
      setStatus('qr_ready');
    });

    socket.on('ready', () => {
      setStatus('connected');
      setQrCode(null);
    });

    socket.on('status', (data) => {
      setStatus(data.status);
    });

    return () => socket.disconnect();
  }, []);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.status);
      
      if (response.data.status === 'qr_ready') {
        const qrResponse = await axios.get(`${API}/whatsapp/qr`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQrCode(qrResponse.data.qr);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/whatsapp/disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('disconnected');
      setQrCode(null);
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
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
          <span className={`status-badge ${status}`} data-testid="connection-status">
            {status === 'connected' && '🟢 Connected'}
            {status === 'disconnected' && '🔴 Disconnected'}
            {status === 'qr_ready' && '🟡 Waiting for QR Scan'}
          </span>
        </div>

        {status === 'disconnected' && (
          <div>
            <p style={{ marginBottom: '16px', color: '#64748b' }}>
              Initialize WhatsApp connection to start sending messages
            </p>
            <button
              className="btn btn-primary"
              onClick={handleInitialize}
              disabled={loading}
              data-testid="initialize-button"
            >
              {loading ? 'Initializing...' : 'Initialize WhatsApp'}
            </button>
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
          </div>
        )}

        {status === 'connected' && (
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
                Disconnect
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
