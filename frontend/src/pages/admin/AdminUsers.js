import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/admin/AdminLayout';
import { Users, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '', role: 'user', rate_limit: 30, status: 'active' });
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalType('create');
    setFormData({ email: '', password: 'Password@123', role: 'user', rate_limit: 30, status: 'active' });
    setShowModal(true);
  };

  const handleEdit = (user) => {
    setModalType('edit');
    setSelectedUser(user);
    setFormData({ 
      email: user.email, 
      role: user.role, 
      rate_limit: user.rate_limit, 
      status: user.status === 'suspended' ? 'deactive' : user.status 
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('admin_token');
      const submitData = { ...formData };
      // Convert deactive to backend format
      if (submitData.status === 'deactive') {
        submitData.status = 'deactive';
      }
      
      if (modalType === 'create') {
        await axios.post(`${API}/admin/users`, submitData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.put(`${API}/admin/users/${selectedUser.id}`, submitData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user: ${userEmail}?`)) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleToggleStatus = async (user) => {
    const currentStatus = user.status === 'suspended' ? 'deactive' : user.status;
    const newStatus = currentStatus === 'active' ? 'deactive' : 'active';
    
    try {
      const token = localStorage.getItem('admin_token');
      await axios.put(`${API}/admin/users/${user.id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (error) {
      alert('Status update failed');
    }
  };

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getDisplayStatus = (status) => {
    return status === 'suspended' ? 'deactive' : status;
  };

  if (loading) {
    return <AdminLayout><div style={{ color: '#64748b', padding: '40px', textAlign: 'center' }}>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Users Management</h1>
          <p style={{ color: '#64748b', fontSize: '15px' }}>Manage all user accounts</p>
        </div>
        <button
          onClick={handleCreate}
          data-testid="create-user-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
        >
          <Plus size={20} />
          Create User
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Password</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Role</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Rate Limit</th>
              <th style={{ padding: '16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Created</th>
              <th style={{ padding: '16px', textAlign: 'right', color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px', color: '#1e293b', fontWeight: '500' }}>{user.email}</td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '13px' }}>
                      {showPasswords[user.id] ? (user.plain_password || '••••••••') : '••••••••'}
                    </span>
                    <button
                      onClick={() => togglePasswordVisibility(user.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                      title={showPasswords[user.id] ? 'Hide password' : 'Show password'}
                    >
                      {showPasswords[user.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ padding: '4px 12px', background: user.role === 'admin' ? '#667eea' : '#3b82f6', color: 'white', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ padding: '4px 12px', background: getDisplayStatus(user.status) === 'active' ? '#10b981' : '#ef4444', color: 'white', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                    {getDisplayStatus(user.status)}
                  </span>
                </td>
                <td style={{ padding: '16px', color: '#64748b' }}>{user.rate_limit}/hour</td>
                <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleEdit(user)}
                      style={{ padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#64748b' }}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      style={{ padding: '8px', background: getDisplayStatus(user.status) === 'active' ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: '6px', cursor: 'pointer', color: getDisplayStatus(user.status) === 'active' ? '#ef4444' : '#10b981' }}
                      title={getDisplayStatus(user.status) === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {getDisplayStatus(user.status) === 'active' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        style={{ padding: '8px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                {modalType === 'create' ? 'Create User' : 'Edit User'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  disabled={modalType === 'edit'}
                  style={{ width: '100%', padding: '12px', background: modalType === 'edit' ? '#f8fafc' : 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxSizing: 'border-box' }}
                />
              </div>

              {modalType === 'create' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Password</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                    style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxSizing: 'border-box' }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxSizing: 'border-box' }}
                >
                  <option value="active">Active</option>
                  <option value="deactive">Deactive</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Rate Limit (messages/hour)</label>
                <input
                  type="number"
                  value={formData.rate_limit}
                  onChange={(e) => setFormData({...formData, rate_limit: parseInt(e.target.value)})}
                  required
                  min="1"
                  max="1000"
                  style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '12px 24px', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#64748b', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '12px 24px', background: '#667eea', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }}
                >
                  {modalType === 'create' ? 'Create' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
