import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { Copy, RefreshCw } from 'lucide-react';

const BACKEND_URL = '';
const API = `/api`;

export default function APIKeys({ user }) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchApiKey = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApiKey(response.data.api_key);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        console.error('Error fetching API key:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure? This will invalidate your current API key.')) {
      return;
    }

    setRegenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/keys/regenerate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setApiKey(response.data.api_key);
    } catch (error) {
      console.error('Error regenerating API key:', error);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="page-header">
        <h1 data-testid="page-title">API Keys</h1>
        <p>Manage your API access keys for programmatic message sending</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Your API Key</h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading...
          </div>
        ) : (
          <div>
            <div className="alert alert-info">
              ⚠️ Keep your API key secure. Do not share it publicly or commit it to version control.
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="api-key-box" data-testid="api-key-display">
                {apiKey}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleCopy}
                  data-testid="copy-button"
                >
                  <Copy size={16} />
                  {copied ? 'Copied!' : 'Copy Key'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  data-testid="regenerate-button"
                >
                  <RefreshCw size={16} />
                  {regenerating ? 'Regenerating...' : 'Regenerate Key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>API Documentation</h3>
        </div>

        <div>
          <h4 style={{ fontSize: '16px', marginBottom: '12px', color: '#1e293b' }}>Send Message via GET Request</h4>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            <p style={{ fontSize: '14px', marginBottom: '8px', color: '#64748b' }}>Endpoint:</p>
            <code style={{ display: 'block', padding: '12px', background: 'white', borderRadius: '6px', fontSize: '13px', fontFamily: 'Monaco, monospace', wordBreak: 'break-all' }}>
              GET {BACKEND_URL}/api/send?api_key=YOUR_API_KEY&number=PHONE_NUMBER&msg=MESSAGE_TEXT
            </code>
          </div>

          <h4 style={{ fontSize: '16px', marginBottom: '12px', color: '#1e293b' }}>Example URL (Ready to Use)</h4>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            <code style={{ display: 'block', padding: '12px', background: 'white', borderRadius: '6px', fontSize: '13px', fontFamily: 'Monaco, monospace', overflow: 'auto', wordBreak: 'break-all' }}>
              {BACKEND_URL}/api/send?api_key={apiKey}&number=9876543210&msg=Hello+World
            </code>
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
              💡 You can copy this URL and paste it directly in your browser to send a message!
            </p>
          </div>

          <h4 style={{ fontSize: '16px', marginBottom: '12px', color: '#1e293b' }}>Example cURL Request</h4>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
            <pre style={{ padding: '12px', background: 'white', borderRadius: '6px', fontSize: '13px', fontFamily: 'Monaco, monospace', overflow: 'auto' }}>
{`curl -X GET "${BACKEND_URL}/api/send?api_key=${apiKey}&number=9876543210&msg=Hello+from+API"`}
            </pre>
          </div>

          <h4 style={{ fontSize: '16px', marginTop: '24px', marginBottom: '12px', color: '#1e293b' }}>Response</h4>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
            <pre style={{ padding: '12px', background: 'white', borderRadius: '6px', fontSize: '13px', fontFamily: 'Monaco, monospace' }}>
{`{
  "status": "success",
  "to": "+919876543210",
  "message": "Message sent."
}`}
            </pre>
          </div>
        </div>
      </div>
    </Layout>
  );
}
