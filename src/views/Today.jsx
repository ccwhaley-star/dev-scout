import { TopBar, CompanyLogo } from "../components/Shell";

const NEWS_TAG_COLORS = {
  Leadership: "#7c3aed",
  Hiring: "#16a34a",
  Funding: "#c2410c",
  Tech: "#0a66c2",
};

// Mock news data — in production, this comes from a news API filtered by prospect domains
const SAMPLE_NEWS = [
  { domain: "cargill.com", company: "Cargill", source: "Bloomberg", ago: "2h", headline: "Cargill names ex-Target VP to lead digital transformation", tag: "Leadership" },
  { domain: "stripe.com", company: "Stripe", source: "TechCrunch", ago: "4h", headline: "Stripe expands Mexico City engineering office — 40 new hires planned", tag: "Hiring" },
  { domain: "jpmorganchase.com", company: "JPMorgan Chase", source: "WSJ", ago: "6h", headline: "JPMC allocates $2.3B to wholesale payments modernization", tag: "Funding" },
  { domain: "pg.com", company: "Procter & Gamble", source: "Reuters", ago: "1d", headline: "P&G unifies global e-commerce on SAP Commerce Cloud", tag: "Tech" },
  { domain: "pepsico.com", company: "PepsiCo", source: "Fortune", ago: "2d", headline: "PepsiCo appoints new CISO from Walmart", tag: "Leadership" },
  { domain: "mtb.com", company: "M&T Bank", source: "American Banker", ago: "3d", headline: "M&T picks vendors for core banking migration phase 2", tag: "Tech" },
];

export default function Today({ prospects = [], onSelectProspect, sendCap = { sent: 0, limit: 50 }, user }) {
  const replies = prospects.filter(p => p.stage === "replied");
  const followUpsDue = prospects.filter(p => p.stage === "contacted");
  const fresh = prospects.filter(p => (p.signalsUpdated ?? 999) <= 6 && p.stage === "new");
  const staleCount = prospects.filter(p => (p.signalsUpdated ?? 0) > 168).length;

  const relevantNews = SAMPLE_NEWS.filter(n =>
    prospects.some(p => (p.domain && p.domain === n.domain) || (p.company && p.company.toLowerCase() === n.company.toLowerCase()))
  );

  const firstName = (user?.user_metadata?.full_name || "").split(" ")[0] || "there";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const capPct = (sendCap.sent / sendCap.limit) * 100;

  return (
    <>
      <TopBar
        subtitle={today}
        title={`Good morning, ${firstName}.`}
        right={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 99 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="ds-label" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Sends today</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)", fontVariantNumeric: "tabular-nums" }}>
                {sendCap.sent}<span style={{ color: "var(--ink-400)", fontWeight: 400 }}>/{sendCap.limit}</span>
              </span>
            </div>
            <div style={{ width: 60, height: 4, borderRadius: 99, background: "var(--stone-200)", overflow: "hidden" }}>
              <div style={{ width: `${capPct}%`, height: "100%", background: capPct > 80 ? "#dc2626" : "var(--brand-coral-500)", transition: "width 400ms ease" }} />
            </div>
          </div>
        } />
      <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(340px, 1fr)", gap: 32, alignItems: "start" }}>
        {/* Left column: action sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {replies.length > 0 ? (
            <TodaySection
              label={`Replies to handle · ${replies.length}`}
              meta="These prospects responded to your outreach. Move fast."
              prospects={replies}
              accent="#16a34a"
              cta="Open reply →"
              onSelect={onSelectProspect}
            />
          ) : null}

          {followUpsDue.length > 0 ? (
            <TodaySection
              label={`Follow-ups due · ${followUpsDue.length}`}
              meta="Sent 3+ days ago, no reply yet. Time for step 2."
              prospects={followUpsDue}
              accent="#c2410c"
              cta="Draft follow-up →"
              onSelect={onSelectProspect}
            />
          ) : null}

          {fresh.length > 0 ? (
            <TodaySection
              label={`Fresh matches · ${fresh.length}`}
              meta="Surfaced in the last 24 hours. Signals are current."
              prospects={fresh}
              accent="var(--ink-700)"
              cta="Review →"
              onSelect={onSelectProspect}
            />
          ) : null}

          {replies.length === 0 && followUpsDue.length === 0 && fresh.length === 0 && (
            <EmptyState prospectCount={prospects.length} />
          )}

          {staleCount > 0 && (
            <div style={{ padding: "12px 14px", background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#92400e" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12" y2="16" />
              </svg>
              {staleCount} prospect{staleCount === 1 ? "" : "s"} {staleCount === 1 ? "has" : "have"} stale signals (7+ days old) — consider re-running a scan.
            </div>
          )}
        </div>

        {/* Right column: news feed */}
        <NewsFeed items={relevantNews} prospects={prospects} onSelectProspect={onSelectProspect} />
      </div>
    </>
  );
}

