import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Dashboard() {
  const { user, getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [team, setTeam] = useState(null);
  const [tab, setTab] = useState('my');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const authFetch = async (url) => {
    const token = await getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(url, { headers });
    return res.json();
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const [myStats, teamStats] = await Promise.all([
        authFetch(`${API}/outreach`),
        authFetch(`${API}/outreach?view=team`),
      ]);
      setStats(myStats);
      setTeam(teamStats.team || []);
    } catch (err) {
      console.error('Dashboard error:', err);
    }
    setLoading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontFamily: 'monospace' }}>
      Loading dashboard...
    </div>
  );

  const cardStyle = {
    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '20px 24px', flex: 1, minWidth: 140,
  };
  const labelStyle = { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 6 };
  const valueStyle = { fontSize: 28, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: '#0f172a' };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Dashboard</div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {['my', 'team'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 6, border: `1px solid ${tab === t ? '#6366f1' : '#e2e8f0'}`, background: tab === t ? '#eef2ff' : '#fff', color: tab === t ? '#6366f1' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>
            {t === 'my' ? 'My Stats' : 'Team Overview'}
          </button>
        ))}
      </div>

      {tab === 'my' && stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
            <div style={cardStyle}>
              <div style={labelStyle}>EMAILS SENT</div>
              <div style={valueStyle}>{stats.sent}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>RESPONSES</div>
              <div style={valueStyle}>{stats.replied}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>RESPONSE RATE</div>
              <div style={{ ...valueStyle, color: stats.responseRate >= 20 ? '#16a34a' : stats.responseRate >= 10 ? '#d97706' : '#94a3b8' }}>
                {stats.responseRate}%
              </div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>PROSPECTS FOUND</div>
              <div style={valueStyle}>{stats.prospectsScanned}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>ACTIVE SEQUENCES</div>
              <div style={valueStyle}>{stats.activeSequences}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>TOKENS (7D)</div>
              <div style={{ ...valueStyle, fontSize: 20 }}>{stats.weeklyTokens?.toLocaleString()}</div>
            </div>
          </div>

          {/* Recent events */}
          {(stats.recentEvents || []).length > 0 && (
            <div>
              <div style={labelStyle}>RECENT ACTIVITY</div>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {stats.recentEvents.map((e, i) => (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: i < stats.recentEvents.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.event_type === 'replied' ? '#16a34a' : e.event_type === 'sent' ? '#3b82f6' : '#94a3b8', display: 'inline-block' }} />
                      <span style={{ fontSize: 13, color: '#334155' }}>
                        {e.event_type === 'sent' ? 'Sent' : e.event_type === 'replied' ? 'Reply received' : e.event_type}
                        {e.email_type && <span style={{ color: '#94a3b8' }}> ({e.email_type})</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'team' && team && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>USER</span>
            <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>SENT</span>
            <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>REPLIES</span>
            <span style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>ACTIVE</span>
          </div>
          {/* Rows */}
          {team.map((m, i) => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '12px 16px', borderBottom: i < team.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                      {(m.full_name || '?')[0]}
                    </div>
                }
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{m.full_name || 'Unknown'}</span>
              </div>
              <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#3b82f6' }}>{m.sent}</span>
              <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>{m.replied}</span>
              <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#6366f1' }}>{m.active}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
