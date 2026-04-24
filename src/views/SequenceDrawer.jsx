import { useState, useEffect } from "react";
import { CompanyLogo, ConnectionChip } from "../components/Shell";

/* SequenceDrawer — slides in from right, shows signals, research brief,
   3-step email sequence, and send actions. */

export default function SequenceDrawer({ prospect, onClose, sequence, onStartSequence, onMarkSent, onMarkReplied, onCopyEmail }) {
  const [activeStep, setActiveStep] = useState(0);
  const refreshCount = sequence?.refreshCount ?? 0;
  const refreshesRemaining = Math.max(0, 3 - refreshCount);
  const isRefreshing = sequence?.step === "researching";

  useEffect(() => { setActiveStep(0); }, [prospect?.id]);

  if (!prospect) return null;

  const firstName = prospect.recruiter?.name?.split(" ")[0] || "there";

  // Fall back to sample emails if no AI-generated sequence available
  const emails = sequence?.emails?.length ? sequence.emails : [
    {
      type: "intro", step: 1, delay: 0,
      subject: `${prospect.company} × nearshore engineering partnership`,
      body: `Hi ${firstName},\n\nI noticed ${prospect.company} has ${(prospect.openRoles || []).length} senior engineering roles open${prospect.location ? ` in the ${prospect.location} area` : ""}${prospect.openRoles?.length ? ` — including ${prospect.openRoles.slice(0, 2).join(" and ")}` : ""}.\n\nBairesDev has helped similar ${prospect.industry || "teams"} scale by pairing US-based leads with nearshore engineers in Mexico City and Medellín. Same timezone, cleared security posture, typical ramp in under four weeks.\n\nWorth a 20-minute call next week?\n\nBest,\nSarah`
    },
    { type: "follow-up-1", step: 2, delay: 3,
      subject: "Quick follow-up",
      body: `Hi ${firstName},\n\nFollowing up on my note earlier. If it'd be more useful, I can send a one-page overview with two client references and typical team composition — no call needed.\n\nJust reply "send it."\n\nSarah`
    },
    { type: "follow-up-2", step: 3, delay: 7,
      subject: "Closing the loop",
      body: `Hi ${firstName},\n\nClosing the loop — if the timing's off, no worries. Happy to reconnect in Q3 when hiring velocity typically picks back up.\n\nSarah`
    },
  ];

  const activeEmail = emails[activeStep] || emails[0];
  const hasSequence = sequence?.step && sequence.step !== "idle";
  const seqStep = sequence?.step;

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "min(640px, 55vw)",
      background: "var(--paper-50)", borderLeft: "1px solid var(--stone-200)",
      boxShadow: "-8px 0 32px rgba(28,25,23,0.08)",
      display: "flex", flexDirection: "column", zIndex: 50,
      overflowY: "auto",
      animation: "slide-in-right 200ms ease-out",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--stone-200)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, background: "var(--paper-50)", position: "sticky", top: 0, zIndex: 2 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <CompanyLogo domain={prospect.domain} initials={prospect.initials} company={prospect.company} size={40} radius={8} />
          <div>
            <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 6 }}>Email sequence</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, color: "var(--ink-900)", lineHeight: 1.15 }}>{prospect.company}</div>
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: "none", border: "none", fontSize: 20, color: "var(--ink-500)", cursor: "pointer", padding: 4, lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--ink-900)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--ink-500)"}>
          ×
        </button>
      </div>

      {/* Hiring contact */}
      {prospect.recruiter?.name && (
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--stone-200)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: prospect.recruiter.connection && prospect.recruiter.connection !== "none" ? 10 : 0 }}>
            <div>
              <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 4 }}>Hiring contact</div>
              <div style={{ fontSize: 13, color: "var(--ink-900)", fontWeight: 600, marginBottom: 2 }}>{prospect.recruiter.name}</div>
              {prospect.recruiter.email && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)" }}>{prospect.recruiter.email}</div>}
              {prospect.recruiter.phone && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)", marginTop: 2 }}>{prospect.recruiter.phone}</div>}
            </div>
            <ConnectionChip connection={prospect.recruiter.connection} sharedVia={prospect.recruiter.sharedVia} />
          </div>
          {prospect.recruiter.connection === "1st" && (
            <div style={{ padding: "8px 10px", background: "#0a66c20d", border: "1px solid #0a66c233", borderRadius: 6, fontSize: 12, color: "var(--ink-700)", lineHeight: 1.5 }}>
              You're <strong style={{ color: "#0a66c2" }}>directly connected</strong> on LinkedIn. Consider opening with a personal reference.
            </div>
          )}
          {prospect.recruiter.connection === "2nd" && prospect.recruiter.sharedVia && (
            <div style={{ padding: "8px 10px", background: "#0a66c20d", border: "1px solid #0a66c233", borderRadius: 6, fontSize: 12, color: "var(--ink-700)", lineHeight: 1.5 }}>
              Shared connection via <strong style={{ color: "var(--ink-900)" }}>{prospect.recruiter.sharedVia}</strong>. Worth a quick DM before reaching out.
            </div>
          )}
        </div>
      )}

      {/* Signals */}
      {prospect.signals && prospect.signals.length > 0 && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--stone-200)" }}>
          <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 10 }}>Signals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {prospect.signals.slice(0, 5).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--brand-coral-500)", flex: "none" }}>›</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open roles */}
      {prospect.openRoles && prospect.openRoles.length > 0 && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--stone-200)" }}>
          <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 10 }}>Open roles</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {prospect.openRoles.map((r, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 8px", borderRadius: 99, border: "1px solid var(--stone-200)", background: "var(--paper-0)", fontSize: 12, color: "var(--ink-800)", lineHeight: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "#16a34a", flex: "none" }} />
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Research brief */}
      {(sequence?.research || prospect.brief) && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--stone-200)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="ds-label" style={{ letterSpacing: "0.1em" }}>Research brief</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-400)" }}>
              Claude · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.55, color: "var(--ink-800)", margin: 0, fontStyle: "italic" }}>
            {(sequence?.research || prospect.brief || "").replace(/<cite[^>]*>/gi, "").replace(/<\/cite>/gi, "")}
          </p>
        </div>
      )}

      {/* Outreach sequence tabs */}
      {(hasSequence || emails.length > 0) && (
        <>
          <div style={{ padding: "14px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="ds-label" style={{ letterSpacing: "0.1em" }}>Outreach sequence</div>
              {onStartSequence && (
                <button
                  onClick={() => refreshesRemaining > 0 && !isRefreshing && onStartSequence(prospect)}
                  disabled={refreshesRemaining === 0 || isRefreshing}
                  title={refreshesRemaining === 0 ? "No refreshes remaining" : `Regenerate emails (${refreshesRemaining} remaining)`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 10px", borderRadius: 5,
                    border: "1px solid var(--stone-300)",
                    background: refreshesRemaining === 0 ? "var(--paper-100)" : "var(--paper-0)",
                    color: refreshesRemaining === 0 ? "var(--ink-400)" : "var(--ink-700)",
                    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.03em",
                    cursor: refreshesRemaining === 0 || isRefreshing ? "not-allowed" : "pointer",
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={e => { if (refreshesRemaining > 0 && !isRefreshing) e.currentTarget.style.background = "var(--paper-100)"; }}
                  onMouseLeave={e => { if (refreshesRemaining > 0 && !isRefreshing) e.currentTarget.style.background = "var(--paper-0)"; }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isRefreshing ? "spin 0.8s linear infinite" : "none" }}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                  {isRefreshing ? "Refreshing…" : `Refresh (${refreshesRemaining})`}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ idx: 0, label: "Intro" }, { idx: 1, label: "Follow-up 1" }, { idx: 2, label: "Follow-up 2" }].map(t => {
                const isActive = activeStep === t.idx;
                return (
                  <button key={t.idx} onClick={() => setActiveStep(t.idx)}
                    style={{
                      padding: "7px 14px", borderRadius: 6,
                      border: isActive ? "1px solid #93c5fd" : "1px solid var(--stone-300)",
                      background: isActive ? "#eff6ff" : "var(--paper-0)",
                      color: isActive ? "#1d4ed8" : "var(--ink-700)",
                      fontFamily: "var(--font-body)", fontSize: 13, fontWeight: isActive ? 600 : 500, cursor: "pointer",
                    }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ padding: "16px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className="ds-label" style={{ fontSize: 10, letterSpacing: "0.1em" }}>Step {activeStep + 1}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-400)" }}>· +{activeStep === 0 ? 0 : activeStep === 1 ? 3 : 7} days</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginBottom: 10, letterSpacing: "-0.005em" }}>{activeEmail.subject}</div>
            <pre style={{
              margin: 0, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-700)",
              lineHeight: 1.6, whiteSpace: "pre-wrap", wordWrap: "break-word"
            }}>
              {(activeEmail.body || "").replace(/<cite[^>]*>/gi, "").replace(/<\/cite>/gi, "")}
            </pre>
          </div>
        </>
      )}

      {/* Sticky footer actions */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid var(--stone-200)", display: "flex", flexDirection: "column", gap: 10, position: "sticky", bottom: 0, background: "var(--paper-50)", marginTop: "auto" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              const to = prospect.recruiter?.email || "";
              const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(activeEmail.subject)}&body=${encodeURIComponent(activeEmail.body)}`;
              window.open(url, "_blank");
            }}
            style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "1px solid var(--stone-300)", background: "var(--paper-0)", color: "var(--ink-800)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 48 48">
              <path fill="#4285f4" d="M6 12v24a2 2 0 002 2h6V20l10 7 10-7v18h6a2 2 0 002-2V12L24 24z" />
              <path fill="#34a853" d="M14 38V20L6 12v24a2 2 0 002 2h6z" />
              <path fill="#fbbc04" d="M34 38h6a2 2 0 002-2V12l-8 8z" />
              <path fill="#ea4335" d="M14 20l10 7 10-7V12H14z" />
              <path fill="#c5221f" d="M6 12l8 8v-8z" />
            </svg>
            Draft in Gmail
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Subject: ${activeEmail.subject}\n\n${activeEmail.body}`);
              onCopyEmail?.();
            }}
            style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "1px solid var(--stone-300)", background: "var(--paper-0)", color: "var(--ink-800)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy Email
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {(!seqStep || seqStep === "idle" || seqStep === "ready") && (
            <button onClick={() => onMarkSent?.(prospect)}
              style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "none", background: "var(--brand-coral-500)", color: "var(--paper-50)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Mark as sent
            </button>
          )}
          {seqStep === "sent" && (
            <>
              <span style={{ flex: 1, padding: "10px 16px", borderRadius: 6, background: "var(--info-bg)", border: "1px solid var(--info-border)", color: "var(--info-600)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Sent
              </span>
              <button onClick={() => onMarkReplied?.(prospect)}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "none", background: "var(--success-600)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Mark replied
              </button>
            </>
          )}
          {seqStep === "replied" && (
            <span style={{ flex: 1, padding: "10px 16px", borderRadius: 6, background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success-600)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
              Replied — track in Pipeline
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
