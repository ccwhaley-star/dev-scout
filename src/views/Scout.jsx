import { useState, useMemo, useEffect } from "react";
import { TopBar, IndustryPill, MatchBar, SourceChip, CompanyLogo, PrevClientPill } from "../components/Shell";

export default function Scout({ results = [], selected, setSelected, setResults, onDelete }) {
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("match");
  const [focusIdx, setFocusIdx] = useState(-1);

  const filtered = useMemo(() => {
    let rs = results.slice();
    if (tab === "replies") rs = rs.filter(p => p.stage === "replied");
    else if (tab === "fresh") rs = rs.filter(p => (p.signalsUpdated ?? 999) <= 24);
    else if (tab === "stale") rs = rs.filter(p => (p.signalsUpdated ?? 0) > 168);
    else if (tab === "prev") rs = rs.filter(p => p.prevClient || p.isExistingClient);
    if (sort === "match") rs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    else if (sort === "fresh") rs.sort((a, b) => (a.signalsUpdated ?? 999) - (b.signalsUpdated ?? 999));
    else if (sort === "size") rs.sort((a, b) => (b.size || 0) - (a.size || 0));
    else if (sort === "company") rs.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
    return rs;
  }, [results, tab, sort]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter" && focusIdx >= 0) { e.preventDefault(); setSelected?.(filtered[focusIdx]); }
      else if (e.key === "Escape") { setSelected?.(null); setFocusIdx(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusIdx, setSelected]);

  const counts = {
    all: results.length,
    replies: results.filter(p => p.stage === "replied").length,
    fresh: results.filter(p => (p.signalsUpdated ?? 999) <= 24).length,
    stale: results.filter(p => (p.signalsUpdated ?? 0) > 168).length,
    prev: results.filter(p => p.prevClient || p.isExistingClient).length,
  };

  return (
    <>
      <TopBar subtitle={`Scout · ${filtered.length} of ${results.length} matches`} />
      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Tabs + sort */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 2, background: "var(--paper-100)", padding: 3, borderRadius: 8, border: "1px solid var(--stone-200)" }}>
            {[
              { key: "all", label: "All" },
              { key: "replies", label: "Replies", accent: "#16a34a" },
              { key: "fresh", label: "Fresh" },
              { key: "prev", label: "Prev client" },
              { key: "stale", label: "Stale" },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setFocusIdx(-1); }}
                style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 500,
                  background: tab === t.key ? "var(--paper-0)" : "transparent",
                  color: tab === t.key ? "var(--ink-900)" : "var(--ink-600)",
                  border: "none", borderRadius: 6, cursor: "pointer",
                  boxShadow: tab === t.key ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                  fontFamily: "var(--font-body)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                {t.label}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: tab === t.key ? (t.accent || "var(--brand-coral-600)") : "var(--ink-400)", fontWeight: 500 }}>{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="ds-label" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value)}
              style={{ padding: "6px 26px 6px 10px", borderRadius: 6, border: "1px solid var(--stone-300)", fontSize: 12, fontFamily: "var(--font-body)", color: "var(--ink-800)", background: "var(--paper-0)", outline: "none", cursor: "pointer" }}>
              <option value="match">Match score</option>
              <option value="fresh">Signal freshness</option>
              <option value="size">Company size</option>
              <option value="company">Company name</option>
            </select>
            <button
              onClick={() => exportCSV(filtered)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--stone-300)", background: "var(--paper-0)", color: "var(--ink-700)", fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer", letterSpacing: "0.03em" }}>
              ↓ Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <section style={{ background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px 1.5fr 1fr 1fr 160px 100px 32px", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--stone-200)", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-500)", letterSpacing: "0.1em", textTransform: "uppercase", background: "var(--paper-100)" }}>
            <span></span><span>Company</span><span>Industry</span><span>Recruiter</span><span>Match</span><span style={{ textAlign: "right" }}>Source</span><span></span>
          </div>
          {filtered.map((p, i) => (
            <ProspectRow key={p.id} p={p}
              rowIndex={i}
              focused={focusIdx === i}
              onSelect={setSelected}
              selected={selected?.id === p.id}
              onDelete={onDelete}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--ink-500)", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15 }}>
              No prospects in this view.
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ProspectRow({ p, onSelect, onDelete, selected, rowIndex, focused }) {
  const [hover, setHover] = useState(false);
  const isReply = p.stage === "replied";
  const isStale = (p.signalsUpdated ?? 0) > 168;
  const isFresh = (p.signalsUpdated ?? 999) <= 6;
  const bg = selected || focused ? "var(--paper-100)"
    : hover ? "var(--paper-50)"
    : isReply ? "#f0fdf4"
    : isStale ? "#fafaf9"
    : "var(--paper-0)";
  return (
    <div onClick={() => onSelect?.(p)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid", gridTemplateColumns: "44px 1.5fr 1fr 1fr 160px 100px 32px", gap: 16, alignItems: "center",
        padding: "14px 20px", borderBottom: "1px solid var(--stone-200)",
        background: bg, cursor: "pointer", position: "relative",
        boxShadow: focused ? "inset 3px 0 0 var(--brand-coral-500)" : (isReply ? "inset 3px 0 0 #16a34a" : (isStale ? "inset 3px 0 0 var(--stone-300)" : "none")),
        opacity: isStale ? 0.78 : 1,
        transition: "background 120ms ease",
      }}>
      <CompanyLogo domain={p.domain} initials={p.initials} company={p.company} size={36} radius={8} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-0.005em" }}>{p.company}</span>
          {p.recruiter?.connection && p.recruiter.connection !== "none" && (
            <span title={`${p.recruiter.connection} connection${p.recruiter.sharedVia ? ` · via ${p.recruiter.sharedVia}` : ""}`} style={{ display: "inline-flex" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2">
                <path d="M20.47 2H3.53A1.45 1.45 0 002 3.47v17.06A1.45 1.45 0 003.53 22h16.94A1.45 1.45 0 0022 20.53V3.47A1.45 1.45 0 0020.47 2zM8.09 18.74h-3v-9h3v9zM6.59 8.48a1.56 1.56 0 110-3.12 1.56 1.56 0 010 3.12zm12.32 10.26h-3v-4.83c0-1.21-.43-2-1.52-2A1.65 1.65 0 0012.85 13a2 2 0 00-.1.73v5h-3v-9h3v1.2a3 3 0 012.71-1.5c2 0 3.45 1.29 3.45 4.06v5.25z" />
              </svg>
            </span>
          )}
          {(p.prevClient || p.isExistingClient) && <PrevClientPill />}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-500)" }}>
          {p.location || "—"}
          {p.size ? ` · ${p.size.toLocaleString()} employees` : ""}
          {p.signalsUpdated != null && (
            <> · <span style={{ color: isStale ? "#b45309" : isFresh ? "#16a34a" : "var(--ink-500)" }}>
              signals {p.signalsUpdated < 24 ? `${p.signalsUpdated}h ago` : `${Math.floor(p.signalsUpdated / 24)}d ago`}
            </span></>
          )}
        </div>
        {p.openRoles && p.openRoles.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "3px 10px 3px 8px", borderRadius: 99, background: "var(--paper-0)", border: "1px solid var(--stone-200)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "#22c55e", flex: "none", boxShadow: "0 0 0 3px #22c55e1f" }} />
            <span style={{ fontSize: 12, color: "var(--ink-700)", fontWeight: 500, letterSpacing: "-0.005em" }}>{p.openRoles[0]}</span>
            {p.openRoles.length > 1 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)" }}>+{p.openRoles.length - 1}</span>
            )}
          </div>
        )}
      </div>
      <IndustryPill name={p.industry} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--ink-800)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.recruiter?.name || "—"}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.recruiter?.email || ""}</div>
      </div>
      <MatchBar value={p.matchScore || 0} history={p.scoreHistory} />
      <div style={{ textAlign: "right" }}>
        <SourceChip name={p.source} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Remove ${p.company} from prospects?`)) onDelete?.(p);
        }}
        title="Remove prospect"
        style={{
          width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent",
          color: "var(--ink-400)", cursor: "pointer", opacity: hover ? 1 : 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "opacity 120ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#b91c1c"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-400)"; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      </button>
    </div>
  );
}

function exportCSV(rows) {
  const headers = ["Company", "Industry", "Size", "Location", "Source", "Match Score", "Recruiter", "Email", "Stage"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      `"${(r.company || "").replace(/"/g, '""')}"`,
      `"${r.industry || ""}"`,
      r.size || "",
      `"${r.location || ""}"`,
      r.source || "",
      r.matchScore || "",
      `"${r.recruiter?.name || ""}"`,
      `"${r.recruiter?.email || ""}"`,
      r.stage || "new",
    ].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devscout-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