function TodaySection({ label, meta, prospects, accent, cta, onSelect }) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, borderBottom: "1px solid var(--stone-200)", paddingBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-700)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--ink-500)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>{meta}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {prospects.map(p => (
          <TodayRow key={p.id} p={p} accent={accent} cta={cta} onClick={() => onSelect?.(p)} />
        ))}
      </div>
    </section>
  );
}

function TodayRow({ p, accent, cta, onClick }) {
  const firstActivity = p.activity?.[0]?.text || (p.openRoles?.length ? `${p.openRoles.length} open role${p.openRoles.length > 1 ? "s" : ""}` : "No recent activity");
  const dateText = p.activity?.[0]?.date || "";
  return (
    <button onClick={onClick} style={{
      display: "grid", gridTemplateColumns: "40px 1fr auto auto", gap: 16, alignItems: "center",
      padding: "12px 16px", background: "var(--paper-0)", border: "1px solid var(--stone-200)",
      borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)",
      borderLeft: `3px solid ${accent}`,
      transition: "background 120ms ease, border-color 120ms ease",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--paper-100)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--paper-0)"; }}>
      <CompanyLogo domain={p.domain} initials={p.initials} company={p.company} size={32} radius={7} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.company}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {firstActivity}
        </div>
      </div>
      {dateText && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)" }}>{dateText}</div>}
      <span style={{ fontSize: 12, fontWeight: 500, color: accent }}>{cta}</span>
    </button>
  );
}

function EmptyState({ prospectCount }) {
  return (
    <div style={{ padding: "32px 20px", background: "var(--paper-0)", border: "1px dashed var(--stone-300)", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-900)", marginBottom: 6 }}>
        {prospectCount === 0 ? "No prospects yet." : "You're all caught up."}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-500)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        {prospectCount === 0 ? "Run a scan to surface your first batch of matches." : "No replies, follow-ups, or fresh matches to act on right now."}
      </div>
    </div>
  );
}

function NewsFeed({ items, prospects, onSelectProspect }) {
  return (
    <aside style={{ background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 10, padding: "16px 18px", minHeight: 260, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 10, marginBottom: 12, borderBottom: "1px solid var(--stone-200)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-700)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>News · {items.length}</span>
          <span style={{ width: 4, height: 4, borderRadius: 99, background: "#dc2626", marginLeft: 2, boxShadow: "0 0 0 3px #dc262622" }} />
        </div>
        <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 11, color: "var(--ink-500)", whiteSpace: "nowrap" }}>from your prospects</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1 }}>
        {items.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-500)" }}>
            No news matching your current prospects.
          </div>
        )}
        {items.map((n, i) => {
          const p = prospects.find(x => (x.domain === n.domain) || (x.company?.toLowerCase() === n.company.toLowerCase()));
          const tagColor = NEWS_TAG_COLORS[n.tag] || "var(--ink-600)";
          return (
            <button key={i}
              onClick={() => p && onSelectProspect?.(p)}
              style={{
                display: "grid", gridTemplateColumns: "20px 1fr", gap: 10, alignItems: "start",
                padding: "10px 0", background: "transparent", border: "none", cursor: p ? "pointer" : "default",
                textAlign: "left", borderBottom: i === items.length - 1 ? "none" : "1px solid var(--stone-100)",
                fontFamily: "var(--font-body)", width: "100%",
              }}
              onMouseEnter={e => { if (p) e.currentTarget.style.background = "var(--paper-50)"; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <CompanyLogo domain={n.domain} initials={n.company.slice(0, 2).toUpperCase()} size={20} radius={4} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: tagColor, flex: "none" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: tagColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>{n.tag}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)" }}>·</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)" }}>{n.company}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-800)", lineHeight: 1.4, letterSpacing: "-0.005em", marginBottom: 4 }}>
                  {n.headline}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)" }}>
                  {n.source} · {n.ago} ago
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
