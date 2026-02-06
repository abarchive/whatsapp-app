import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Settings, Save, RefreshCw, Shield, Users, MessageSquare, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    try {
      const token = localStorage.getItem('admin_token');
      await axios.put(`${API}/admin/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#94a3b8' }}>
          <div>Loading settings...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>Global Settings</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>Configure system-wide preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            background: saved ? '#10b981' : '#8b5cf6',
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
              <RefreshCw size={18} className="spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Save size={18} />
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

      {/* Rate Limits Section */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={20} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>Rate Limiting</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Control message sending limits</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
              Default Rate Limit (messages/hour)
            </label>
            <input
              type="number"
              value={settings.default_rate_limit}
              onChange={(e) => handleChange('default_rate_limit', parseInt(e.target.value))}
              min="1"
              max="1000"
              style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '16px' }}
              data-testid="default-rate-limit"
            />
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>Applied to new user registrations</p>
          </div>

          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
              Maximum Rate Limit (messages/hour)
            </label>
            <input
              type="number"
              value={settings.max_rate_limit}
              onChange={(e) => handleChange('max_rate_limit', parseInt(e.target.value))}
              min="1"
              max="10000"
              style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '16px' }}
              data-testid="max-rate-limit"
            />
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>Maximum allowed for any user</p>
          </div>
        </div>
      </div>

      {/* Registration Section */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>User Registration</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Control new user signups</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#0f172a', borderRadius: '12px' }}>
          <div>
            <p style={{ color: '#f1f5f9', fontWeight: '600', margin: '0 0 4px 0' }}>Enable Registration</p>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Allow new users to create accounts</p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '56px', height: '28px' }}>
            <input
              type="checkbox"
              checked={settings.enable_registration}
              onChange={(e) => handleChange('enable_registration', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
              data-testid="enable-registration"
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: settings.enable_registration ? '#10b981' : '#334155',
              borderRadius: '28px',
              transition: '0.3s'
            }}>
              <span style={{
                position: 'absolute',
                content: '',
                height: '22px',
                width: '22px',
                left: settings.enable_registration ? '31px' : '3px',
                bottom: '3px',
                background: 'white',
                borderRadius: '50%',
                transition: '0.3s'
              }}></span>
            </span>
          </label>
        </div>
      </div>

      {/* Maintenance Mode Section */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>Maintenance Mode</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Temporarily disable the system</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: settings.maintenance_mode ? 'rgba(239, 68, 68, 0.1)' : '#0f172a', borderRadius: '12px', border: settings.maintenance_mode ? '1px solid #ef4444' : '1px solid transparent' }}>
          <div>
            <p style={{ color: '#f1f5f9', fontWeight: '600', margin: '0 0 4px 0' }}>Maintenance Mode</p>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              {settings.maintenance_mode ? 'System is currently in maintenance mode' : 'Enable to temporarily block all non-admin access'}
            </p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '56px', height: '28px' }}>
            <input
              type="checkbox"
              checked={settings.maintenance_mode}
              onChange={(e) => handleChange('maintenance_mode', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
              data-testid="maintenance-mode"
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: settings.maintenance_mode ? '#ef4444' : '#334155',
              borderRadius: '28px',
              transition: '0.3s'
            }}>
              <span style={{
                position: 'absolute',
                content: '',
                height: '22px',
                width: '22px',
                left: settings.maintenance_mode ? '31px' : '3px',
                bottom: '3px',
                background: 'white',
                borderRadius: '50%',
                transition: '0.3s'
              }}></span>
            </span>
          </label>
        </div>

        {settings.maintenance_mode && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontSize: '14px' }}>
              Warning: Maintenance mode will block all user access to the system
            </span>
          </div>
        )}
      </div>

      {/* Last Updated */}
      {settings.updated_at && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '13px' }}>
            Last updated: {new Date(settings.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </AdminLayout>
  );
}
