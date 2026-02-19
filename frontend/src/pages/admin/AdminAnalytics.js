import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { BarChart3, TrendingUp, TrendingDown, Calendar, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = '';
const API = `/api`;

export default function AdminAnalytics() {
  const [messageStats, setMessageStats] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [overviewRes, messagesRes, activityRes] = await Promise.all([
        axios.get(`${API}/admin/analytics/overview`, { headers }),
        axios.get(`${API}/admin/analytics/messages?days=${days}`, { headers }),
        axios.get(`${API}/admin/analytics/users-activity?days=${days}`, { headers })
      ]);

      setOverview(overviewRes.data);
      setMessageStats(messagesRes.data);
      setUserActivity(activityRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#64748b' }}>
          <div>Loading analytics...</div>
        </div>
      </AdminLayout>
    );
  }

  const successRate = overview?.messages?.success_rate || 0;

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Message Analytics</h1>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Detailed message statistics and trends</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', cursor: 'pointer' }}
            data-testid="days-filter"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <button
            onClick={fetchData}
            style={{ padding: '10px 16px', background: '#667eea', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            data-testid="refresh-btn"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #667eea' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Total Messages</p>
              <h3 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '700', margin: 0 }}>{overview?.messages?.total || 0}</h3>
            </div>
            <BarChart3 size={32} style={{ color: '#667eea' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Success Rate</p>
              <h3 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '700', margin: 0 }}>{successRate}%</h3>
            </div>
            {successRate >= 80 ? (
              <TrendingUp size={32} style={{ color: '#10b981' }} />
            ) : (
              <TrendingDown size={32} style={{ color: '#ef4444' }} />
            )}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Today's Messages</p>
              <h3 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '700', margin: 0 }}>{overview?.messages?.today || 0}</h3>
            </div>
            <Calendar size={32} style={{ color: '#f59e0b' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Failed Messages</p>
              <h3 style={{ color: '#1e293b', fontSize: '28px', fontWeight: '700', margin: 0 }}>{overview?.messages?.failed || 0}</h3>
            </div>
            <TrendingDown size={32} style={{ color: '#ef4444' }} />
          </div>
        </div>
      </div>

      {/* Message Stats Bar Chart */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
          Daily Message Volume (Last {days} Days)
        </h3>
        {messageStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={messageStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="_id" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="total" fill="#667eea" name="Total" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sent" fill="#10b981" name="Sent" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <BarChart3 size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No message data available for the selected period</p>
          </div>
        )}
      </div>

      {/* Top Users Bar Chart */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>
          Top 10 Active Users (Last {days} Days)
        </h3>
        {userActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={userActivity} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis dataKey="email" type="category" stroke="#64748b" tick={{ fontSize: 11 }} width={150} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
              <Bar dataKey="message_count" fill="#f59e0b" name="Messages Sent" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <BarChart3 size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No user activity data available for the selected period</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
