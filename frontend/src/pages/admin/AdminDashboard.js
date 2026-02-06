import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Users, MessageSquare, CheckCircle, XCircle, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [messageStats, setMessageStats] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10 seconds
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#94a3b8' }}>
          <div>Loading dashboard...</div>
        </div>
      </AdminLayout>
    );
  }

  const usersPieData = [
    { name: 'Active', value: overview?.users?.active || 0 },
    { name: 'Suspended', value: overview?.users?.suspended || 0 }
  ];

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>Dashboard</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px' }}>Overview of your WhatsApp automation system</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '16px', padding: '24px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Users</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{overview?.users?.total || 0}</h3>
              <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>{overview?.users?.active || 0} active</p>
            </div>
            <Users size={40} style={{ opacity: 0.5 }} />
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', borderRadius: '16px', padding: '24px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Messages</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{overview?.messages?.total || 0}</h3>
              <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>{overview?.messages?.today || 0} today</p>
            </div>
            <MessageSquare size={40} style={{ opacity: 0.5 }} />
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '16px', padding: '24px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Sent Messages</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{overview?.messages?.sent || 0}</h3>
              <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>{overview?.messages?.success_rate || 0}% success</p>
            </div>
            <CheckCircle size={40} style={{ opacity: 0.5 }} />
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: '16px', padding: '24px', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Failed Messages</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{overview?.messages?.failed || 0}</h3>
              <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>Issues detected</p>
            </div>
            <XCircle size={40} style={{ opacity: 0.5 }} />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Message Trend Chart */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px' }}>Message Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={messageStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="_id" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={3} name="Total" />
              <Line type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={3} name="Sent" />
              <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Users Distribution Pie Chart */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px' }}>Users Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={usersPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {usersPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Users Chart */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px' }}>Top 10 Active Users (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={userActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="email" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
            <Bar dataKey="message_count" fill="#f59e0b" name="Messages" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Auto-refresh indicator */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '13px' }}>
          <Activity size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Auto-refreshing every 10 seconds
        </p>
      </div>
    </AdminLayout>
  );
}
