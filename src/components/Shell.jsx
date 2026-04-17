import { useState } from "react";

/* ============================================================
   Shell — Sidebar, TopBar, and shared visual primitives.
   Pure presentational — all data flows in through props.
   ============================================================ */

// ── Sidebar ────────────────────────────────────────────────────────────────
export function Sidebar({ active = "today", onNavigate, filters, setFilters, onScan, scanning, logs = [], user, onSignOut }) {
  const items = [
    { key: "today", label: "Today", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
    { key: "scout", label: "Scout", icon: "M11 17a6 6 0 100-12 6 6 0 000 12zm6-1l3.5 3.5" },
    { key: "pipeline", label: "Pipeline", icon: "M3 6h18M3 12h18M3 18h12" },
    { key: "dashboard", label: "Dashboard", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
    { key: "profile", label: "Profile", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
  ];

  const userInitials = ((user?.user_metadata?.full_name || user?.email || "?").trim().split(/\s+/).map(s => s[0]).join("") || "?").slice(0, 2).toUpperCase();
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Unknown";

  return (
    <aside style={{
      width: 240, background: "var(--paper-100)", borderRight: "1px solid var(--stone-200)",
      display: "flex", flexDirection: "column", flex: "none", height: "100%"
    }}>
      {/* Brand block */}
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid var(--stone-200)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--ink-900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-coral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--ink-900)", lineHeight: 1 }}>
            DevScout<span style={{ color: "var(--brand-coral-500)" }}>.</span>
          </div>
        </div>
        <div className="ds-label" style={{ marginTop: 8, letterSpacing: "0.12em", fontSize: 9 }}>AI-POWERED PROSPECTING</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: 12, borderBottom: setFilters ? "1px solid var(--stone-200)" : "none" }}>
        {items.map(it => {
          const isActive = it.key === active;
          return (
            <button key={it.key} onClick={() => onNavigate?.(it.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", marginBottom: 2, borderRadius: 6,
                border: "none", cursor: "pointer",
                fontFamily: "var(--font-body)", fontSize: 13,
                background: isActive ? "var(--paper-200)" : "transparent",
                color: isActive ? "var(--ink-900)" : "var(--ink-600)",
                fontWeight: isActive ? 600 : 500, textAlign: "left",
                transition: "background 120ms ease",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--paper-50)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
              {it.label}
            </button>
          );
        })}
      </nav>

      {/* New Scan Panel (always visible) */}
      {setFilters && (
        <div style={{ padding: "18px 16px", background: "var(--paper-50)", display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto", minHeight: 0 }}>
          <div className="ds-label" style={{ letterSpacing: "0.12em", fontSize: 9 }}>New scan</div>
          <div>
            <div className="ds-label" style={{ fontSize: 9, marginBottom: 8 }}>Industry</div>
            <select value={filters.industry} onChange={e => setFilters({ ...filters, industry: e.target.value })}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 6, border: "1px solid var(--stone-300)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-800)", background: "var(--paper-0)", boxSizing: "border-box", outline: "none" }}>
              <option>Any industry</option>
              <option>FinTech</option>
              <option>CPG</option>
              <option>AgriFood</option>
              <option>Healthcare</option>
              <option>Logistics</option>
              <option>Retail</option>
              <option>Manufacturing</option>
              <option>Insurance</option>
              <option>Energy</option>
              <option>Media</option>
              <option>Education</option>
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="ds-label" style={{ fontSize: 9 }}>Company size</span>
              <span className="ds-label" style={{ fontSize: 9, color: "var(--brand-coral-600)" }}>{filters.size.toLocaleString()}</span>
            </div>
            <input type="range" min="100" max="15000" step="50" value={filters.size}
              onChange={e => setFilters({ ...filters, size: +e.target.value })}
              style={{ width: "100%", accentColor: "var(--brand-coral-500)" }} />
          </div>
          <button onClick={onScan} disabled={scanning}
            style={{ padding: "11px 14px", borderRadius: 7, border: "none",
              cursor: scanning ? "progress" : "pointer",
              background: "var(--brand-coral-500)", color: "var(--paper-50)",
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", marginTop: 4,
              opacity: scanning ? 0.7 : 1, transition: "opacity 120ms"
            }}
            onMouseEnter={e => { if (!scanning) e.currentTarget.style.background = "var(--brand-coral-600)"; }}
            onMouseLeave={e => { if (!scanning) e.currentTarget.style.background = "var(--brand-coral-500)"; }}>
            {scanning ? "Scanning…" : "Run scan →"}
          </button>
          {(scanning || logs.length > 0) && (
            <div style={{ marginTop: 4, padding: "10px 12px", background: "var(--paper-100)", border: "1px solid var(--stone-200)", borderRadius: 6, maxHeight: 160, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span className="ds-label" style={{ fontSize: 8, letterSpacing: "0.12em" }}>Activity</span>
                {scanning && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--brand-coral-600)", letterSpacing: "0.05em", animation: "pulse-coral 1.4s ease-in-out infinite" }}>● LIVE</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-700)", lineHeight: 1.45 }}>
                {logs.slice(-20).map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 6 }}>
                    <span style={{ color: "var(--ink-400)", flex: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ wordBreak: "break-word" }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User block */}
      <div style={{ padding: 12, borderTop: "1px solid var(--stone-200)", marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => onNavigate?.("profile")} style={{
            flex: 1, minWidth: 0, all: "unset", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderRadius: 6, boxSizing: "border-box",
            background: active === "profile" ? "var(--paper-100)" : "transparent"
          }}
            onMouseEnter={e => { if (active !== "profile") e.currentTarget.style.background = "var(--paper-100)"; }}
            onMouseLeave={e => { if (active !== "profile") e.currentTarget.style.background = "transparent"; }}
            title="Open profile">
            <div style={{ width: 28, height: 28, borderRadius: 99, background: "var(--ink-900)", color: "var(--paper-50)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, flex: "none" }}>{userInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
              <div style={{ fontSize: 10, color: "var(--ink-500)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || "local@dev"}</div>
            </div>
          </button>
          {onSignOut && (
            <button onClick={onSignOut} title="Sign out"
              style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-500)", display: "flex", alignItems: "center", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--paper-100)"; e.currentTarget.style.color = "var(--ink-900)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-500)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────
export function TopBar({ title, subtitle, right }) {
  return (
    <header style={{
      padding: "22px 32px 18px", borderBottom: "1px solid var(--stone-200)",
      display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      background: "var(--paper-50)"
    }}>
      <div>
        {subtitle && <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 6 }}>{subtitle}</div>}
        {title && (
          <h1 style={{
            fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400, color: "var(--ink-900)",
            margin: 0, lineHeight: 1.05, letterSpacing: "-0.01em"
          }}>{title}</h1>
        )}
      </div>
      {right}
    </header>
  );
}

// ── Industry Pill ─────────────────────────────────────────────────────────
const INDUSTRY_GLYPH = {
  Healthcare: "M12 2v20M2 12h20",
  FinTech: "M2 8h20v10H2zM2 12h20",
  Finance: "M2 8h20v10H2zM2 12h20",
  Manufacturing: "M3 20V9l6 4V9l6 4V9l6 4v7z",
  Retail: "M5 7h14l-1 13H6zM9 7a3 3 0 016 0",
  Logistics: "M2 8h13v8H2zM15 11h5l2 3v2h-7",
  Insurance: "M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z",
  Education: "M3 9l9-5 9 5-9 5zM6 11v5c2 1.5 4 2 6 2s4-.5 6-2v-5",
  Energy: "M13 3L4 14h6l-1 7 9-11h-6z",
  Media: "M4 5h16v12H4zM9 9l6 3-6 3z",
  AgriFood: "M12 22v-8M12 14c-4 0-7-3-7-7 4 0 7 3 7 7zM12 14c4 0 7-3 7-7-4 0-7 3-7 7z",
  CPG: "M7 3h10l1 4H6zM6 7h12v14H6zM10 12h4",
};
export function IndustryPill({ name }) {
  if (!name) return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)" }}>—</span>;
  const d = INDUSTRY_GLYPH[name] || INDUSTRY_GLYPH.Manufacturing;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-700)" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
      {name}
    </span>
  );
}

// ── Match Bar ──────────────────────────────────────────────────────────────
export function MatchBar({ value, label = "Match", history }) {
  const strong = value >= 85, mid = value >= 70 && value < 85;
  const color = strong ? "var(--brand-coral-600)" : mid ? "var(--amber-600)" : "var(--ink-500)";
  const trend = history && history.length >= 2 ? value - history[0] : 0;
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span className="ds-label" style={{ fontSize: 9, letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
          {value}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginLeft: 1, opacity: 0.7, fontWeight: 400 }}>%</span>
        </span>
      </div>
      {history ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkline data={history} color={color} width={96} height={16} />
          {trend !== 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: trend > 0 ? "#16a34a" : "#dc2626" }}>
              {trend > 0 ? "↑" : "↓"}{Math.abs(trend)}
            </span>
          )}
        </div>
      ) : (
        <div style={{ height: 2, background: "var(--stone-200)", borderRadius: 1 }}>
          <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 1 }} />
        </div>
      )}
    </div>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────
export function Sparkline({ data, color = "var(--ink-700)", width = 80, height = 18, fill = true }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 2) - 1]);
  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const fillPath = linePath + ` L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={fillPath} fill={color} opacity="0.1" />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

// ── Source Chip ────────────────────────────────────────────────────────────
const SOURCE_COLORS = {
  LinkedIn: "#0a66c2", Indeed: "#2557a7", ZipRecruiter: "#00a960",
  BuiltIn: "#f26522", Dice: "#eb1c26", Multiple: "#7c3aed",
};
export function SourceChip({ name }) {
  if (!name) return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)" }}>—</span>;
  const c = SOURCE_COLORS[name] || "var(--ink-600)";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3, color: c, border: `1px solid ${c}40`, background: `${c}0d`, letterSpacing: "0.03em" }}>
      {name}
    </span>
  );
}

// ── Company Logo ───────────────────────────────────────────────────────────
export function CompanyLogo({ domain, initials, size = 36, radius = 8, company }) {
  const [failed, setFailed] = useState(false);
  const base = {
    width: size, height: size, borderRadius: radius, flex: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", position: "relative",
  };
  // Compute initials if not passed
  const initialsFallback = initials || (company ? company.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() : "?");
  // Compute domain from company if not passed
  const effectiveDomain = domain || (company ? company.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => !["inc", "llc", "corp", "co", "group", "the", "and"].includes(w))[0] + ".com" : null);
  if (!effectiveDomain || failed) {
    return (
      <div style={{ ...base, background: "var(--ink-900)", color: "var(--paper-50)", fontFamily: "var(--font-mono)", fontSize: Math.max(10, Math.round(size * 0.3)), fontWeight: 600 }}>
        {initialsFallback}
      </div>
    );
  }
  return (
    <div style={{ ...base, background: "var(--paper-0)", border: "1px solid var(--stone-200)" }}>
      <img src={`https://logo.clearbit.com/${effectiveDomain}`} alt=""
        onError={() => setFailed(true)}
        style={{ width: "82%", height: "82%", objectFit: "contain" }} />
    </div>
  );
}

