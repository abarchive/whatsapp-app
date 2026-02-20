import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Radio, Wifi, WifiOff, RefreshCw, Power, Users } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `/api`;

export default function AdminWhatsApp() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // Fetch from whatsapp service directly for admin
      const response = await axios.get(`${API}/admin/whatsapp/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (userId) => {
    const confirmed = window.confirm('Are you sure you want to disconnect this user\'s WhatsApp?');
    if (!confirmed) return;

    setDisconnecting(userId);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.post(`${API}/admin/whatsapp/disconnect/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTimeout(() => {
        fetchSessions();
        setDisconnecting(null);
      }, 2000);
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect');
      setDisconnecting(null);
    }
  };

  const formatPhoneNumber = (num) => {
    if (!num) return 'N/A';
    if (num.startsWith('91') && num.length >= 12) {
      return `+${num.slice(0,2)} ${num.slice(2,7)} ${num.slice(7)}`;
    }
    return `+${num}`;
  };

  const connectedSessions = sessions.filter(s => s.connected);

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#64748b' }}>
          <div>Loading WhatsApp sessions...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>WhatsApp Sessions</h1>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Monitor and manage user WhatsApp connections</p>
        </div>
        <button
          onClick={fetchSessions}
          style={{ padding: '10px 20px', background: '#667eea', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Summary Card */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981', maxWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '4px' }}>Active Connections</p>
              <h3 style={{ color: '#1e293b', fontSize: '32px', fontWeight: '700', margin: 0 }}>{connectedSessions.length}</h3>
            </div>
            <Wifi size={32} style={{ color: '#10b981' }} />
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0 }}>Connected Users</h3>
        </div>
        
        {connectedSessions.length > 0 ? (
          <div>
            {connectedSessions.map((session, index) => (
              <div
                key={session.userId || index}
                style={{
                  padding: '20px',
                  borderBottom: index < connectedSessions.length - 1 ? '1px solid #e2e8f0' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#dcfce7',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Wifi size={24} style={{ color: '#10b981' }} />
                  </div>
                  <div>
                    <p style={{ color: '#1e293b', fontWeight: '600', margin: '0 0 4px 0' }}>
                      {session.userEmail || 'Unknown User'}
                    </p>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      📱 {formatPhoneNumber(session.phoneNumber)}
                    </p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    padding: '4px 12px',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Connected
                  </span>
                  <button
                    onClick={() => handleDisconnect(session.userId || session.odlUserId)}
                    disabled={disconnecting === (session.userId || session.odlUserId)}
                    style={{
                      padding: '8px 16px',
                      background: '#fee2e2',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: disconnecting === (session.userId || session.odlUserId) ? 0.6 : 1
                    }}
                  >
                    <Power size={14} />
                    {disconnecting === (session.userId || session.odlUserId) ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <WifiOff size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No active WhatsApp connections</p>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>Users can connect their WhatsApp from their dashboard</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginTop: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={18} />
          Per-User WhatsApp Connections
        </h3>
        <ul style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
          <li>Each user can connect their own WhatsApp account</li>
          <li>Users connect by scanning QR code from their dashboard</li>
          <li>Messages are sent from the user's connected WhatsApp number</li>
          <li>Disconnecting a user will require them to scan QR again</li>
        </ul>
      </div>

      {/* Auto-refresh */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '13px' }}>
          <RefreshCw size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Auto-refreshing every 5 seconds
        </p>
      </div>
    </AdminLayout>
  );
}
