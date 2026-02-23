import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Users, MessageSquare, CheckCircle, XCircle, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API = `/api`;

const COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [messageStats, setMessageStats] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [overviewRes, messagesRes, activityRes] = await Promise.all([
        axios.get(`${API}/admin/analytics/overview`, { headers }),
        axios.get(`${API}/admin/analytics/messages?days=7`, { headers }),
        axios.get(`${API}/admin/analytics/users-activity?days=7`, { headers })
      ]);

      setOverview(overviewRes.data);
      setMessageStats(messagesRes.data);
      setUserActivity(activityRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
          <div>Loading dashboard...</div>
        </div>
      </AdminLayout>
    );
  }

  const usersPieData = [
    { name: 'Active', value: overview?.users?.active || 0 },
    { name: 'Deactive', value: overview?.users?.deactive || overview?.users?.suspended || 0 }
  ];

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: '15px' }}>Overview of your WhatsApp automation system</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #667eea' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Users</p>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{overview?.users?.total || 0}</h3>
              <p style={{ fontSize: '13px', color: '#10b981', marginTop: '8px' }}>{overview?.users?.active || 0} active</p>
            </div>
            <div style={{ width: '48px', height: '48px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} style={{ color: '#667eea' }} />
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Total Messages</p>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{overview?.messages?.total || 0}</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>{overview?.messages?.today || 0} today</p>
            </div>
            <div style={{ width: '48px', height: '48px', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={24} style={{ color: '#ec4899' }} />
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Sent Messages</p>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{overview?.messages?.sent || 0}</h3>
              <p style={{ fontSize: '13px', color: '#10b981', marginTop: '8px' }}>{overview?.messages?.success_rate || 0}% success</p>
            </div>
            <div style={{ width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={24} style={{ color: '#10b981' }} />
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Failed Messages</p>
              <h3 style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{overview?.messages?.failed || 0}</h3>
              <p style={{ fontSize: '13px', color: '#ef4444', marginTop: '8px' }}>Issues detected</p>
            </div>
            <div style={{ width: '48px', height: '48px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={24} style={{ color: '#ef4444' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Message Trend Bar Chart */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>Message Trend (Last 7 Days)</h3>
          {messageStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
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
              <MessageSquare size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>No message data available</p>
            </div>
          )}
        </div>

        {/* Users Distribution Pie Chart */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>Users Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={usersPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {usersPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Users Bar Chart */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '20px' }}>Top 10 Active Users (Last 7 Days)</h3>
        {userActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userActivity} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis dataKey="email" type="category" stroke="#64748b" tick={{ fontSize: 11 }} width={150} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
              <Bar dataKey="message_count" fill="#f59e0b" name="Messages" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <Users size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No user activity data available</p>
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '13px' }}>
          <Activity size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Auto-refreshing every 10 seconds
        </p>
      </div>
    </AdminLayout>
  );
}
