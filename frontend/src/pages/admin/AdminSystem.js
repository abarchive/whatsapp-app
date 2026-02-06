import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Activity, CheckCircle, XCircle, AlertCircle, RefreshCw, Server, Database, Wifi } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminSystem() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/admin/system/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Error fetching system status:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'healthy':
      case 'connected':
        return <CheckCircle size={20} style={{ color: '#10b981' }} />;
      case 'stopped':
      case 'unhealthy':
      case 'unreachable':
        return <XCircle size={20} style={{ color: '#ef4444' }} />;
      default:
        return <AlertCircle size={20} style={{ color: '#f59e0b' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'healthy':
      case 'connected':
        return '#10b981';
      case 'stopped':
      case 'unhealthy':
      case 'unreachable':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#94a3b8' }}>
          <div>Loading system status...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>System Status</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>Monitor all services and system health</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ padding: '10px 20px', background: '#8b5cf6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: refreshing ? 0.6 : 1 }}
          data-testid="refresh-status-btn"
        >
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overall Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* WhatsApp Service */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={24} style={{ color: '#10b981' }} />
            </div>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>WhatsApp Service</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>whatsapp-web.js Integration</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getStatusIcon(systemStatus?.whatsapp_service?.status)}
            <span style={{ color: getStatusColor(systemStatus?.whatsapp_service?.status), fontWeight: '600', textTransform: 'capitalize' }}>
              {systemStatus?.whatsapp_service?.status || 'Unknown'}
            </span>
          </div>
          {systemStatus?.whatsapp_service?.health?.connected !== undefined && (
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '8px' }}>
              Connection: {systemStatus?.whatsapp_service?.health?.connected ? 'Active' : 'Inactive'}
            </p>
          )}
        </div>

        {/* Database */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={24} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>MongoDB Database</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Primary Data Store</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getStatusIcon(systemStatus?.database)}
            <span style={{ color: getStatusColor(systemStatus?.database), fontWeight: '600', textTransform: 'capitalize' }}>
              {systemStatus?.database || 'Unknown'}
            </span>
          </div>
        </div>

        {/* API Server */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={24} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h3 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '600', margin: 0 }}>API Server</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>FastAPI Backend</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} style={{ color: '#10b981' }} />
            <span style={{ color: '#10b981', fontWeight: '600' }}>Running</span>
          </div>
        </div>
      </div>

      {/* Supervisor Services */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} />
          Supervisor Managed Services
        </h3>
        
        {systemStatus?.services?.length > 0 ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {systemStatus.services.map((service, index) => (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#0f172a', borderRadius: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {getStatusIcon(service.status)}
                  <div>
                    <p style={{ color: '#f1f5f9', fontWeight: '600', margin: 0 }}>{service.name}</p>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Uptime: {service.uptime}</p>
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    background: getStatusColor(service.status) + '20',
                    color: getStatusColor(service.status),
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}
                >
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <Server size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>No service information available</p>
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '13px' }}>
          Last updated: {systemStatus?.timestamp ? new Date(systemStatus.timestamp).toLocaleString() : 'N/A'}
        </p>
        <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
          Auto-refreshing every 30 seconds
        </p>
      </div>
    </AdminLayout>
  );
}
