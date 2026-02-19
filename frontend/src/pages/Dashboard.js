import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import Layout from '../components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user }) {
  const [status, setStatus] = useState('checking');
  const [qrCode, setQrCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const pollingInterval = useRef(null);

  // Initialize WebSocket connection
  const initSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || socketRef.current?.connected) return;

    console.log('[WebSocket] Connecting to:', BACKEND_URL);
    
    // Connect to backend WebSocket 
    // Use direct backend URL for socket connection
    const socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: false
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setSocketConnected(true);
      // Authenticate
      socket.emit('authenticate', { token });
    });

    socket.on('authenticated', (data) => {
      console.log('[WebSocket] Authenticated:', data);
      // Subscribe to WhatsApp events
      socket.emit('subscribe_whatsapp', {});
    });

    socket.on('subscribed', (data) => {
      console.log('[WebSocket] Subscribed to:', data.channel);
    });

    // QR Code received via WebSocket - instant update!
    socket.on('qr_code', (data) => {
      console.log('[WebSocket] QR Code received');
      setQrCode(data.qr);
      setStatus('qr_ready');
      setIsInitializing(false);
    });

    // WhatsApp connected
    socket.on('whatsapp_connected', (data) => {
      console.log('[WebSocket] WhatsApp connected:', data);
      setStatus('connected');
      setQrCode(null);
      setIsInitializing(false);
      if (data.phoneNumber) {
        setPhoneNumber(data.phoneNumber);
      }
    });

    // WhatsApp disconnected
    socket.on('whatsapp_disconnected', (data) => {
      console.log('[WebSocket] WhatsApp disconnected:', data);
      setStatus('disconnected');
      setQrCode(null);
      setPhoneNumber(null);
      setIsInitializing(false);
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setSocketConnected(false);
    });

    socket.on('auth_error', (data) => {
      console.error('[WebSocket] Auth error:', data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Initialize WebSocket
    initSocket();
    
    // Initial status check
    checkStatus().then(() => {
      setInitialCheckDone(true);
    });
    
    // Fallback polling (less frequent since we have WebSocket)
    pollingInterval.current = setInterval(() => {
      if (!socketConnected) {
        checkStatus();
      }
    }, 5000); // Reduced to 5 seconds as WebSocket handles real-time

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [initSocket, socketConnected]);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${API}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const currentStatus = response.data.status;
      setStatus(currentStatus);
      
      // Set phone number if available
      if (response.data.phoneNumber) {
        setPhoneNumber(response.data.phoneNumber);
      }
      
      if (currentStatus === 'qr_ready' && !qrCode) {
        try {
          const qrResponse = await axios.get(`${API}/whatsapp/qr`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (qrResponse.data.qr) {
            setQrCode(qrResponse.data.qr);
            setIsInitializing(false);
          }
        } catch (error) {
          if (error.response?.status === 401) {
            handleTokenExpiry();
          }
        }
      }
      
      if (currentStatus === 'connected' || currentStatus === 'authenticated') {
        setQrCode(null);
        setIsInitializing(false);
      }
      
      if (currentStatus === 'disconnected') {
        setQrCode(null);
        setIsInitializing(false);
        setPhoneNumber(null);
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        handleTokenExpiry();
      }
    }
  };

  const handleTokenExpiry = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleInitialize = async () => {
    setLoading(true);
    setIsInitializing(true);
    setStatus('initializing');
    setQrCode(null);
    setPhoneNumber(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/whatsapp/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.status === 'connected' || response.data.status === 'already_connected') {
        setStatus('connected');
        setIsInitializing(false);
        if (response.data.phoneNumber) {
          setPhoneNumber(response.data.phoneNumber);
        }
      }
    } catch (error) {
      if (error.response?.status === 503) {
        alert('WhatsApp service is temporarily unavailable. Please try again.');
      }
      setStatus('disconnected');
      setIsInitializing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm('Are you sure you want to disconnect WhatsApp? Session will be cleared and you can connect a different account.');
    if (!confirmed) return;
    
    setLoading(true);
    setStatus('disconnecting');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      
      await axios.post(`${API}/whatsapp/disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStatus('disconnected');
      setQrCode(null);
      setPhoneNumber(null);
      setIsInitializing(false);
      
      setTimeout(() => {
        checkStatus();
        setLoading(false);
      }, 2000);
      
    } catch (error) {
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

  const formatPhoneNumber = (num) => {
    if (!num) return '';
    // Format: +91 98765 43210
    if (num.startsWith('91') && num.length >= 12) {
      return `+${num.slice(0,2)} ${num.slice(2,7)} ${num.slice(7)}`;
    }
    return `+${num}`;
  };

  return (
    <Layout user={user}>
      <div className="page-header">
        <h1 data-testid="page-title">Dashboard</h1>
        <p>Manage your WhatsApp connection</p>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className={`status-badge ${status === 'connected' || status === 'authenticated' ? 'connected' : (status === 'qr_ready' || status === 'initializing') ? 'qr_ready' : 'disconnected'}`} data-testid="connection-status">
                  {(status === 'connected' || status === 'authenticated') && '🟢 Connected'}
                  {status === 'disconnected' && '🔴 Disconnected'}
                  {(status === 'qr_ready' || isInitializing) && '🟡 Waiting for QR Scan'}
                  {status === 'initializing' && !isInitializing && '🟡 Initializing...'}
                  {status === 'checking' && '🟡 Checking...'}
                  {status === 'disconnecting' && '🟡 Disconnecting...'}
                </span>
                
                {/* Show connected phone number */}
                {(status === 'connected' || status === 'authenticated') && phoneNumber && (
                  <span style={{ 
                    padding: '8px 16px', 
                    background: '#dcfce7', 
                    color: '#166534', 
                    borderRadius: '8px', 
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }} data-testid="connected-phone">
                    📱 {formatPhoneNumber(phoneNumber)}
                  </span>
                )}
              </div>
            </div>

        {status === 'disconnected' && !isInitializing && (
          <div>
            <p style={{ marginBottom: '16px', color: '#64748b' }}>
              Connect your WhatsApp account to start sending messages. Each user can connect their own WhatsApp.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleInitialize}
              disabled={loading}
              data-testid="initialize-button"
            >
              {loading ? 'Initializing...' : 'Connect WhatsApp'}
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
                onClick={handleDisconnect}
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
              {phoneNumber && (
                <div style={{ marginTop: '8px', fontWeight: '600' }}>
                  Connected Number: {formatPhoneNumber(phoneNumber)}
                </div>
              )}
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
