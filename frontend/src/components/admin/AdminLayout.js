import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, Activity, Radio, Settings, FileText, LogOut, Shield } from 'lucide-react';

export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin/system', icon: Activity, label: 'System Status' },
    { path: '/admin/whatsapp', icon: Radio, label: 'WhatsApp' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
    { path: '/admin/logs', icon: FileText, label: 'Activity Logs' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{ 
        width: '260px', 
        background: 'white', 
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100
      }}>
        {/* Logo Section */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={22} style={{ color: 'white' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', color: '#1e293b', fontWeight: '700', margin: 0 }}>Admin Panel</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Control Center</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path} style={{ marginBottom: '4px' }}>
                  <Link 
                    to={item.path} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      color: isActive ? '#667eea' : '#64748b', 
                      textDecoration: 'none', 
                      borderRadius: '8px', 
                      background: isActive ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                      fontWeight: isActive ? '600' : '500',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={20} style={{ marginRight: '12px' }} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout - Fixed at bottom */}
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logged in as</p>
            <p style={{ fontSize: '14px', color: '#1e293b', margin: 0, fontWeight: '600', wordBreak: 'break-all' }}>{adminUser.email}</p>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '12px', 
              background: '#ef4444', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: '600', 
              fontSize: '14px',
              transition: 'background 0.2s'
            }}
          >
            <LogOut size={18} style={{ marginRight: '8px' }} />
            Logout
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        marginLeft: '260px',
        padding: '32px', 
        minHeight: '100vh',
        background: '#f8fafc'
      }}>
        {children}
      </main>
    </div>
  );
}
