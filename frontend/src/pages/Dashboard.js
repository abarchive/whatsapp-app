import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user }) {
  const [status, setStatus] = useState('checking');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const pollingInterval = useRef(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    // Initial check
    checkStatus().then(() => {
      setInitialCheckDone(true);
    });
    
    // Start polling for status updates every 2 seconds
    pollingInterval.current = setInterval(() => {
      checkStatus();
    }, 2000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, user needs to login');
        return;
      }
      
      const response = await axios.get(`${API}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const currentStatus = response.data.status;
      setStatus(currentStatus);
      
      console.log('Status check:', currentStatus, 'QR Available:', response.data.qrAvailable);
      
      // If status is qr_ready and we don't have QR code yet, fetch it
      if (currentStatus === 'qr_ready' && !qrCode) {
        try {
          const qrResponse = await axios.get(`${API}/whatsapp/qr`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (qrResponse.data.qr) {
            console.log('QR code fetched successfully');
            setQrCode(qrResponse.data.qr);
            setIsInitializing(false);
          }
        } catch (error) {
          if (error.response?.status === 401) {
            console.log('QR fetch: Token expired, redirecting to login');
            handleTokenExpiry();
          } else if (error.response?.status === 404) {
            console.log('QR code not available yet');
          } else {
            console.error('Error fetching QR code:', error);
          }
        }
      }
      
      // If connected, clear QR code and stop initializing state
      if (currentStatus === 'connected' || currentStatus === 'authenticated') {
        setQrCode(null);
        setIsInitializing(false);
      }
      
      // If disconnected, clear QR code
      if (currentStatus === 'disconnected') {
        setQrCode(null);
        setIsInitializing(false);
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('Status check: Token expired, redirecting to login');
        handleTokenExpiry();
      } else {
        console.error('Error checking status:', error);
      }
    }
  };

  const handleTokenExpiry = () => {
    // Clear polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = '/login';
  };

  const handleInitialize = async () => {
    setLoading(true);
    setIsInitializing(true);
    setStatus('initializing');
    setQrCode(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/whatsapp/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('WhatsApp initialization requested:', response.data);
      
      // If already connected or initializing, update status
      if (response.data.status === 'connected') {
        setStatus('connected');
        setIsInitializing(false);
      } else if (response.data.status === 'initializing') {
        // Let polling handle the rest
      }
      
      // Polling will automatically pick up the QR code when ready
    } catch (error) {
      console.error('Error initializing:', error);
      
      // Check if service is unavailable
      if (error.response?.status === 503) {
        alert('WhatsApp service is temporarily unavailable. Please try again in a few seconds.');
        setStatus('disconnected');
        setIsInitializing(false);
      } else {
        setStatus('disconnected');
        setIsInitializing(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm('Are you sure you want to disconnect WhatsApp? Session will be cleared and you can connect a different account.');
    if (!confirmed) {
      return;
    }
    
    setLoading(true);
    setStatus('disconnecting');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      
      const response = await axios.post(`${API}/whatsapp/disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Disconnect response:', response.data);
      
      // Clear state immediately
      setStatus('disconnected');
      setQrCode(null);
      setIsInitializing(false);
      
      // Give backend time to disconnect and check status
      setTimeout(() => {
        checkStatus();
        setLoading(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error disconnecting:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        alert('Failed to disconnect. Please try again.');
        setLoading(false);
      }
    }
  };

  const handleCancel = async () => {
    console.log('Cancel clicked - disconnecting...');
    await handleDisconnect();
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
        
        {!initialCheckDone ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <div style={{ display: 'inline-block' }}>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                border: '3px solid #f3f4f6',
                borderTop: '3px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '12px' }}>Checking connection status...</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '24px' }}>
              <span className={`status-badge ${status === 'connected' || status === 'authenticated' ? 'connected' : (status === 'qr_ready' || status === 'initializing') ? 'qr_ready' : 'disconnected'}`} data-testid="connection-status">
                {(status === 'connected' || status === 'authenticated') && '🟢 Connected'}
                {status === 'disconnected' && '🔴 Disconnected'}
                {(status === 'qr_ready' || isInitializing) && '🟡 Waiting for QR Scan'}
                {status === 'initializing' && !isInitializing && '🟡 Initializing...'}
                {status === 'checking' && '🟡 Checking...'}
                {status === 'disconnecting' && '🟡 Disconnecting...'}
              </span>
            </div>

        {status === 'disconnected' && !isInitializing && (
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

        {(status === 'initializing' || (isInitializing && !qrCode)) && (
          <div>
            <div className="alert alert-info">
              🔄 Initializing WhatsApp connection... QR code will appear in 5-10 seconds.
            </div>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ display: 'inline-block' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  border: '4px solid #f3f4f6',
                  borderTop: '4px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              </div>
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
                onClick={handleCancel}
                disabled={loading}
                style={{ fontSize: '14px' }}
                data-testid="cancel-button"
              >
                {loading ? 'Cancelling...' : 'Cancel'}
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
          </>
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
