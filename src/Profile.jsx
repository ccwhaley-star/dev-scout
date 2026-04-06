import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from './supabaseClient';

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', color: '#334155', background: '#f8fafc' };
const labelStyle = { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 6 };
const btnStyle = { padding: '10px 24px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne',sans-serif" };

export default function Profile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });

  const initials = (fullName || user?.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const saveProfile = async () => {
    setSaving(true); setMsg({ text: '', type: '' });
    try {
      if (supabase) {
        await supabase.from('user_profiles').update({ full_name: fullName, linkedin_url: linkedinUrl }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }
      setMsg({ text: 'Profile saved', type: 'success' });
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
    setSaving(false);
  };

  const changePassword = async () => {
    setPwMsg({ text: '', type: '' });
    if (newPassword.length < 6) return setPwMsg({ text: 'Password must be at least 6 characters', type: 'error' });
    if (newPassword !== confirmPassword) return setPwMsg({ text: 'Passwords do not match', type: 'error' });
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      setPwMsg({ text: 'Password updated', type: 'success' });
      setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setPwMsg({ text: err.message, type: 'error' });
    }
  };

  const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 20 };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Profile</div>

      {/* Avatar + Email */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#6366f1', fontFamily: "'Syne',sans-serif" }}>{initials}</div>
        )}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{fullName || 'No name set'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{user?.email || 'local@dev'}</div>
        </div>
      </div>

      {/* Edit Profile */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Edit Profile</div>
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>FULL NAME</div>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>LINKEDIN URL</div>
          <input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/your-profile" style={inputStyle} />
        </div>
        {msg.text && <div style={{ fontSize: 12, color: msg.type === 'error' ? '#dc2626' : '#16a34a', fontFamily: 'monospace', marginBottom: 10 }}>{msg.text}</div>}
        <button onClick={saveProfile} disabled={saving} style={btnStyle}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Change Password */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Change Password</div>
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>NEW PASSWORD</div>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>CONFIRM PASSWORD</div>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
        </div>
        {pwMsg.text && <div style={{ fontSize: 12, color: pwMsg.type === 'error' ? '#dc2626' : '#16a34a', fontFamily: 'monospace', marginBottom: 10 }}>{pwMsg.text}</div>}
        <button onClick={changePassword} style={{ ...btnStyle, background: '#334155' }}>
          Update Password
        </button>
      </div>
    </div>
  );
}
