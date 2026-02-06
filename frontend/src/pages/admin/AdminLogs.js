import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { FileText, RefreshCw, User, Calendar, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('all');
  const limit = 20;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/admin/logs?limit=${limit}&skip=${page * limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching logs:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('LOGIN')) return '#10b981';
    if (action.includes('REGISTERED')) return '#8b5cf6';
    if (action.includes('DELETED')) return '#ef4444';
    if (action.includes('UPDATED') || action.includes('CREATED')) return '#f59e0b';
    if (action.includes('WHATSAPP')) return '#3b82f6';
    if (action.includes('API_KEY')) return '#ec4899';
    return '#94a3b8';
  };

  const getActionIcon = (action) => {
    if (action.includes('LOGIN') || action.includes('REGISTERED')) return '👤';
    if (action.includes('DELETED')) return '🗑️';
    if (action.includes('UPDATED') || action.includes('CREATED')) return '✏️';
    if (action.includes('WHATSAPP')) return '📱';
    if (action.includes('API_KEY')) return '🔑';
    if (action.includes('SETTINGS')) return '⚙️';
    return '📋';
  };

  const filteredLogs = filterAction === 'all' 
    ? logs 
    : logs.filter(log => log.action.toLowerCase().includes(filterAction.toLowerCase()));

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>Activity Logs</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>View all system activity and user actions</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ padding: '10px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', cursor: 'pointer' }}
            data-testid="filter-select"
          >
            <option value="all">All Actions</option>
            <option value="login">Logins</option>
            <option value="registered">Registrations</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="user">User Management</option>
            <option value="api_key">API Keys</option>
            <option value="settings">Settings</option>
          </select>
          <button
            onClick={fetchLogs}
            style={{ padding: '10px 16px', background: '#8b5cf6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            data-testid="refresh-logs-btn"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div style={{ background: '#1e293b', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            Loading activity logs...
          </div>
        ) : filteredLogs.length > 0 ? (
          <div>
            {filteredLogs.map((log, index) => (
              <div
                key={log.id || index}
                style={{
                  padding: '16px 24px',
                  borderBottom: index < filteredLogs.length - 1 ? '1px solid #334155' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: '#0f172a',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}>
                  {getActionIcon(log.action)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '3px 10px',
                      background: getActionColor(log.action) + '20',
                      color: getActionColor(log.action),
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} />
                      {log.user_email}
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0', wordBreak: 'break-word' }}>
                    {log.details}
                  </p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {new Date(log.created_at).toLocaleString()}
                    {log.ip_address && (
                      <span style={{ marginLeft: '12px' }}>IP: {log.ip_address}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>No activity logs found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} logs
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '8px 16px',
                background: '#334155',
                border: 'none',
                borderRadius: '8px',
                color: page === 0 ? '#64748b' : '#f1f5f9',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              data-testid="prev-page-btn"
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '8px 16px',
                background: '#334155',
                border: 'none',
                borderRadius: '8px',
                color: page >= totalPages - 1 ? '#64748b' : '#f1f5f9',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              data-testid="next-page-btn"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '13px' }}>
          Total logs: {total}
        </p>
      </div>
    </AdminLayout>
  );
}