// ── Connection Chip ────────────────────────────────────────────────────────
export function ConnectionChip({ connection, sharedVia }) {
  if (!connection || connection === "none") {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-400)", letterSpacing: "0.06em", textTransform: "uppercase" }}>No connection</span>
    );
  }
  const linkedinBlue = "#0a66c2";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10, color: linkedinBlue, padding: "2px 7px 2px 5px", borderRadius: 3, border: `1px solid ${linkedinBlue}33`, background: `${linkedinBlue}0d`, letterSpacing: "0.03em" }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill={linkedinBlue}>
        <path d="M20.47 2H3.53A1.45 1.45 0 002 3.47v17.06A1.45 1.45 0 003.53 22h16.94A1.45 1.45 0 0022 20.53V3.47A1.45 1.45 0 0020.47 2zM8.09 18.74h-3v-9h3v9zM6.59 8.48a1.56 1.56 0 110-3.12 1.56 1.56 0 010 3.12zm12.32 10.26h-3v-4.83c0-1.21-.43-2-1.52-2A1.65 1.65 0 0012.85 13a2 2 0 00-.1.73v5h-3v-9h3v1.2a3 3 0 012.71-1.5c2 0 3.45 1.29 3.45 4.06v5.25z" />
      </svg>
      <span style={{ fontWeight: 600 }}>{connection}</span>
      {sharedVia && <span style={{ color: "var(--ink-500)", fontWeight: 400 }}>· via {sharedVia}</span>}
    </span>
  );
}

// ── Prev Client Pill ───────────────────────────────────────────────────────
export function PrevClientPill() {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 6px", borderRadius: 3,
      color: "var(--amber-700)", border: "1px solid var(--amber-300)", background: "var(--amber-50)",
      letterSpacing: "0.05em", textTransform: "uppercase"
    }}>
      Prev client
    </span>
  );
}
