import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { Sidebar } from "./components/Shell";
import { useDevScout } from "./useDevScout";
import Today from "./views/Today";
import Scout from "./views/Scout";
import Pipeline from "./views/Pipeline";
import Dashboard from "./views/Dashboard";
import Profile from "./views/Profile";
import SequenceDrawer from "./views/SequenceDrawer";

/* ============================================================
   App — composes shell + view + drawer. Auth-gated.
   ============================================================ */

function LoginScreen() {
  const { signIn, signInWithEmail, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const passwordChecks = [
    { test: p => p.length >= 12, label: "12+ characters" },
    { test: p => /[A-Z]/.test(p), label: "Uppercase" },
    { test: p => /[a-z]/.test(p), label: "Lowercase" },
    { test: p => /[0-9]/.test(p), label: "Number" },
    { test: p => /[^A-Za-z0-9]/.test(p), label: "Special character" },
  ];
  const allValid = passwordChecks.every(c => c.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "signup") {
        if (!allValid) { setErr("Password doesn't meet all requirements."); setLoading(false); return; }
        const { error } = await signUp(email, password, fullName);
        if (error) setErr(error.message); else setSuccess("Check your email to confirm, then sign in.");
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) setErr(error.message || "Invalid credentials.");
      }
    } finally { setLoading(false); }
  };

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--stone-300)", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--ink-800)", background: "var(--paper-50)", boxSizing: "border-box" };
  const tabStyle = active => ({ padding: "8px 20px", borderRadius: 6, border: "none", background: active ? "var(--paper-200)" : "transparent", color: active ? "var(--ink-900)" : "var(--ink-500)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-mono)" });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--paper-50)", position: "relative" }}>
      <button onClick={() => setShowAbout(true)}
        style={{ position: "absolute", top: 24, right: 32, background: "none", border: "none", color: "var(--brand-coral-600)", fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer", letterSpacing: "0.05em" }}>
        About DevScout
      </button>

      {showAbout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAbout(false)}>
          <div style={{ background: "var(--paper-50)", borderRadius: 16, padding: "36px 40px", maxWidth: 600, maxHeight: "80vh", overflowY: "auto", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowAbout(false)} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 20, color: "var(--ink-500)", cursor: "pointer" }}>×</button>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 28, color: "var(--ink-900)", marginBottom: 4 }}>DevScout<span style={{ color: "var(--brand-coral-500)" }}>.</span></div>
            <div className="ds-label" style={{ marginBottom: 20, letterSpacing: "0.12em" }}>AI-POWERED PROSPECTING</div>
            <div style={{ fontSize: 13, color: "var(--ink-700)", lineHeight: 1.7 }}>
              <p style={{ marginBottom: 14 }}>DevScout is an AI-powered prospecting tool that helps sales and recruiting teams find qualified prospect companies, generate personalized outreach sequences, and track progress through a pipeline.</p>
              <p style={{ marginBottom: 14 }}><strong>Scan:</strong> AI searches Indeed, LinkedIn, ZipRecruiter, BuiltIn, and Dice for companies hiring developers, then scores each match.</p>
              <p style={{ marginBottom: 14 }}><strong>Today:</strong> Morning triage — replies to handle, follow-ups due, fresh matches, prospect-relevant news.</p>
              <p style={{ marginBottom: 14 }}><strong>Sequence:</strong> Each prospect gets an AI-generated 3-email sequence referencing specific signals and case studies.</p>
              <p style={{ marginBottom: 14 }}><strong>Pipeline:</strong> Drag-and-drop kanban to track prospects through stages.</p>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "var(--paper-0)", padding: "48px 56px", borderRadius: 16, border: "1px solid var(--stone-200)", boxShadow: "var(--shadow-lg)", width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 32, color: "var(--ink-900)", marginBottom: 4, lineHeight: 1 }}>
            DevScout<span style={{ color: "var(--brand-coral-500)" }}>.</span>
          </div>
          <div className="ds-label" style={{ letterSpacing: "0.12em", fontSize: 10 }}>AI-POWERED PROSPECTING</div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 20 }}>
          <button onClick={() => { setMode("signin"); setErr(""); setSuccess(""); }} style={tabStyle(mode === "signin")}>Sign In</button>
          <button onClick={() => { setMode("signup"); setErr(""); setSuccess(""); }} style={tabStyle(mode === "signup")}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && <input type="text" placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required style={inputStyle} />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          {mode === "signup" && password.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontFamily: "var(--font-mono)" }}>
              {passwordChecks.map(c => (
                <span key={c.label} style={{ fontSize: 10, color: c.test(password) ? "var(--success-600)" : "var(--ink-400)" }}>
                  {c.test(password) ? "✓" : "·"} {c.label}
                </span>
              ))}
            </div>
          )}
          {err && <div style={{ fontSize: 12, color: "var(--danger-600)", fontFamily: "var(--font-mono)" }}>{err}</div>}
          {success && <div style={{ fontSize: 12, color: "var(--success-600)", fontFamily: "var(--font-mono)" }}>{success}</div>}
          <button type="submit" disabled={loading}
            style={{ padding: "11px 0", borderRadius: 8, border: "none", background: "var(--brand-coral-500)", color: "var(--paper-50)", fontSize: 13, fontWeight: 600, cursor: loading ? "progress" : "pointer", fontFamily: "var(--font-body)", letterSpacing: "-0.005em" }}>
            {loading ? "…" : mode === "signup" ? "Create account" : "Sign in →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, loading, signOut, getToken } = useAuth();
  const [view, setView] = useState("today");

  const ds = useDevScout(user, getToken);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--ink-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>Loading…</div>;
  }
  if (!user) return <LoginScreen />;

  // Send-cap stats (local computation)
  const sendCap = {
    sent: ds.results.filter(p => ["contacted", "replied", "meeting", "proposal"].includes(p.stage)).length,
    limit: 50,
  };

  const handleSelect = (p) => { setView("scout"); ds.setSelected(p); };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative" }}>
      <Sidebar
        active={view}
        onNavigate={setView}
        filters={ds.filters}
        setFilters={ds.setFilters}
        onScan={ds.runScan}
        scanning={ds.scanning}
        logs={ds.logs}
        user={user}
        onSignOut={signOut}
      />

      <main style={{ flex: 1, overflowY: "auto", background: "var(--paper-50)" }}>
        {view === "today" && <Today prospects={ds.results} onSelectProspect={handleSelect} sendCap={sendCap} user={user} />}
        {view === "scout" && <Scout results={ds.results} selected={ds.selected} setSelected={ds.setSelected} setResults={ds.setResults} onDelete={ds.deleteProspect} />}
        {view === "pipeline" && <Pipeline prospects={ds.results} onMove={ds.moveStage} onSelectProspect={handleSelect} user={user} />}
        {view === "dashboard" && <Dashboard prospects={ds.results} />}
        {view === "profile" && <Profile />}

        {ds.errorMsg && (
          <div style={{ margin: "0 32px 24px", padding: "12px 16px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, color: "var(--danger-600)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            {ds.errorMsg}
          </div>
        )}
      </main>

      {ds.selected && (
        <SequenceDrawer
          prospect={ds.selected}
          sequence={ds.sequences[ds.selected.id]}
          onClose={() => ds.setSelected(null)}
          onStartSequence={ds.startSequence}
          onMarkSent={ds.markSent}
          onMarkReplied={ds.markReplied}
        />
      )}
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
