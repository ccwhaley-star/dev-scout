import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import DevScout from './DevScout';
import Dashboard from './Dashboard';
import Profile from './Profile';
import Admin from './Admin';

function LoginScreen() {
  const { signIn, signInWithEmail, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    if (mode === 'signup') {
      const { error: err } = await signUp(email, password, fullName);
      if (err) setError(err.message);
      else setSuccess('Account created! Check your email to confirm, then sign in.');
    } else {
      const { error: err } = await signInWithEmail(email, password);
      if (err) setError(err.message || 'Invalid email or password');
    }
    setLoading(false);
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', color: '#334155', background: '#f8fafc' };
  const tabStyle = (active) => ({ padding: '8px 20px', borderRadius: 6, border: 'none', background: active ? '#eef2ff' : 'transparent', color: active ? '#6366f1' : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', padding: '48px 56px', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>DevScout</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.1em' }}>AI-POWERED PROSPECTING</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 24 }}>
          <button onClick={() => { setMode('signin'); setError(''); setSuccess(''); }} style={tabStyle(mode === 'signin')}>Sign In</button>
          <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }} style={tabStyle(mode === 'signup')}>Sign Up</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input type="text" placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required style={inputStyle} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: '#dc2626', fontFamily: 'monospace' }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: '#16a34a', fontFamily: 'monospace' }}>{success}</div>}
          <button type="submit" disabled={loading}
            style={{ padding: '11px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Syne',sans-serif", letterSpacing: '0.05em' }}>
            {loading ? '...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}

function AppShell() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const [view, setView] = useState('scout');
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
      Loading...
    </div>
  );

  if (!user) return <LoginScreen />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 44, background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setView('scout')}
            style={{ padding: '6px 16px', borderRadius: 5, border: 'none', background: view === 'scout' ? '#eef2ff' : 'transparent', color: view === 'scout' ? '#6366f1' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>
            Scout
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
            {user.user_metadata?.full_name || user.email}
          </span>
          {/* Gear icon */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{ padding: 4, borderRadius: 4, border: 'none', background: menuOpen ? '#eef2ff' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={menuOpen ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {/* Dropdown menu */}
          {menuOpen && (
            <div style={{ position: 'absolute', top: 36, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
              {[
                { label: 'Dashboard', key: 'dashboard' },
                { label: 'Profile', key: 'profile' },
                ...(isAdmin ? [{ label: 'Admin', key: 'admin' }] : []),
              ].map(item => (
                <button key={item.key} onClick={() => { setView(item.key); setMenuOpen(false); }}
                  style={{ width: '100%', padding: '10px 16px', border: 'none', background: view === item.key ? '#f8fafc' : '#fff', color: view === item.key ? '#6366f1' : '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                  {item.label}
                </button>
              ))}
              <button onClick={() => { signOut(); setMenuOpen(false); }}
                style={{ width: '100%', padding: '10px 16px', border: 'none', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left' }}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'scout' && <DevScout user={user} />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'profile' && <Profile />}
        {view === 'admin' && isAdmin && <Admin />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
