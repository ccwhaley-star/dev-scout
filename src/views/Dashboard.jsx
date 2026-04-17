import { useState, useEffect } from "react";
import { useAuth } from "../AuthProvider";
import { TopBar } from "../components/Shell";
import { supabase } from "../supabaseClient";

export default function Dashboard({ prospects = [] }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ sent: 0, replied: 0, meetings: 0, prospects: prospects.length });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase || user?.id === "local") {
        // Compute locally from in-memory prospects
        setStats({
          sent: prospects.filter(p => ["contacted", "replied", "meeting", "proposal"].includes(p.stage)).length,
          replied: prospects.filter(p => ["replied", "meeting", "proposal"].includes(p.stage)).length,
          meetings: prospects.filter(p => ["meeting", "proposal"].includes(p.stage)).length,
          prospects: prospects.length,
        });
        setLoading(false);
        return;
      }
      try {
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: events } = await supabase
          .from("outreach_events")
          .select("event_type")
          .eq("user_id", user.id)
          .gte("created_at", monthAgo);
        const sent = (events || []).filter(e => e.event_type === "sent").length;
        const replied = (events || []).filter(e => e.event_type === "replied").length;
        setStats({
          sent, replied,
          meetings: prospects.filter(p => ["meeting", "proposal"].includes(p.stage)).length,
          prospects: prospects.length,
        });
      } catch (e) {
        console.error("Dashboard stats error:", e);
      }
      setLoading(false);
    })();
  }, [user, prospects]);

  const responseRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  // Estimated pipeline value (avg $100k per prospect in meeting/proposal)
  const pipelineValue = stats.meetings * 100000;
  const formatMoney = v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`;

  return (
    <>
      <TopBar subtitle="Dashboard · last 30 days" title="Performance" />
      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <StatTile label="Emails sent" value={stats.sent} />
          <StatTile label="Response rate" value={`${responseRate}%`} accent={responseRate >= 20} />
          <StatTile label="Meetings booked" value={stats.meetings} />
          <StatTile label="Pipeline value" value={formatMoney(pipelineValue)} />
        </div>

        <section style={{ background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 10, padding: "20px 22px" }}>
          <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 14 }}>Your pipeline</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {[
              { key: "new", label: "New" },
              { key: "prospecting", label: "Prospecting" },
              { key: "contacted", label: "Contacted" },
              { key: "replied", label: "Replied" },
              { key: "meeting", label: "Meeting" },
              { key: "proposal", label: "Proposal" },
            ].map(s => {
              const count = prospects.filter(p => (p.stage || "new") === s.key).length;
              return (
                <div key={s.key} style={{ padding: "14px 12px", background: "var(--paper-50)", border: "1px solid var(--stone-200)", borderRadius: 8 }}>
                  <div className="ds-label" style={{ fontSize: 9, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink-900)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{count}</div>
                </div>
              );
            })}
          </div>
        </section>

        {loading && <div style={{ textAlign: "center", color: "var(--ink-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13 }}>Loading…</div>}
      </div>
    </>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div style={{ padding: "20px 22px", background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 10 }}>
      <div className="ds-label" style={{ fontSize: 10, marginBottom: 10 }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-serif)", fontSize: 44, color: accent ? "var(--brand-coral-600)" : "var(--ink-900)",
        lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em"
      }}>
        {value}
      </div>
    </div>
  );
}
