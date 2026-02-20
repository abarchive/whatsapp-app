import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Settings, Save, RefreshCw, Shield, Users, MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `/api`;

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    default_rate_limit: 30,
    max_rate_limit: 100,
    enable_registration: true,
    maintenance_mode: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('admin_token');
      await axios.put(`${API}/admin/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaved(true);
      setMessage('Settings saved successfully!');
      setTimeout(() => {
        setSaved(false);
        setMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#64748b' }}>
          <div>Loading settings...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Global Settings</h1>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Configure system-wide preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            background: saved ? '#10b981' : '#667eea',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: saving ? 0.6 : 1,
            transition: 'background 0.3s'
          }}
          data-testid="save-settings-btn"
        >
          {saving ? (
            <>
              <RefreshCw size={18} />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle size={18} />
              Saved!
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
      </div>

      {message && (
        <div style={{ 
          padding: '12px 16px', 
          background: saved ? '#dcfce7' : '#fee2e2', 
          color: saved ? '#166534' : '#991b1b', 
          borderRadius: '8px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {saved ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message}
        </div>
      )}

      {/* Rate Limits Section */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={20} style={{ color: '#667eea' }} />
          </div>
          <div>
            <h3 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0 }}>Rate Limiting</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Control message sending limits per user</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#64748b', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
              Default Rate Limit (messages/hour)
            </label>
            <input
              type="number"
              value={settings.default_rate_limit}
              onChange={(e) => handleChange('default_rate_limit', parseInt(e.target.value))}
              min="1"
              max="1000"
              style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '16px', boxSizing: 'border-box' }}
              data-testid="default-rate-limit"
            />
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Applied to new user registrations</p>
          </div>

          <div>
            <label style={{ display: 'block', color: '#64748b', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
              Maximum Rate Limit (messages/hour)
            </label>
            <input
              type="number"
              value={settings.max_rate_limit}
              onChange={(e) => handleChange('max_rate_limit', parseInt(e.target.value))}
              min="1"
              max="10000"
              style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', fontSize: '16px', boxSizing: 'border-box' }}
              data-testid="max-rate-limit"
            />
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>Maximum allowed for any user</p>
          </div>
        </div>
      </div>

      {/* Registration Section */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h3 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0 }}>User Registration</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Control new user signups</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
          <div>
            <p style={{ color: '#1e293b', fontWeight: '600', margin: '0 0 4px 0' }}>Enable Registration</p>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              {settings.enable_registration ? 'New users can create accounts' : 'Registration is disabled'}
            </p>
          </div>
          <button
            onClick={() => handleChange('enable_registration', !settings.enable_registration)}
            style={{
              width: '56px',
              height: '28px',
              borderRadius: '28px',
              border: 'none',
              cursor: 'pointer',
              background: settings.enable_registration ? '#10b981' : '#cbd5e1',
              position: 'relative',
              transition: 'background 0.3s'
            }}
            data-testid="enable-registration-toggle"
          >
            <span style={{
              position: 'absolute',
              width: '22px',
              height: '22px',
              background: 'white',
              borderRadius: '50%',
              top: '3px',
              left: settings.enable_registration ? '31px' : '3px',
              transition: 'left 0.3s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}></span>
          </button>
        </div>
        
        {!settings.enable_registration && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#92400e' }} />
            <span style={{ color: '#92400e', fontSize: '13px' }}>New users will not be able to register</span>
          </div>
        )}
      </div>

      {/* Maintenance Mode Section */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h3 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '600', margin: 0 }}>Maintenance Mode</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Temporarily disable user access</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: settings.maintenance_mode ? '#fee2e2' : '#f8fafc', borderRadius: '12px', border: settings.maintenance_mode ? '1px solid #fecaca' : '1px solid transparent' }}>
          <div>
            <p style={{ color: '#1e293b', fontWeight: '600', margin: '0 0 4px 0' }}>Maintenance Mode</p>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              {settings.maintenance_mode ? 'System is in maintenance mode' : 'System is running normally'}
            </p>
          </div>
          <button
            onClick={() => handleChange('maintenance_mode', !settings.maintenance_mode)}
            style={{
              width: '56px',
              height: '28px',
              borderRadius: '28px',
              border: 'none',
              cursor: 'pointer',
              background: settings.maintenance_mode ? '#ef4444' : '#cbd5e1',
              position: 'relative',
              transition: 'background 0.3s'
            }}
            data-testid="maintenance-mode-toggle"
          >
            <span style={{
              position: 'absolute',
              width: '22px',
              height: '22px',
              background: 'white',
              borderRadius: '50%',
              top: '3px',
              left: settings.maintenance_mode ? '31px' : '3px',
              transition: 'left 0.3s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}></span>
          </button>
        </div>

        {settings.maintenance_mode && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#fee2e2', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#991b1b' }} />
            <span style={{ color: '#991b1b', fontSize: '13px' }}>
              All users will see "System under maintenance" when trying to login
            </span>
          </div>
        )}
      </div>

      {/* Last Updated */}
      {settings.updated_at && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>
            Last updated: {new Date(settings.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </AdminLayout>
  );
}
