import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { LogOut } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Layout user={user}>
      <div className="page-header">
        <h1 data-testid="page-title">Profile</h1>
        <p>Manage your account settings</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Account Information</h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading...
          </div>
        ) : profile ? (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#334155', fontSize: '14px' }}>
                Email Address
              </label>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', color: '#1e293b' }} data-testid="user-email">
                {profile.email}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#334155', fontSize: '14px' }}>
                User ID
              </label>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', color: '#1e293b', fontFamily: 'Monaco, monospace', fontSize: '14px' }}>
                {profile.id}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#334155', fontSize: '14px' }}>
                Account Created
              </label>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', color: '#1e293b' }}>
                {formatDate(profile.created_at)}
              </div>
            </div>

            <button
              className="btn btn-danger"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
            Failed to load profile
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>About This App</h3>
        </div>
        <div style={{ color: '#64748b', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#1e293b' }}>WhatsApp Automation Platform</strong>
          </p>
          <p style={{ marginBottom: '8px' }}>
            • Send WhatsApp messages via Web Dashboard
          </p>
          <p style={{ marginBottom: '8px' }}>
            • REST API for programmatic message sending
          </p>
          <p style={{ marginBottom: '8px' }}>
            • Message logging and history tracking
          </p>
          <p style={{ marginBottom: '8px' }}>
            • Secure API key authentication
          </p>
          <p style={{ marginTop: '16px', fontSize: '13px', color: '#94a3b8' }}>
            Powered by WhatsApp Web API - Connect your WhatsApp account via QR code to start sending messages.
          </p>
        </div>
      </div>
    </Layout>
  );
}
