import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import SendMessage from './pages/SendMessage';
import MessageLogs from './pages/MessageLogs';
import APIKeys from './pages/APIKeys';
import Profile from './pages/Profile';
// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSystem from './pages/admin/AdminSystem';
import AdminWhatsApp from './pages/admin/AdminWhatsApp';
import AdminSettings from './pages/admin/AdminSettings';
import AdminLogs from './pages/admin/AdminLogs';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
    }
    setLoading(false);
  }, []);

  const PrivateRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    return user ? children : <Navigate to="/login" />;
  };

  const PublicRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    return !user ? children : <Navigate to="/dashboard" />;
  };

  // Admin route protection
  const AdminRoute = ({ children }) => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
      return <Navigate to="/admin/login" />;
    }
    return children;
  };

  const AdminPublicRoute = ({ children }) => {
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
      return <Navigate to="/admin/dashboard" />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage setUser={setUser} /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard user={user} /></PrivateRoute>} />
        <Route path="/send-message" element={<PrivateRoute><SendMessage user={user} /></PrivateRoute>} />
        <Route path="/message-logs" element={<PrivateRoute><MessageLogs user={user} /></PrivateRoute>} />
        <Route path="/api-keys" element={<PrivateRoute><APIKeys user={user} /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile user={user} setUser={setUser} /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
