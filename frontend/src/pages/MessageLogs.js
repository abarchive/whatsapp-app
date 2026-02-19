import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const BACKEND_URL = '';
const API = `/api`;

export default function MessageLogs({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
    
    // Auto-refresh every 3 seconds
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [filter]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      
      const url = filter === 'all' 
        ? `${API}/messages/logs` 
        : `${API}/messages/logs?status=${filter}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        console.error('Error fetching logs:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <Layout user={user}>
      <div className="page-header">
        <h1 data-testid="page-title">Message Logs</h1>
        <p>View your message history and delivery status</p>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Message History</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              🔄 Auto-refreshing every 3 seconds
            </p>
          </div>
          <div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              data-testid="filter-select"
            >
              <option value="all">All Messages</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }} data-testid="no-logs-message">
            No messages found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" data-testid="logs-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Receiver</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.receiver_number}</td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.message_body}
                    </td>
                    <td>
                      <span className={`status-badge ${log.status}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        background: log.source === 'api' ? '#e0e7ff' : '#f3e8ff',
                        color: log.source === 'api' ? '#3730a3' : '#6b21a8',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {log.source.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
