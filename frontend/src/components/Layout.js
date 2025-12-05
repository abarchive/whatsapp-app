import { Link, useLocation } from 'react-router-dom';
import { Home, Send, FileText, Key, User } from 'lucide-react';

export default function Layout({ children, user }) {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2 data-testid="sidebar-logo">WhatsApp Bot</h2>
        </div>
        <nav>
          <ul className="sidebar-nav">
            <li>
              <Link to="/dashboard" className={isActive('/dashboard')} data-testid="nav-dashboard">
                <Home size={20} />
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/send-message" className={isActive('/send-message')} data-testid="nav-send-message">
                <Send size={20} />
                Send Message
              </Link>
            </li>
            <li>
              <Link to="/message-logs" className={isActive('/message-logs')} data-testid="nav-message-logs">
                <FileText size={20} />
                Message Logs
              </Link>
            </li>
            <li>
              <Link to="/api-keys" className={isActive('/api-keys')} data-testid="nav-api-keys">
                <Key size={20} />
                API Keys
              </Link>
            </li>
            <li>
              <Link to="/profile" className={isActive('/profile')} data-testid="nav-profile">
                <User size={20} />
                Profile
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
