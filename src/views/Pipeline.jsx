import { useState, useEffect } from "react";
import { TopBar, CompanyLogo } from "../components/Shell";

const STAGES = [
  { key: "new", label: "New" },
  { key: "prospecting", label: "Prospecting" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "meeting", label: "Meeting" },
  { key: "proposal", label: "Proposal" },
];

export default function Pipeline({ prospects = [], onMove, onSelectProspect, user }) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Filter to user's prospects (unclaimed go in NEW, claimed ones show in whatever stage they're in)
  const userId = user?.id;
  const myProspects = prospects.filter(p => {
    const stage = p.stage || "new";
    if (stage === "new") return !p.claimed_by; // unclaimed only
    return p.claimed_by === userId || p.claimed_by === "local" || !p.claimed_by;
  });

  const byStage = {};
  STAGES.forEach(s => byStage[s.key] = []);
  myProspects.forEach(p => {
    const k = p.stage || "new";
    (byStage[k] || byStage.new).push(p);
  });

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };
  const onDragEnd = () => { setDragId(null); setOverStage(null); };
  const onDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overStage !== stageKey) setOverStage(stageKey);
  };
  const onDrop = (e, stageKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    const numId = isNaN(id) ? id : Number(id);
    if (id != null) {
      const p = myProspects.find(x => String(x.id) === String(id));
      if (p && p.stage !== stageKey) {
        const toLabel = STAGES.find(s => s.key === stageKey)?.label || stageKey;
        setToast(`${p.company} → ${toLabel}`);
      }
      onMove?.(numId, stageKey);
    }
    setDragId(null);
    setOverStage(null);
  };

  const active = myProspects.filter(p => p.stage && p.stage !== "new").length;

  return (
    <>
      <TopBar subtitle={`Pipeline · ${active} active`} />
      <div style={{ position: "relative" }}>
        {toast && (
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            padding: "10px 16px", background: "var(--ink-900)", color: "var(--paper-50)", borderRadius: 6,
            fontFamily: "var(--font-body)", fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            display: "inline-flex", alignItems: "center", gap: 10, zIndex: 5
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            {toast}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 12, padding: "20px 32px" }}>
          {STAGES.map(s => {
            const cards = byStage[s.key];
            const isOver = overStage === s.key;
            return (
              <div key={s.key}
                onDragOver={(e) => onDragOver(e, s.key)}
                onDragLeave={() => setOverStage(cur => cur === s.key ? null : cur)}
                onDrop={(e) => onDrop(e, s.key)}
                style={{
                  background: isOver ? "var(--paper-200)" : "var(--paper-100)",
                  border: isOver ? "1px dashed var(--brand-coral-500)" : "1px solid var(--stone-200)",
                  borderRadius: 10, padding: 10, minHeight: 380,
                  transition: "background 120ms, border-color 120ms",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 10px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-700)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)", background: "var(--paper-0)", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--stone-200)" }}>{cards.length}</span>
                </div>
                {cards.map(c => (
                  <div key={c.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, c.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onSelectProspect?.(c)}
                    style={{
                      background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 8,
                      padding: 10, marginBottom: 8, cursor: "grab",
                      opacity: dragId === c.id ? 0.4 : 1,
                      boxShadow: dragId === c.id ? "0 6px 20px rgba(28,25,23,0.1)" : "none",
                      transition: "opacity 120ms",
                    }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <CompanyLogo domain={c.domain} initials={c.initials} company={c.company} size={22} radius={5} />
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: "var(--ink-900)", letterSpacing: "-0.005em",
                        lineHeight: 1.2, flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>{c.company}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)", marginBottom: 8 }}>
                      {c.industry || "—"}{c.size ? ` · ${c.size.toLocaleString()}` : ""}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
                        color: (c.matchScore || 0) >= 85 ? "var(--brand-coral-600)" : "var(--ink-700)",
                        lineHeight: 1
                      }}>
                        {c.matchScore || 0}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-500)", marginLeft: 1 }}>%</span>
                      </span>
                      {c.recruiter?.name && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                          {c.recruiter.name.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <div style={{ padding: "20px 0", textAlign: "center", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 11, color: "var(--ink-400)" }}>
                    Drop here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
