import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import DevScout from './DevScout';
import Dashboard from './Dashboard';
import Profile from './Profile';
import Admin from './Admin';

function LoginScreen() {
  const { signIn, signInWithEmail, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [showAbout, setShowAbout] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordChecks = [
    { test: p => p.length >= 8, label: '8+ characters' },
    { test: p => /[A-Z]/.test(p), label: 'Uppercase letter' },
    { test: p => /[a-z]/.test(p), label: 'Lowercase letter' },
    { test: p => /[0-9]/.test(p), label: 'Number' },
    { test: p => /[^A-Za-z0-9]/.test(p), label: 'Special character' },
  ];
  const allPasswordValid = passwordChecks.every(c => c.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    if (mode === 'signup') {
      if (!allPasswordValid) { setError('Password does not meet all requirements'); setLoading(false); return; }
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9', position: 'relative' }}>
      {/* About link */}
      <button onClick={() => setShowAbout(true)}
        style={{ position: 'absolute', top: 20, right: 28, background: 'none', border: 'none', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em' }}>
        About DevScout
      </button>

      {/* About modal */}
      {showAbout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAbout(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 40px', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowAbout(false)} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer' }}>&times;</button>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>DevScout</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 24 }}>AI-POWERED PROSPECTING</div>

            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
              <p style={{ marginBottom: 16 }}>DevScout automates the process of finding companies actively hiring software developers, identifying the right hiring contacts, and generating personalized outreach sequences.</p>

              <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 14, marginBottom: 8 }}>How It Works</p>

              <p style={{ marginBottom: 12 }}><strong style={{ color: '#4f46e5' }}>1. AI-Powered Scan</strong> &mdash; Searches Indeed, LinkedIn, ZipRecruiter, BuiltIn, and Dice simultaneously using Claude AI with real-time web search. Finds companies hiring developers with 100-15,000 employees, focusing on non-tech industries.</p>

              <p style={{ marginBottom: 12 }}><strong style={{ color: '#4f46e5' }}>2. Intelligent Scoring</strong> &mdash; Each prospect receives a Match Score (0-100) based on hiring fit (open roles, company size, industry, urgency) and nearshore propensity (scaling pain, high-cost location, non-tech industry).</p>

              <p style={{ marginBottom: 12 }}><strong style={{ color: '#4f46e5' }}>3. Contact Discovery</strong> &mdash; Identifies the hiring manager or recruiter from job postings or LinkedIn, then uses Apollo.io to find verified work email addresses.</p>

              <p style={{ marginBottom: 12 }}><strong style={{ color: '#4f46e5' }}>4. AI Research Brief</strong> &mdash; Claude researches each prospect in real-time: company news, funding, growth signals, recruiter background, role analysis, and specific talking points for personalized outreach.</p>

              <p style={{ marginBottom: 12 }}><strong style={{ color: '#4f46e5' }}>5. Automated Outreach</strong> &mdash; Generates a personalized 3-email sequence (intro, follow-up, breakup) referencing specific company insights and BairesDev case studies. Emails can be drafted directly in Gmail.</p>
            </div>
          </div>
        </div>
      )}

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
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 8 : 6} style={inputStyle} />
          {mode === 'signup' && password.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {passwordChecks.map(c => (
                <span key={c.label} style={{ fontSize: 10, fontFamily: 'monospace', color: c.test(password) ? '#16a34a' : '#94a3b8' }}>
                  {c.test(password) ? '\u2713' : '\u2022'} {c.label}
                </span>
              ))}
            </div>
          )}
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
