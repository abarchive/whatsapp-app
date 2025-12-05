import { useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SendMessage({ user }) {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/messages/send`,
        { number, message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(response.data);
      setNumber('');
      setMessage('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout user={user}>
      <div className="page-header">
        <h1 data-testid="page-title">Send Message</h1>
        <p>Send WhatsApp messages directly from the dashboard</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>New Message</h3>
        </div>

        {error && (
          <div className="alert alert-error" data-testid="error-message">
            {error}
          </div>
        )}

        {result && (
          <div className="alert alert-success" data-testid="success-message">
            ✓ Message sent successfully to {result.to}!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="number">Mobile Number</label>
            <input
              id="number"
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Enter number (e.g., 9876543210 or +919876543210)"
              required
              data-testid="number-input"
            />
            <small style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', display: 'block' }}>
              Enter with or without country code. Default: +91
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              required
              rows="6"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '15px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              data-testid="message-input"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            data-testid="send-button"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>API Usage Example</h3>
        </div>
        <div className="alert alert-info">
          <p style={{ marginBottom: '12px', fontWeight: '600' }}>You can also send messages via API:</p>
          <pre style={{ background: 'white', padding: '16px', borderRadius: '8px', overflow: 'auto', fontSize: '13px' }}>
{`GET ${BACKEND_URL}/api/send?number=9876543210&msg=Hello+World
Header: api_key: YOUR_API_KEY`}
          </pre>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>Get your API key from the API Keys page</p>
        </div>
      </div>
    </Layout>
  );
}
