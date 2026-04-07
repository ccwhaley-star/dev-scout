import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from './supabaseClient';

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', color: '#334155', background: '#f8fafc' };
const labelStyle = { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 6 };
const btnStyle = { padding: '10px 24px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne',sans-serif" };

function parseLinkedInCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Find header row — LinkedIn CSV headers vary but typically include First Name, Last Name, Company, Position
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const firstIdx = header.findIndex(h => h.includes('first name') || h === 'first');
  const lastIdx = header.findIndex(h => h.includes('last name') || h === 'last');
  const companyIdx = header.findIndex(h => h.includes('company') || h.includes('organization'));
  const positionIdx = header.findIndex(h => h.includes('position') || h.includes('title'));
  const emailIdx = header.findIndex(h => h.includes('email'));
  const urlIdx = header.findIndex(h => h.includes('url') || h.includes('profile'));

  const connections = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Simple CSV parse (handles quoted fields)
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cols.push(current.trim());

    const firstName = firstIdx >= 0 ? cols[firstIdx] || '' : '';
    const lastName = lastIdx >= 0 ? cols[lastIdx] || '' : '';
    if (!firstName && !lastName) continue;

    connections.push({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      company: companyIdx >= 0 ? cols[companyIdx] || '' : '',
      position: positionIdx >= 0 ? cols[positionIdx] || '' : '',
      email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
      profileUrl: urlIdx >= 0 ? cols[urlIdx] || '' : '',
    });
  }
  return connections;
}

export default function Profile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });
  const [connections, setConnections] = useState([]);
  const [connCount, setConnCount] = useState(0);
  const [connMsg, setConnMsg] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);

  const initials = (fullName || user?.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Load existing connections count on mount
  useEffect(() => {
    const stored = localStorage.getItem('ds_linkedin_connections');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConnections(parsed);
        setConnCount(parsed.length);
      } catch (e) {}
    }
  }, []);

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setConnMsg({ text: '', type: '' });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = parseLinkedInCSV(evt.target.result);
        if (parsed.length === 0) {
          setConnMsg({ text: 'No connections found in file. Make sure it\'s a LinkedIn Connections CSV.', type: 'error' });
        } else {
          setConnections(parsed);
          setConnCount(parsed.length);
          localStorage.setItem('ds_linkedin_connections', JSON.stringify(parsed));
          setConnMsg({ text: `${parsed.length} connections imported`, type: 'success' });
        }
      } catch (err) {
        setConnMsg({ text: 'Error parsing CSV: ' + err.message, type: 'error' });
      }
      setUploading(false);
    };
    reader.onerror = () => { setConnMsg({ text: 'Error reading file', type: 'error' }); setUploading(false); };
    reader.readAsText(file);
  };

  const clearConnections = () => {
    setConnections([]);
    setConnCount(0);
    localStorage.removeItem('ds_linkedin_connections');
    setConnMsg({ text: 'Connections cleared', type: 'success' });
  };

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

  // Top 5 companies from connections
  const topCompanies = (() => {
    const counts = {};
    connections.forEach(c => { if (c.company) counts[c.company] = (counts[c.company] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();

  return (
    <div style={{ padding: '28px 32px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 24 }}>Profile</div>

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

      {/* LinkedIn Connections */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>LinkedIn Connections</div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 16 }}>
          Upload your LinkedIn connections CSV to cross-reference prospects
        </div>

        {connCount > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                {connCount.toLocaleString()} connections loaded
              </span>
              <button onClick={clearConnections} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}>Clear</button>
            </div>
            {topCompanies.length > 0 && (
              <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                Top companies: {topCompanies.map(([name, count]) => `${name} (${count})`).join(', ')}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ ...btnStyle, background: '#334155', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {uploading ? 'Importing...' : 'Upload CSV'}
            <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {connMsg.text && <div style={{ fontSize: 12, color: connMsg.type === 'error' ? '#dc2626' : '#16a34a', fontFamily: 'monospace', marginTop: 10 }}>{connMsg.text}</div>}

        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 14, lineHeight: 1.6 }}>
          To export: LinkedIn &rarr; Settings &rarr; Data Privacy &rarr; Get a copy of your data &rarr; Connections
        </div>
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
