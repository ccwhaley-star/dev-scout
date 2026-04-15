import { useState } from "react";

const STAGES = [
  { key: "new", label: "NEW", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "prospecting", label: "PROSPECTING", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  { key: "contacted", label: "CONTACTED", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { key: "replied", label: "REPLIED", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { key: "meeting", label: "MEETING", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { key: "proposal", label: "PROPOSAL", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  { key: "closed_won", label: "CLOSED WON", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
];

export default function Pipeline({ results, sequences, onStageChange, onSelectProspect }) {
  const [dragOver, setDragOver] = useState(null);

  const getStage = (r) => {
    if (r.pipelineStage && r.pipelineStage !== "new") return r.pipelineStage;
    const seq = sequences[r.id];
    if (!seq || seq.step === "idle") return "new";
    if (seq.step === "researching" || seq.step === "ready") return "prospecting";
    if (seq.step === "sent") return "contacted";
    if (seq.step === "replied") return "replied";
    return r.pipelineStage || "new";
  };

  const grouped = {};
  STAGES.forEach(s => { grouped[s.key] = []; });
  results.forEach(r => {
    const stage = getStage(r);
    if (grouped[stage]) grouped[stage].push(r);
    else grouped["new"].push(r);
  });

  const handleDragStart = (e, prospectId) => {
    e.dataTransfer.setData("text/plain", String(prospectId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, stageKey) => {
    e.preventDefault();
    setDragOver(null);
    const prospectId = e.dataTransfer.getData("text/plain");
    if (prospectId && onStageChange) {
      onStageChange(isNaN(prospectId) ? prospectId : Number(prospectId), stageKey);
    }
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(stageKey);
  };

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 0", minHeight: 400 }}>
      {STAGES.map(stage => {
        const cards = grouped[stage.key] || [];
        const isDragTarget = dragOver === stage.key;
        return (
          <div key={stage.key}
            onDrop={e => handleDrop(e, stage.key)}
            onDragOver={e => handleDragOver(e, stage.key)}
            onDragLeave={() => setDragOver(null)}
            style={{
              minWidth: 200, maxWidth: 240, flex: "1 0 200px",
              background: isDragTarget ? stage.bg : "#f8fafc",
              border: `1px solid ${isDragTarget ? stage.border : "#e2e8f0"}`,
              borderRadius: 10, padding: 10, transition: "all 0.2s",
            }}>
            {/* Column header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 4px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em", color: stage.color }}>{stage.label}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "#94a3b8", background: "#fff", padding: "2px 6px", borderRadius: 4, border: "1px solid #e2e8f0" }}>{cards.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
              {cards.map(r => {
                const initials = r.company.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                return (
                  <div key={r.id}
                    draggable
                    onDragStart={e => handleDragStart(e, r.id)}
                    onClick={() => onSelectProspect?.(r)}
                    style={{
                      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
                      padding: "10px 12px", cursor: "grab", transition: "all 0.15s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>

                    {/* Company + Logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: `hsl(${(r.company.charCodeAt(0) * 37) % 360},40%,92%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: `hsl(${(r.company.charCodeAt(0) * 37) % 360},50%,45%)`, fontFamily: "monospace", flexShrink: 0, overflow: "hidden", position: "relative" }}>
                        {initials}
                        <img
                          src={r.logoUrl || `https://logo.clearbit.com/${r.company.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)[0]}.com`}
                          alt="" style={{ width: 28, height: 28, objectFit: "contain", position: "absolute", background: "#fff", padding: 2, borderRadius: 6 }}
                          onError={e => { e.target.style.display = "none"; }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.company}</div>
                        {r.industry && <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{r.industry}</div>}
                      </div>
                    </div>

                    {/* Recruiter */}
                    {r.recruiter?.name && (
                      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.recruiter.name}
                      </div>
                    )}

                    {/* Match score bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${r.matchScore || 0}%`, height: "100%", borderRadius: 2, background: (r.matchScore || 0) >= 85 ? "#16a34a" : (r.matchScore || 0) >= 70 ? "#d97706" : "#94a3b8" }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: (r.matchScore || 0) >= 85 ? "#16a34a" : (r.matchScore || 0) >= 70 ? "#d97706" : "#94a3b8" }}>{r.matchScore || 0}%</span>
                    </div>

                    {/* Tags */}
                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                      {r.isExistingClient && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", fontFamily: "monospace", fontWeight: 600 }}>PREV CLIENT</span>}
                      {r.claimed_by && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#eef2ff", color: "#6366f1", border: "1px solid #c7d2fe", fontFamily: "monospace", fontWeight: 600 }}>{r.claimed_by_name?.split(" ")[0] || "Claimed"}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
