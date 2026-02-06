import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Radio, Wifi, WifiOff, RefreshCw, Power, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminWhatsApp() {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchSessionData();
    const interval = setInterval(fetchSessionData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessionData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/admin/whatsapp/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessionData(response.data);
    } catch (error) {
      console.error('Error fetching WhatsApp session:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm('Are you sure you want to disconnect WhatsApp? All users will lose access to message sending.');
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.post(`${API}/admin/whatsapp/disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTimeout(() => {
        fetchSessionData();
        setDisconnecting(false);
      }, 2000);
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      alert('Failed to disconnect WhatsApp');
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#64748b' }}>
          <div>Loading WhatsApp status...</div>
        </div>
      </AdminLayout>
    );
  }

  const session = sessionData?.global_session || {};
  const isConnected = session.connected || session.status === 'connected' || session.status === 'authenticated';

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>WhatsApp Session Management</h1>
        <p style={{ color: '#64748b', fontSize: '15px' }}>Monitor and manage the global WhatsApp connection</p>
      </div>

      {/* Connection Status Card */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '32px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isConnected ? (
                <Wifi size={32} style={{ color: '#10b981' }} />
              ) : (
                <WifiOff size={32} style={{ color: '#ef4444' }} />
              )}
            </div>
            <div>
              <h2 style={{ color: '#1e293b', fontSize: '22px', fontWeight: '700', margin: 0 }}>
                Global WhatsApp Session
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
                Single connection shared by all users
              </p>
            </div>
          </div>

          <div style={{
            padding: '8px 20px',
            background: isConnected ? '#10b981' : '#ef4444',
            borderRadius: '24px',
            color: 'white',
            fontWeight: '600',
            fontSize: '14px'
          }}
          data-testid="whatsapp-status"
          >
            {isConnected ? 'Connected' : session.status === 'qr_ready' ? 'Awaiting QR Scan' : 'Disconnected'}
          </div>
        </div>

        {/* Session Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Status</p>
            <p style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0, textTransform: 'capitalize' }}>
              {session.status || 'Unknown'}
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>QR Available</p>
            <p style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              {session.qrAvailable ? 'Yes' : 'No'}
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Mode</p>
            <p style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Single Session
            </p>
          </div>
        </div>

        {/* Actions */}
        {isConnected && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
              <span style={{ color: '#f59e0b', fontSize: '14px' }}>
                Disconnecting will affect all users' ability to send messages
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                padding: '12px 24px',
                background: '#ef4444',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: disconnecting ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: disconnecting ? 0.6 : 1
              }}
              data-testid="disconnect-btn"
            >
              <Power size={18} />
              {disconnecting ? 'Disconnecting...' : 'Disconnect WhatsApp'}
            </button>
          </div>
        )}

        {!isConnected && session.status !== 'qr_ready' && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '12px', borderLeft: '4px solid #f59e0b' }}>
              <p style={{ color: '#92400e', fontSize: '14px', margin: 0 }}>
                WhatsApp is not connected. Users need to initialize and scan the QR code from the main dashboard.
              </p>
            </div>
          </div>
        )}

        {session.status === 'qr_ready' && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <div style={{ padding: '16px', background: '#ede9fe', borderRadius: '12px', borderLeft: '4px solid #667eea' }}>
              <p style={{ color: '#5b21b6', fontSize: '14px', margin: 0 }}>
                QR code is ready. Waiting for user to scan and authenticate.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={18} />
          How it works
        </h3>
        <ul style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
          <li>This system uses a single WhatsApp Web connection for all users</li>
          <li>When connected, all registered users can send messages through the API</li>
          <li>QR code can be generated from the user dashboard</li>
          <li>Session persists across server restarts (stored in .wwebjs_auth folder)</li>
          <li>Disconnecting will require re-scanning the QR code to reconnect</li>
        </ul>
      </div>

      {/* Auto-refresh indicator */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '13px' }}>
          <RefreshCw size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Auto-refreshing every 5 seconds
        </p>
      </div>
    </AdminLayout>
  );
}
