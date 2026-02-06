import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, Activity, Radio, Settings, FileText, LogOut, Shield } from 'lucide-react';

export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
      <aside style={{ width: '260px', background: '#1e293b', borderRight: '1px solid #334155' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <Shield size={32} style={{ color: '#a78bfa' }} />
            <div>
              <h2 style={{ fontSize: '18px', color: '#f1f5f9', fontWeight: '700', margin: 0 }}>Admin Panel</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Control Center</p>
            </div>
          </div>
          
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/dashboard" className={isActive('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/dashboard' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/dashboard' ? 'rgba(167, 139, 250, 0.1)' : 'transparent', transition: 'all 0.2s' }}>
                  <LayoutDashboard size={20} style={{ marginRight: '12px' }} />
                  Dashboard
                </Link>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/users" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/users' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/users' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                  <Users size={20} style={{ marginRight: '12px' }} />
                  Users
                </Link>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/analytics" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/analytics' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/analytics' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                  <BarChart3 size={20} style={{ marginRight: '12px' }} />
                  Analytics
                </Link>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/system" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/system' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/system' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                  <Activity size={20} style={{ marginRight: '12px' }} />
                  System Status
                </Link>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/whatsapp" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/whatsapp' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/whatsapp' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                  <Radio size={20} style={{ marginRight: '12px' }} />
                  WhatsApp
                </Link>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/settings" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/settings' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/settings' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                  <Settings size={20} style={{ marginRight: '12px' }} />
                  Settings
                </Link>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <Link to="/admin/logs" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', color: location.pathname === '/admin/logs' ? '#a78bfa' : '#94a3b8', textDecoration: 'none', borderRadius: '8px', background: location.pathname === '/admin/logs' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                  <FileText size={20} style={{ marginRight: '12px' }} />
                  Activity Logs
                </Link>
              </li>
            </ul>
          </nav>

          <div style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px' }}>
            <div style={{ padding: '12px', background: '#0f172a', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>Logged in as</p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', margin: 0, fontWeight: '600' }}>{adminUser.email}</p>
            </div>
            <button
              onClick={handleLogout}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              <LogOut size={18} style={{ marginRight: '8px' }} />
              Logout
            </button>
          </div>
        </div>
      </aside>
      
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', background: '#0f172a' }}>
        {children}
      </main>
    </div>
  );
}
