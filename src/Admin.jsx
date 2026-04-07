import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const API = import.meta.env.VITE_API_URL || '/api';
const labelStyle = { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 6 };

export default function Admin() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const authFetch = async (url, opts = {}) => {
    const token = await getToken();
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(url, { headers, ...opts });
    return res.json();
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await authFetch(`${API}/admin`);
      setUsers(data.users || []);
    } catch (err) {
      console.error('Admin load error:', err);
    }
    setLoading(false);
  };

  const toggleDisabled = async (userId, currentlyDisabled) => {
    setActionMsg('');
    try {
      await authFetch(`${API}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ user_id: userId, is_disabled: !currentlyDisabled }),
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_disabled: !currentlyDisabled } : u));
      setActionMsg(`User ${!currentlyDisabled ? 'disabled' : 'enabled'}`);
    } catch (err) {
      setActionMsg('Error: ' + err.message);
    }
  };

  const sendPasswordReset = async (email) => {
    setActionMsg('');
    try {
      await authFetch(`${API}/admin`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reset-password', email }),
      });
      setActionMsg(`Password reset email sent to ${email}`);
    } catch (err) {
      setActionMsg('Error: ' + err.message);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontFamily: 'monospace' }}>
      Loading admin panel...
    </div>
  );

  const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' };
  const btnSmall = (color, bg, border) => ({ padding: '5px 12px', borderRadius: 5, border: `1px solid ${border}`, background: bg, color, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600 });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Admin Panel</div>
      <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 24 }}>Manage team accounts and access</div>

      {actionMsg && (
        <div style={{ padding: '10px 16px', borderRadius: 6, background: actionMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${actionMsg.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`, color: actionMsg.startsWith('Error') ? '#dc2626' : '#16a34a', fontSize: 12, fontFamily: 'monospace', marginBottom: 16 }}>
          {actionMsg}
        </div>
      )}

      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 140px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ ...labelStyle, marginBottom: 0 }}>USER</span>
          <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>STATUS</span>
          <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>USAGE (7D)</span>
          <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>ACTIONS</span>
        </div>

        {/* User rows */}
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 140px', padding: '14px 16px', borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                  {(u.full_name || u.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.full_name || 'No name'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{u.email}</div>
                {u.is_admin && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#eef2ff', color: '#6366f1', fontWeight: 700, fontFamily: 'monospace' }}>ADMIN</span>}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: u.is_disabled ? '#fef2f2' : '#f0fdf4', color: u.is_disabled ? '#dc2626' : '#16a34a', fontFamily: 'monospace' }}>
                {u.is_disabled ? 'Disabled' : 'Active'}
              </span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>
              {(u.weekly_tokens || 0).toLocaleString()} tokens
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              <button onClick={() => toggleDisabled(u.id, u.is_disabled)}
                style={u.is_disabled ? btnSmall('#16a34a', '#f0fdf4', '#bbf7d0') : btnSmall('#dc2626', '#fef2f2', '#fecaca')}>
                {u.is_disabled ? 'Enable' : 'Disable'}
              </button>
              <button onClick={() => sendPasswordReset(u.email)}
                style={btnSmall('#64748b', '#ffffff', '#e2e8f0')}>
                Reset PW
              </button>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontFamily: 'monospace' }}>
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
