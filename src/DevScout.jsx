import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { isExistingClient } from "./clients";
import Pipeline from "./Pipeline";

const sourceColors = { LinkedIn: "#0a66c2", Indeed: "#2557a7", ZipRecruiter: "#00a960", BuiltIn: "#f26522", Dice: "#eb1c26", Multiple: "#7c3aed" };

const INDUSTRY_ICONS = { Healthcare: "⚕️", Finance: "💲", FinTech: "💳", Manufacturing: "🏭", Retail: "🛒", Logistics: "🚚", Insurance: "🛡️", Education: "🎓", "Real Estate": "🏠", Energy: "⚡", Publishing: "📚", "Food Production": "🌾", Weather: "🌤️", "Professional Services": "💼", Aerospace: "✈️", Automotive: "🚗", Media: "📺", Telecom: "📡", "Waste Management": "♻️", Agriculture: "🌱" };

const BADGE_BASE = { fontSize: 10, fontWeight: 600, fontFamily: "monospace", padding: "3px 8px", borderRadius: 4 };
const STEP_COLORS = {
  ready: { color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe" },
  sent: { color: "#3b82f6", background: "#eff6ff", border: "1px solid #bfdbfe" },
  replied: { color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe" },
  researching: { color: "#3b82f6", background: "#eff6ff", border: "1px solid #bfdbfe" },
};
const ACCENT_COLORS = { sent: "#3b82f6", replied: "#7c3aed" };
const DEFAULT_ACCENT = "#6366f1";

const MatchBar = ({ value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", borderRadius: 2, transition: "width 1s ease", background: value >= 85 ? "#16a34a" : value >= 70 ? "#d97706" : "#94a3b8" }} />
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 32, fontFamily: "monospace", color: value >= 85 ? "#16a34a" : value >= 70 ? "#d97706" : "#94a3b8" }}>{value}%</span>
  </div>
);

const Tag = ({ children, color = "#64748b" }) => (
  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: color + "18", color, border: `1px solid ${color}33`, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "monospace" }}>{children}</span>
);

const SYSTEM = `You search job boards and return results as JSON. Search for companies hiring software developers across MULTIPLE job boards: Indeed, LinkedIn Jobs, ZipRecruiter, BuiltIn, and Dice. Use 3-4 searches covering different boards, then IMMEDIATELY return the JSON.

Rules:
- Do 3-4 web searches across different job boards (e.g. "site:indeed.com software engineer", "site:dice.com developer", "site:linkedin.com/jobs software engineer"). Vary the boards.
- After 3-4 searches, STOP searching and return the JSON immediately. Do not search more.
- Always return JSON even with partial data. Use best estimates for missing fields.
- Include ANY company you find hiring developers, regardless of size or industry.
- REQUIRED: Every prospect MUST include a recruiter or hiring manager name. First check the job posting for a contact. If none is listed, search LinkedIn for a talent acquisition, recruiter, or HR contact at that company (e.g. "[company name] recruiter LinkedIn" or "[company name] talent acquisition"). Use the most relevant person you find. If you still cannot find any contact name for a company, do NOT include that prospect.
- REQUIRED: For each recruiter, try to find their work email address. Search for "[recruiter name] [company name] email" or check the job posting. Use the format firstname@company.com or firstname.lastname@company.com as a best guess if you can determine the company's email domain. Never use generic addresses like careers@ or hr@ — find a real person's email.
- Do NOT explain, apologize, or refuse. Just return the JSON.
- Your ENTIRE response must be a single JSON object. Start with { and end with }. No text before or after.

JSON format (omit any field that is empty or unknown):
{"prospects":[{"company":"","industry":"","size":0,"location":"","roles":[],"source":"","posted":"","matchScore":0,"recruiter":{"name":"","title":"","linkedinUrl":"","email":""},"nearshoreScore":0,"nearshoreSignals":[],"notes":""}],"searchSummary":""}
matchScore: 90-100=perfect fit, 75-89=strong, 60-74=moderate. nearshoreScore: 80-100=high likelihood, 50-79=medium, 0-49=low. Return 4-6 prospects maximum. Keep notes under 10 words. Omit empty URL fields entirely — only include URLs you actually found.`;

// Production (Netlify): empty string → relative /api/messages → Netlify Functions
// Local dev: VITE_API_URL=http://localhost:3002 → Express proxy
const API_URL = import.meta.env.VITE_API_URL || "";
const AGENT_MODEL = "claude-haiku-4-5-20251001";
const AGENT_MAX_ROUNDS = 6;

// ── Shared agentic loop: handles tool_use rounds until stop_reason = "end_turn" ──
async function runAgentLoopCore({ system, max_tokens, userMsg, onSearchLog, signal, noTools, token, action }) {
  const messages = [{ role: "user", content: userMsg }];
  const tools = noTools ? undefined : [{ type: "web_search_20250305", name: "web_search" }];
  let accumulatedText = "";

  for (let round = 0; round < AGENT_MAX_ROUNDS; round++) {
    if (signal?.aborted) throw new DOMException("Scan stopped", "AbortError");

    // On last round, drop tools to force a text response
    const isLastRound = round === AGENT_MAX_ROUNDS - 1;
    const roundTools = isLastRound ? undefined : tools;

    const body = { model: AGENT_MODEL, max_tokens, system, messages };
    if (roundTools) body.tools = roundTools;

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (action) headers["x-devscout-action"] = action;

    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
    const textBlocks = data.content.filter(b => b.type === "text");

    // Capture any text the model returns alongside tool calls
    if (textBlocks.length > 0) {
      accumulatedText += textBlocks.map(b => b.text).join("").trim();
    }

    if (toolUseBlocks.length > 0) {
      if (onSearchLog) {
        toolUseBlocks.forEach(b => {
          if (b.name === "web_search" && b.input?.query) {
            onSearchLog(b.input.query);
          }
        });
      }
      messages.push({ role: "assistant", content: data.content });
      messages.push({ role: "user", content: toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: b.output ?? "Search completed."
      })) });
      continue;
    }

    return textBlocks.map(b => b.text).join("").trim() || accumulatedText;
  }

  // If we got here, all rounds were used — return whatever text we accumulated
  if (accumulatedText) return accumulatedText;
  throw new Error("Agent did not produce a final response after max rounds.");
}

function looksLikeJSON(str) {
  const cleaned = (str || "").replace(/```json|```/gi, "").trim();
  if (!cleaned.startsWith("{")) return false;
  // Check it has prospects and is parseable (or at least close)
  if (!cleaned.includes('"prospects"')) return false;
  // Check it ends properly (not truncated)
  return cleaned.endsWith("}");
}

async function runAgentLoop(userMsg, onSearchLog, signal, token) {
  let raw;
  try {
    raw = await runAgentLoopCore({ system: SYSTEM, max_tokens: 8000, userMsg, onSearchLog: q => onSearchLog(`Searching: "${q}"`), signal, token, action: "scan" });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn("First pass failed:", err.message);
    raw = "";
  }

  console.log("Scan raw response:", raw?.slice(0, 500));

  if (looksLikeJSON(raw)) return raw;

  // Retry: convert accumulated text to JSON (no tools, no searching)
  if (onSearchLog) onSearchLog("Converting results to JSON...");
  if (raw) {
    try {
      const retry = await runAgentLoopCore({
        system: `Convert the following research into a JSON object. Return ONLY valid JSON, nothing else. Omit empty fields. Use this format: {"prospects":[{"company":"","industry":"","size":0,"location":"","roles":[],"source":"","matchScore":0,"recruiter":{"name":"","title":"","email":""},"nearshoreScore":0}],"searchSummary":""}`,
        max_tokens: 8000,
        userMsg: raw.slice(0, 3000),
        signal,
        noTools: true,
        token, action: "scan"
      });
      console.log("Retry response:", retry?.slice(0, 500));
      if (looksLikeJSON(retry)) return retry;
    } catch (retryErr) {
      console.warn("Retry failed:", retryErr.message);
    }
  }

  // Last resort: fresh scan with very aggressive JSON-only prompt
  if (onSearchLog) onSearchLog("Retrying scan...");
  const lastTry = await runAgentLoopCore({
    system: `Search for companies hiring developers. Do 1 web search, then IMMEDIATELY return JSON. Your response must be ONLY a JSON object: {"prospects":[...],"searchSummary":""}. Each prospect needs: company, industry, size, location, roles array, source, matchScore, recruiter (with name and title). No text outside the JSON.`,
    max_tokens: 8000,
    userMsg,
    onSearchLog: q => onSearchLog(`Searching: "${q}"`),
    signal, token, action: "scan"
  });
  console.log("Last resort response:", lastTry?.slice(0, 500));
  return lastTry;
}

const SYSTEM_ENRICH = `You are a LinkedIn connection research agent. Given a list of companies with recruiters and a user's LinkedIn profile or name, determine if the user might have connections at those companies.

For each company/recruiter, perform web searches like:
- "[user name] [company name] LinkedIn"
- "[user name] [recruiter name] LinkedIn"
- "[recruiter name] [user's current/past company]"
- "[user name] LinkedIn" (to find their work history and education)
- "[company name] employees from [user's past companies]"

Look for public signals:
- Shared employers (current or past)
- Shared educational institutions
- Mutual group memberships
- Public interactions (likes, comments, posts)
- Shared industry conferences or events

Return ONLY a raw JSON object — no markdown, no code fences:
{
  "enrichments": [
    {
      "company": "Acme Corp",
      "companyRelationship": "Former employee (2019-2021)",
      "recruiterRelationship": "Former colleague at Google",
      "connectionStatus": {
        "status": "possible",
        "connectionDegree": "2nd",
        "details": "User and recruiter both worked at Google in 2020-2022",
        "mutualConnections": ["John Doe - VP Engineering"],
        "sharedGroups": ["React Developers Community"]
      }
    }
  ]
}

companyRelationship: Describe the user's relationship to the company. Examples:
- "Former employee (2019-2021)"
- "Worked with current employees at [previous company]"
- "Alumni network overlap ([university])"
- "Shared industry group ([group name])"
- "Client/vendor relationship"
- "No known relationship"

recruiterRelationship: Describe the user's relationship to the recruiter. Examples:
- "Former colleague at [company]"
- "Same university ([school name])"
- "2nd degree connection via [mutual contact]"
- "Shared LinkedIn group ([group])"
- "No known connection"

connectionDegree: Estimate the LinkedIn connection degree based on your research:
- "1st": Direct evidence they are connected (mutual interactions, endorsements, shared content)
- "2nd": They share mutual connections or former colleagues
- "3rd": Weak signals only (same industry group, same university different years, same large employer but no overlap)
- "unknown": No signals to estimate degree

status values:
- "none": No connection signals found
- "possible": Indirect signals (shared employer/school/group)
- "likely": Strong signals (mutual interactions, direct evidence)

Be realistic — LinkedIn connection data is mostly private. Focus on publicly available signals. If you cannot find anything, use "none" status with "No known relationship"/"No known connection" for the relationship fields.
Your entire response must be only the JSON object.`;

const SYSTEM_SEQUENCE = `You are a sales development outreach agent. Given a prospect (company, recruiter, open roles, connection info, and the user's background), generate a personalized outreach sequence.

Use web search to research:
- The company's recent news, funding, product launches, or growth signals
- The recruiter/hiring manager's background and recent activity
- The specific roles they're hiring for

Then produce a JSON response with:
1. A research brief summarizing key insights and talking points
2. A 3-email outreach sequence personalized to the prospect

Return ONLY a raw JSON object — no markdown, no code fences:
{
  "research": "2-3 paragraph brief: company context, recruiter background, LinkedIn connection degree (1st/2nd/3rd) to the recruiter and how that connection exists, why this is a good prospect, specific talking points to reference",
  "emails": [
    {
      "type": "intro",
      "subject": "Short, specific subject referencing their situation — not generic",
      "body": "STRICT RULES FOR INTRO EMAIL: Max 3 short paragraphs, 75 words or fewer total. Structure: (1) Hook: One sentence showing you did homework — reference a specific signal like open roles, funding, growth, or tech stack. (2) Value: Mention BairesDev by name naturally (e.g. 'We at BairesDev just helped...' or 'BairesDev recently...'). Lead with a specific case study or outcome relevant to their industry. No award lists, no credential dumps, no company description. (3) CTA: One direct, low-friction ask. Confident, not apologetic. AVOID: 'might be a fit', 'just wanted to', 'I wanted to reach out', listing awards in body, vague social proof, passive/hedging language. REQUIRED: The word 'BairesDev' MUST appear in the email body. Write like a human, not a press release."
    },
    {
      "type": "follow-up-1",
      "subject": "Re: [original subject]",
      "body": "Follow-up after 3 days. Add new value — a different case study or specific insight about their hiring challenge. 2-3 sentences max. No rehashing the first email."
    },
    {
      "type": "follow-up-2",
      "subject": "Re: [original subject]",
      "body": "Final follow-up after 7 days. Brief breakup — one sentence acknowledging they're busy, one leaving the door open. No guilt, no pressure."
    }
  ]
}

Guidelines:
- IMPORTANT: Use \\n\\n between paragraphs in email bodies for proper spacing. Each paragraph should be separated by a blank line.
- Write like an expert B2B sales copywriter, not a marketer
- Every sentence must earn its place — cut anything that doesn't move toward a reply
- Lead with outcomes and specifics, never with company descriptions
- REQUIRED: Always mention "BairesDev" by name in the intro email body — weave it into the case study naturally (e.g. "We at BairesDev helped..." or "BairesDev recently embedded..."). Credentials (Inc. 5000, IAOP Top 100, client names) go in the SIGNATURE only, not the body
- If connection data exists, weave it into the hook naturally
- Use the user's name in the signature if provided
Your entire response must be only the JSON object.`;

function extractNameFromLinkedIn(url) {
  if (!url) return "";
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  if (!match) return "";
  return match[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function runEnrichLoop(prospects, userLinkedin, userName, onSearchLog, token) {
  const companyList = prospects.map(p => {
    const rec = p.recruiter?.name ? `Recruiter: ${p.recruiter.name} (${p.recruiter.title || "unknown title"})` : "Recruiter: unknown";
    return `- ${p.company} (${p.location || "unknown location"}) — ${rec}`;
  }).join("\n");

  const userMsg = `Research LinkedIn connections for this user:
Name: ${userName}
LinkedIn: ${userLinkedin || "not provided"}

Companies and recruiters to check:
${companyList}

Search for connections between this user and each company/recruiter. Return JSON with enrichments.`;

  return runAgentLoopCore({ system: SYSTEM_ENRICH, max_tokens: 6000, userMsg, onSearchLog: q => onSearchLog(`Cross-ref: "${q}"`), token, action: "enrich" });
}

async function runSequenceAgent(prospect, userLinkedin, userName, token) {
  const connectionInfo = prospect.connectionStatus
    ? `Connection status: ${prospect.connectionStatus.status}\nLinkedIn connection degree: ${prospect.connectionStatus.connectionDegree || "unknown"}\nDetails: ${prospect.connectionStatus.details || "none"}\nCompany relationship: ${prospect.companyRelationship || "unknown"}\nRecruiter relationship: ${prospect.recruiterRelationship || "unknown"}`
    : "No connection data available.";

  const recruiterInfo = prospect.recruiter?.name
    ? `Recruiter: ${prospect.recruiter.name} (${prospect.recruiter.title || "unknown title"})\nRecruiter LinkedIn: ${prospect.recruiter.linkedinUrl || "not found"}`
    : "Recruiter: unknown";

  const userMsg = `Generate a personalized outreach sequence for this prospect:

Company: ${prospect.company}
Industry: ${prospect.industry || "unknown"}
Size: ${prospect.size || "unknown"} employees
Location: ${prospect.location || "unknown"}
Open roles: ${(prospect.roles || []).join(", ")}
${recruiterInfo}

${connectionInfo}

User info:
Name: ${userName || "not provided"}
LinkedIn: ${userLinkedin || "not provided"}

Research this company and recruiter, then generate the outreach sequence JSON.`;

  return runAgentLoopCore({ system: SYSTEM_SEQUENCE, max_tokens: 6000, userMsg, token, action: "sequence" });
}

function parseAgentJSON(raw) {
  // Strip any accidental markdown fences
  let cleaned = raw.replace(/```json|```/gi, "").trim();
  // Find the outermost JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON object found in response");

  if (end > start) {
    cleaned = cleaned.slice(start, end + 1);
  } else {
    // Truncated — try to salvage
    cleaned = cleaned.slice(start);
  }

  // Try parsing as-is first
  try { return JSON.parse(cleaned); } catch (e) { /* fall through to repair */ }

  // Repair truncated JSON: find last complete prospect object
  const lastCompleteObj = cleaned.lastIndexOf("}");
  if (lastCompleteObj > 0) {
    // Try closing the array and outer object
    const repaired = cleaned.slice(0, lastCompleteObj + 1) + '],"searchSummary":""}';
    try { return JSON.parse(repaired); } catch (e2) { /* try next repair */ }

    // Try just closing with ]}
    const repaired2 = cleaned.slice(0, lastCompleteObj + 1) + ']}';
    try { return JSON.parse(repaired2); } catch (e3) { /* give up */ }
  }

  throw new Error("Could not parse JSON. Raw: " + raw.slice(0, 200));
}

const DEMO_SEQUENCES = {
  "demo-1": {
    step: "ready", activeEmail: 0, notes: "",
    research: "MedVault Health is a fast-growing healthtech company in Austin, TX with 420 employees. They have 6 open developer roles that have been unfilled for 3+ weeks, signaling hiring urgency. Sarah Chen, their Technical Recruiter, is a 2nd-degree LinkedIn connection via David Kim (Engineering Lead at HealthStack). MedVault has no existing offshore or nearshore partnerships, making them an ideal prospect for BairesDev's healthcare vertical expertise.",
    emails: [
      { type: "intro", subject: "Your 6 unfilled dev roles at MedVault", body: "Sarah — I noticed MedVault has had Senior Backend and DevOps roles open for 3+ weeks. In healthtech, that kind of delay can stall product timelines fast.\n\nWe at BairesDev just helped a Series B healthtech company staff 4 senior engineers in under 3 weeks — all HIPAA-experienced, all retained past 12 months.\n\nWorth a 15-minute call this week to see if we can help clear your backlog?" },
      { type: "follow-up-1", subject: "Re: Your 6 unfilled dev roles at MedVault", body: "Sarah — quick follow-up. A mid-size EHR platform we work with cut their time-to-hire from 8 weeks to 12 days using our pre-vetted nearshore engineers.\n\nHappy to share specifics if useful." },
      { type: "follow-up-2", subject: "Re: Your 6 unfilled dev roles at MedVault", body: "Sarah — I know things move fast in healthtech recruiting. No worries if the timing isn't right.\n\nIf those roles are still open down the road, I'm here. Happy to help whenever it makes sense." }
    ]
  },
  "demo-2": {
    step: "ready", activeEmail: 0, notes: "",
    research: "FreightWise Logistics is a mid-size logistics company in Nashville, TN with 680 employees. They're hiring Full Stack Developers and React Engineers, suggesting a digital transformation or platform build. Marcus Johnson is the Hiring Manager. No existing offshore teams detected, and their Nashville location means high cost-of-living talent competition. BairesDev's logistics experience with route optimization and supply chain platforms is directly relevant.",
    emails: [
      { type: "intro", subject: "Scaling your dev team at FreightWise", body: "Marcus — saw FreightWise is hiring Full Stack and React engineers in Nashville. Competing for that talent against healthcare and fintech in the same market is tough.\n\nBairesDev recently helped a $200M logistics company build out their real-time tracking platform with 3 senior React devs — deployed in under 2 weeks, still on the team 8 months later.\n\nOpen to a quick call to see if we could help accelerate your hiring?" },
      { type: "follow-up-1", subject: "Re: Scaling your dev team at FreightWise", body: "Marcus — one more data point. A freight management company we work with saved ~40% on engineering costs by augmenting with our nearshore team, without sacrificing code quality or velocity.\n\nHappy to walk through how they structured it." },
      { type: "follow-up-2", subject: "Re: Scaling your dev team at FreightWise", body: "Marcus — totally understand if this isn't a priority right now.\n\nIf those roles are still open later or if you need to scale quickly, feel free to reach out anytime." }
    ]
  },
  "demo-3": {
    step: "ready", activeEmail: 0, notes: "",
    research: "Apex Financial Group is a Series C fintech in Denver, CO with 310 employees and 8 open engineering roles — signaling aggressive growth. Jessica Park, VP of Engineering, is leading the hiring push. With a small eng team in a high cost-of-living market, they're likely struggling to compete for local talent. BairesDev's fintech expertise (SOC 2 compliant teams, PCI-DSS experience) and track record with similar-stage companies make this a strong fit.",
    emails: [
      { type: "intro", subject: "8 open eng roles at Apex — let's fix that", body: "Jessica — 8 engineering roles open at a 310-person fintech is a big lift, especially in Denver's market right now.\n\nBairesDev helped a Series B payments company staff 5 senior engineers in 10 days — all with SOC 2 and PCI-DSS experience. They shipped their compliance milestone 3 weeks early.\n\nWorth 15 minutes to see if we can help Apex move faster?" },
      { type: "follow-up-1", subject: "Re: 8 open eng roles at Apex — let's fix that", body: "Jessica — another fintech we work with (similar stage to Apex) cut their engineering costs by 35% while doubling their deployment frequency with our nearshore team.\n\nHappy to share the playbook if it's useful." },
      { type: "follow-up-2", subject: "Re: 8 open eng roles at Apex — let's fix that", body: "Jessica — I know scaling engineering at a Series C pace is intense. No pressure at all.\n\nIf those roles are still open or you need to ramp quickly, I'm a message away." }
    ]
  }
};

export default function DevScout({ user }) {
  const { getToken } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | scanning | done | error
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState(null);
  const [sequences, setSequences] = useState({});
  const [viewMode, setViewMode] = useState("list");
  // Filters are static defaults for now — ready to wire up filter UI later
  const filters = useMemo(() => ({ source: "All", industry: "All", minSize: 100, maxSize: 15000, minMatch: 0 }), []);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [clientsOnly, setClientsOnly] = useState(false);
  const scanMinSize = 100;
  const [scanMaxSize, setScanMaxSize] = useState(() => window.innerWidth <= 768 ? 15000 : 1000);
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState(() => localStorage.getItem("ds_linkedin") || "");
  const [userName, setUserName] = useState(() => localStorage.getItem("ds_username") || "");

  // Load prospects + profile from Supabase on mount
  useEffect(() => {
    if (!user) return;
    if (user.user_metadata?.full_name && !userName) {
      setUserName(user.user_metadata.full_name);
      localStorage.setItem("ds_username", user.user_metadata.full_name);
    }
    import('./supabaseClient').then(({ supabase }) => {
      if (!supabase || user.id === 'local') return;
      // Load profile
      supabase.from('user_profiles').select('linkedin_url, full_name').eq('id', user.id).single().then(({ data }) => {
        if (data?.linkedin_url && !linkedinUrl) {
          setLinkedinUrl(data.linkedin_url);
          localStorage.setItem("ds_linkedin", data.linkedin_url);
        }
        if (data?.full_name && !userName) {
          setUserName(data.full_name);
          localStorage.setItem("ds_username", data.full_name);
        }
      });
      // Load prospects from shared pool
      supabase.from('prospects').select('*').order('match_score', { ascending: false }).then(async ({ data, error }) => {
        console.log('Supabase prospects load:', data?.length || 0, 'rows', error?.message || 'OK');
        if (data && data.length > 0) {
          const mapped = data.map(p => ({
            id: p.id,
            dbId: p.id,
            company: p.company,
            industry: p.industry,
            size: p.size,
            sizeSource: p.size_source,
            location: p.location,
            roles: p.roles || [],
            source: p.source,
            posted: p.posted,
            matchScore: p.match_score,
            rawMatchScore: p.raw_match_score,
            rawNearshoreScore: p.raw_nearshore_score,
            nearshoreScore: p.nearshore_score,
            nearshoreSignals: p.nearshore_signals || [],
            notes: p.notes,
            linkedinUrl: p.linkedin_url,
            indeedUrl: p.indeed_url,
            ziprecruiterUrl: p.ziprecruiter_url,
            builtinUrl: p.builtin_url,
            diceUrl: p.dice_url,
            recruiter: {
              name: p.recruiter_name,
              title: p.recruiter_title,
              email: p.recruiter_email,
              linkedinUrl: p.recruiter_linkedin_url,
              photoUrl: p.recruiter_photo_url,
            },
            connectionStatus: p.connection_status || {},
            companyRelationship: p.company_relationship,
            recruiterRelationship: p.recruiter_relationship,
            scanned_by: p.scanned_by,
            claimed_by: p.claimed_by,
            claimed_by_name: null,
            pipelineStage: p.pipeline_stage || "new",
          }));
          // Load claimer names for claimed prospects
          const claimerIds = [...new Set(data.filter(p => p.claimed_by).map(p => p.claimed_by))];
          if (claimerIds.length > 0) {
            const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', claimerIds);
            if (profiles) {
              const nameMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
              mapped.forEach(p => { if (p.claimed_by) p.claimed_by_name = nameMap[p.claimed_by] || null; });
            }
          }
          setResults(mapped);
          setPhase("done");
        }
      });
      // Load sequences
      supabase.from('sequences').select('*').then(({ data, error }) => {
        console.log('Supabase sequences load:', data?.length || 0, 'rows', error?.message || 'OK');
        if (data && data.length > 0) {
          const seqMap = {};
          data.forEach(s => {
            seqMap[s.prospect_id] = {
              step: s.step,
              research: s.research,
              emails: s.emails || [],
              activeEmail: s.active_email || 0,
              notes: s.notes,
              refreshCount: s.refresh_count || 0,
              error: s.error_message,
              dbId: s.id,
            };
          });
          setSequences(seqMap);
        }
      });
    });
  }, [user]);
  const [enrichPhase, setEnrichPhase] = useState("idle");
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const logRef = useRef(null);

  const loadDemo = () => {
    const demoProspects = [
      { id: "demo-1", company: "MedVault Health", industry: "Healthcare", logoUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><path d="M50 8L12 30v35c0 18 16 30 38 30s38-12 38-30V30Z" fill="url(#g)"/><rect x="40" y="32" width="20" height="40" rx="3" fill="#fff"/><rect x="30" y="42" width="40" height="20" rx="3" fill="#fff"/></svg>'), size: 420, sizeSource: "LinkedIn", location: "Austin, TX", roles: ["Senior Backend Engineer", "DevOps Engineer"], source: "LinkedIn", posted: "2d ago", matchScore: 90, rawMatchScore: 92, rawNearshoreScore: 88, linkedinUrl: "https://linkedin.com/company/medvault", nearshoreScore: 88, nearshoreSignals: ["No existing offshore presence", "6 open dev roles unfilled 3+ weeks", "Non-tech healthcare company scaling fast"], recruiter: { name: "Sarah Chen", title: "Technical Recruiter", linkedinUrl: "https://linkedin.com/in/sarah-chen", photoUrl: "https://randomuser.me/api/portraits/women/44.jpg" }, connectionStatus: { status: "possible", connectionDegree: "2nd", details: "You and Sarah Chen both worked at companies in the Austin healthtech ecosystem", mutualConnections: ["David Kim - Engineering Lead at HealthStack"], sharedGroups: [] }, companyRelationship: "Shared Austin tech community", recruiterRelationship: "2nd degree via David Kim" },
      { id: "demo-2", company: "FreightWise Logistics", industry: "Logistics", size: 680, sizeSource: "Indeed", location: "Nashville, TN", roles: ["Full Stack Developer", "React Engineer"], source: "Indeed", posted: "5d ago", matchScore: 81, rawMatchScore: 85, rawNearshoreScore: 76, linkedinUrl: "", indeedUrl: "https://indeed.com/jobs?q=freightwise", nearshoreScore: 76, nearshoreSignals: ["Mid-size logistics firm", "2 dev roles open", "No mention of offshore teams"], recruiter: { name: "Marcus Johnson", title: "Hiring Manager", linkedinUrl: "https://linkedin.com/in/marcus-johnson" } },
      { id: "demo-3", company: "Apex Financial Group", industry: "Finance", size: 310, sizeSource: "LinkedIn", location: "Denver, CO", roles: ["Software Engineer", "Software Engineer", "Software Engineer", "Data Engineer", "Platform Engineer"], source: "Multiple", posted: "1d ago", matchScore: 93, rawMatchScore: 95, rawNearshoreScore: 91, linkedinUrl: "https://linkedin.com/company/apex-financial", ziprecruiterUrl: "https://ziprecruiter.com/c/apex-financial", nearshoreScore: 91, nearshoreSignals: ["Series C fintech, aggressive hiring", "8 engineering roles open", "High cost-of-living market with small eng team"], recruiter: { name: "Jessica Park", title: "VP of Engineering", linkedinUrl: "https://linkedin.com/in/jessica-park" } },
    ];
    setResults(demoProspects);
    setPhase("done");
    setSummary("DEMO MODE — 3 sample prospects loaded");
    setLogs([{ text: "Demo data loaded — click a prospect and try 'Start Sequence'", done: true }]);
    setSequences({});
  };

  const pushLog = useCallback((text, done = false) => {
    setLogs(prev => {
      const next = prev.map((l, i) => i === prev.length - 1 ? { ...l, done: true } : l);
      return [...next, { text, done }];
    });
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }, []);

  const finalizeLog = useCallback(() => {
    setLogs(prev => prev.map(l => ({ ...l, done: true })));
  }, []);

  const nextId = useRef(1);
  const scanAbort = useRef(null);
  const customScanMsg = useRef(null);

  const stopScan = () => {
    if (scanAbort.current) { scanAbort.current.abort(); scanAbort.current = null; }
    setPhase("idle"); setProgress(0); setSummary("");
  };


  const runScan = async () => {
    const controller = new AbortController();
    scanAbort.current = controller;
    setPhase("scanning"); setSummary(""); setLogs([]); setProgress(5); setSelected(null); setErrorMsg("");
    pushLog("Initializing search agent...");
    const token = await getToken?.();

    // Gradual ramp while waiting for first search result
    const rampTimer = setInterval(() => {
      setProgress(prev => prev < 18 ? prev + 2 : prev);
    }, 800);

    let userMsg;
    if (customScanMsg.current) {
      userMsg = customScanMsg.current;
      customScanMsg.current = null;
    } else if (clientsOnly) {
      // Randomly sample 15 clients to search
      const { BAIRESDEV_CLIENTS } = await import('./clients');
      const shuffled = [...BAIRESDEV_CLIENTS].sort(() => Math.random() - 0.5).slice(0, 15);
      userMsg = `Search for these specific companies and check if they are currently hiring software developers or engineers: ${shuffled.join(", ")}. Return any that have active developer job postings. Return only JSON.`;
    } else {
      const sizeRange = `${scanMinSize.toLocaleString()}–${scanMaxSize.toLocaleString()}`;
      const industryFocus = selectedIndustries.length > 0 ? ` Focus on these industries: ${selectedIndustries.join(", ")}.` : ' Focus on non-tech industries.';
      userMsg = `Search Indeed, LinkedIn Jobs, ZipRecruiter, BuiltIn, and Dice for companies actively hiring software developers or engineers right now. Company headcount must be ${sizeRange} employees.${industryFocus} Return only JSON.`;
    }

    try {
      let searchCount = 0;
      const raw = await runAgentLoop(userMsg, (query) => {
        searchCount++;
        clearInterval(rampTimer);
        setProgress(Math.min(20 + searchCount * 6, 85));
        pushLog(query);
      }, controller.signal, token);

      clearInterval(rampTimer);
      setProgress(90);
      pushLog("Parsing and scoring results...");

      let parsed;
      try {
        parsed = parseAgentJSON(raw);
      } catch (parseErr) {
        // Show raw for debugging
        console.error("Raw response:", raw);
        throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 200)}`);
      }

      console.log("Parsed result:", JSON.stringify(parsed).slice(0, 500));
      const allProspects = parsed.prospects || [];
      if (allProspects.length === 0) {
        throw new Error("Scan returned 0 prospects — try a more specific focus query.");
      }
      console.log(`Parsed ${allProspects.length} prospects:`,
        allProspects.map(p => `${p.company}: recruiter=${p.recruiter?.name || "NONE"}`));
      const newProspects = allProspects.map(p => {
          const ms = p.matchScore || 0;
          const ns = p.nearshoreScore || 0;
          const combined = Math.round((ms + ns) / 2);
          const existingClient = isExistingClient(p.company);
          return { ...p, id: nextId.current++, matchScore: combined, rawMatchScore: ms, rawNearshoreScore: ns, isExistingClient: existingClient, isNew: true };
        });

      // Merge with existing results, deduplicating by company name (case-insensitive)
      setResults(prev => {
        const existing = new Map(prev.map(r => [r.company.toLowerCase(), r]));
        for (const p of newProspects) {
          const key = p.company.toLowerCase();
          if (existing.has(key)) {
            // Update existing entry with fresher data but keep the original id
            const old = existing.get(key);
            existing.set(key, { ...old, ...p, id: old.id });
          } else {
            existing.set(key, p);
          }
        }
        return [...existing.values()];
      });

      const newCount = newProspects.length;

      // Apollo enrichment: find verified emails for each prospect
      pushLog("Finding verified emails via Apollo...");
      setProgress(92);
      const apolloUrl = `${API_URL}/api/apollo`;
      const authHeaders = {};
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      for (let i = 0; i < newProspects.length; i++) {
        const p = newProspects[i];
        try {
          let recruiterData = null;

          if (p.recruiter?.name && p.recruiter.name.length > 2) {
            // We have a name — enrich to get verified email
            const nameParts = p.recruiter.name.trim().split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';
            const domain = p.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';

            const enrichRes = await fetch(apolloUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ action: 'enrich', firstName, lastName, company: p.company, domain, linkedinUrl: p.recruiter.linkedinUrl }),
            });
            if (enrichRes.ok) {
              recruiterData = await enrichRes.json();
            }
          } else {
            // No recruiter name — search Apollo for one
            const searchRes = await fetch(apolloUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ action: 'search', company: p.company }),
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.contacts?.length > 0) {
                const contact = searchData.contacts[0];
                // Found a recruiter — now enrich for email
                const enrichRes = await fetch(apolloUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify({ action: 'enrich', firstName: contact.firstName, lastName: contact.lastName, company: p.company, linkedinUrl: contact.linkedinUrl, apolloId: contact.apolloId }),
                });
                if (enrichRes.ok) {
                  recruiterData = await enrichRes.json();
                  // Also update the recruiter name/title since we found one
                  if (!p.recruiter) p.recruiter = {};
                  p.recruiter.name = contact.name;
                  p.recruiter.title = contact.title;
                  p.recruiter.linkedinUrl = contact.linkedinUrl;
                }
              }
            }
          }

          // Apply Apollo data
          if (recruiterData?.email) {
            if (!p.recruiter) p.recruiter = {};
            p.recruiter.email = recruiterData.email;
            p.recruiter.emailVerified = recruiterData.emailStatus === 'verified';
            if (recruiterData.photoUrl) p.recruiter.photoUrl = recruiterData.photoUrl;
            if (recruiterData.linkedinUrl && !p.recruiter.linkedinUrl) p.recruiter.linkedinUrl = recruiterData.linkedinUrl;
            pushLog(`✓ ${p.company}: ${recruiterData.email}`);
          } else {
            pushLog(`– ${p.company}: no verified email found`);
          }
        } catch (apolloErr) {
          console.error(`Apollo error for ${p.company}:`, apolloErr);
        }
        setProgress(92 + Math.round((i + 1) / newProspects.length * 6));
      }

      // Cross-reference with LinkedIn connections
      try {
        const stored = localStorage.getItem('ds_linkedin_connections');
        if (stored) {
          const linkedinConns = JSON.parse(stored);
          for (const p of newProspects) {
            const companyLower = p.company.toLowerCase();
            const matches = linkedinConns.filter(c => c.company && companyLower.includes(c.company.toLowerCase()) || c.company && c.company.toLowerCase().includes(companyLower));
            if (matches.length > 0) {
              p.connectionStatus = {
                status: "likely",
                connectionDegree: "1st",
                details: `You have ${matches.length} connection${matches.length > 1 ? 's' : ''} at ${p.company}`,
                mutualConnections: matches.slice(0, 3).map(m => `${m.name} - ${m.position || 'Unknown role'}`),
                sharedGroups: [],
              };
              p.companyRelationship = `${matches.length} direct connection${matches.length > 1 ? 's' : ''}`;
              // Check if recruiter is a direct connection
              if (p.recruiter?.name) {
                const recruiterMatch = matches.find(m => m.name.toLowerCase() === p.recruiter.name.toLowerCase());
                if (recruiterMatch) {
                  p.recruiterRelationship = "1st degree connection";
                  if (recruiterMatch.email && !p.recruiter.email) p.recruiter.email = recruiterMatch.email;
                }
              }
              pushLog(`\u2713 ${p.company}: ${matches.length} LinkedIn connection${matches.length > 1 ? 's' : ''}`);
            }
          }
        }
      } catch (connErr) { console.error('LinkedIn cross-ref error:', connErr); }

      // Update results with Apollo + LinkedIn data
      setResults(prev => {
        const existing = new Map(prev.map(r => [r.company.toLowerCase(), r]));
        for (const p of newProspects) {
          const key = p.company.toLowerCase();
          existing.set(key, existing.has(key) ? { ...existing.get(key), recruiter: p.recruiter, connectionStatus: p.connectionStatus || existing.get(key)?.connectionStatus, companyRelationship: p.companyRelationship || existing.get(key)?.companyRelationship, recruiterRelationship: p.recruiterRelationship || existing.get(key)?.recruiterRelationship } : p);
        }
        return [...existing.values()];
      });

      // Save to Supabase
      try {
        const { supabase } = await import('./supabaseClient');
        if (supabase && user?.id !== 'local') {
          for (const p of newProspects) {
            await supabase.from('prospects').upsert({
              company: p.company,
              industry: p.industry,
              size: p.size,
              size_source: p.sizeSource,
              location: p.location,
              roles: p.roles || [],
              source: p.source,
              posted: p.posted,
              match_score: p.matchScore,
              raw_match_score: p.rawMatchScore,
              raw_nearshore_score: p.rawNearshoreScore,
              nearshore_score: p.nearshoreScore,
              nearshore_signals: p.nearshoreSignals || [],
              notes: p.notes || '',
              linkedin_url: p.linkedinUrl,
              indeed_url: p.indeedUrl,
              ziprecruiter_url: p.ziprecruiterUrl,
              builtin_url: p.builtinUrl,
              dice_url: p.diceUrl,
              recruiter_name: p.recruiter?.name,
              recruiter_title: p.recruiter?.title,
              recruiter_email: p.recruiter?.email,
              recruiter_linkedin_url: p.recruiter?.linkedinUrl,
              connection_status: p.connectionStatus || {},
              company_relationship: p.companyRelationship,
              recruiter_relationship: p.recruiterRelationship,
              scanned_by: user.id,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'company_lower' });
          }
        }
      } catch (dbErr) {
        console.error('Supabase save error:', dbErr);
      }

      setProgress(100);
      pushLog(`Scan complete — ${newCount} new prospects found.`, true);
      finalizeLog();
      setSummary(parsed.searchSummary || "");
      setPhase("done");

      // Phase 2: LinkedIn cross-reference (only if user provided LinkedIn info)
      // Wait 60s to avoid rate limits after scan
      const resolvedName = userName || extractNameFromLinkedIn(linkedinUrl);
      if (linkedinUrl || resolvedName) {
        await new Promise(r => setTimeout(r, 60000));
        setEnrichPhase("enriching");
        setEnrichProgress(10);
        pushLog("Starting LinkedIn cross-reference...");

        try {
          let enrichSearchCount = 0;
          const enrichRaw = await runEnrichLoop(
            newProspects.slice(0, 6),
            linkedinUrl,
            resolvedName,
            (query) => {
              enrichSearchCount++;
              setEnrichProgress(Math.min(10 + enrichSearchCount * 8, 90));
              pushLog(query);
            },
            token
          );

          const enrichParsed = parseAgentJSON(enrichRaw);

          setResults(prev => prev.map(r => {
            const enrichment = (enrichParsed.enrichments || [])
              .find(e => e.company.toLowerCase() === r.company.toLowerCase());
            return enrichment ? { ...r, connectionStatus: enrichment.connectionStatus, companyRelationship: enrichment.companyRelationship, recruiterRelationship: enrichment.recruiterRelationship } : r;
          }));

          setEnrichProgress(100);
          pushLog("Cross-reference complete.", true);
          finalizeLog();
          setEnrichPhase("done");
        } catch (enrichErr) {
          console.error("Enrichment error:", enrichErr);
          pushLog("Cross-reference failed: " + enrichErr.message, true);
          finalizeLog();
          setEnrichPhase("error");
          // Phase 1 results are still valid
        }
      }

    } catch (err) {
      clearInterval(rampTimer);
      if (err.name === "AbortError") { scanAbort.current = null; return; }
      console.error(err);
      const friendly = err.message.includes("rate limit") ? "Rate limit reached — please wait 1 minute before scanning again."
        : err.message.includes("credit balance") ? "API credits depleted — please add credits at console.anthropic.com."
        : err.message.includes("Could not parse JSON") ? "Scan returned unexpected format — try again or use a more specific focus query."
        : err.message;
      setErrorMsg(friendly);
      pushLog("Error: " + friendly, true);
      finalizeLog();
      setPhase("error");
    }
  };

  const filtered = useMemo(() => results.filter(r => {
    if (filters.source !== "All" && r.source !== filters.source) return false;
    if (filters.industry !== "All" && r.industry !== filters.industry) return false;
    if ((r.size || 0) < filters.minSize || (r.size || 9999) > filters.maxSize) return false;
    if ((r.matchScore || 0) < filters.minMatch) return false;
    return true;
  }).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)), [results, filters]);

  const activeSequenceCount = useMemo(() => Object.values(sequences).filter(s => s.step !== "idle").length, [sequences]);

  const startSequence = async (prospect) => {
    const id = prospect.id;
    if (sequences[id]?.step === "researching") return;
    // Use pre-built demo data for demo prospects
    if (DEMO_SEQUENCES[id]) {
      setSequences(prev => ({ ...prev, [id]: { ...DEMO_SEQUENCES[id], refreshCount: prev[id]?.refreshCount || 0 } }));
      return;
    }
    setSequences(prev => ({ ...prev, [id]: { step: "researching", research: "", emails: [], activeEmail: 0, notes: prev[id]?.notes || "", refreshCount: prev[id]?.refreshCount || 0 } }));
    try {
      const seqToken = await getToken?.();
      const raw = await runSequenceAgent(prospect, linkedinUrl, userName || extractNameFromLinkedIn(linkedinUrl), seqToken);
      const parsed = parseAgentJSON(raw);
      setSequences(prev => ({ ...prev, [id]: { ...prev[id], step: "ready", research: parsed.research || "", emails: parsed.emails || [], refreshCount: prev[id]?.refreshCount || 0 } }));
      // Save sequence to Supabase
      try {
        const { supabase } = await import('./supabaseClient');
        if (supabase && user?.id !== 'local' && prospect.dbId) {
          await supabase.from('sequences').upsert({
            prospect_id: prospect.dbId,
            user_id: user.id,
            step: 'ready',
            research: parsed.research || '',
            emails: parsed.emails || [],
          }, { onConflict: 'prospect_id' });
          // Claim the prospect
          await supabase.from('prospects').update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq('id', prospect.dbId).is('claimed_by', null);
        }
        // Update local state with claim
        setResults(prev => prev.map(r => r.id === id ? { ...r, claimed_by: user.id, claimed_by_name: user.user_metadata?.full_name || user.email } : r));
      } catch (dbErr) { console.error('Supabase sequence save error:', dbErr); }
    } catch (err) {
      console.error("Sequence error:", err);
      const friendly = err.message.includes("rate limit") ? "Rate limit — wait 1 minute and try again."
        : err.message.includes("credit balance") ? "API credits depleted."
        : err.message.includes("Failed to fetch") ? "Backend not running — start the server with 'node server.js'."
        : "Sequence failed: " + err.message.slice(0, 100);
      setSequences(prev => ({ ...prev, [id]: { ...prev[id], step: "error", error: friendly } }));
    }
  };

  const handleStageChange = async (prospectId, newStage) => {
    setResults(prev => prev.map(r => r.id === prospectId ? { ...r, pipelineStage: newStage } : r));
    // Persist to Supabase
    try {
      const { supabase } = await import('./supabaseClient');
      const prospect = results.find(r => r.id === prospectId);
      if (supabase && user?.id !== 'local' && prospect?.dbId) {
        await supabase.from('prospects').update({ pipeline_stage: newStage, updated_at: new Date().toISOString() }).eq('id', prospect.dbId);
      }
    } catch (err) { console.error('Stage update error:', err); }
  };

  const exportCSV = () => {
    const rows = ["Company,Industry,Size,Location,Source,Match Score,Nearshore Score,Nearshore Signals,Roles,Recruiter Name,Recruiter Title,Recruiter LinkedIn,Connection Status,Company Relationship,Recruiter Relationship,Sequence Status,Notes",
      ...filtered.map(r => `"${r.company}","${r.industry || ""}",${r.size || ""},"${r.location || ""}","${r.source || ""}",${r.matchScore || ""},${r.nearshoreScore ?? ""},"${(r.nearshoreSignals || []).join("; ")}","${(r.roles || []).join("; ")}","${r.recruiter?.name || ""}","${r.recruiter?.title || ""}","${r.recruiter?.linkedinUrl || ""}","${r.connectionStatus?.status || ""}","${r.companyRelationship || ""}","${r.recruiterRelationship || ""}","${sequences[r.id]?.step || "none"}","${r.notes || ""}"`)
    ].join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(rows); a.download = "devscout-prospects.csv"; a.click();
  };

  return (
    <div className="ds-root" style={{ minHeight: "100%", background: "#f8fafc", color: "#0f172a", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.svg" alt="DevScout" style={{ width: 38, height: 38 }} />
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>DevScout</div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.12em" }}>AI-POWERED PROSPECTING</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span className="ds-hide-mobile" style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em" }}>INDEED · LINKEDIN · ZIPRECRUITER · BUILTIN · DICE</span>
          {activeSequenceCount > 0 && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b" }}><span style={{ color: "#3b82f6", fontWeight: 700 }}>{activeSequenceCount}</span> prospecting</span>}
          {phase === "done" && (results.length > 0 && results[0].id?.toString().startsWith("demo")
            ? <span style={{ fontSize: 11, color: "#8b5cf6", fontFamily: "monospace" }}>● DEMO DATA</span>
            : <span style={{ fontSize: 11, color: "#16a34a", fontFamily: "monospace" }}>● LIVE DATA</span>
          )}
        </div>
      </div>

      <div className="ds-layout" style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div className="ds-sidebar" style={{ width: 264, borderRight: "1px solid #f1f5f9", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 20, flexShrink: 0, background: "#ffffff", position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>TARGET</span>
              {(selectedIndustries.length > 0 || clientsOnly) && <button onClick={() => { setSelectedIndustries([]); setClientsOnly(false); }} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 10, cursor: "pointer", fontFamily: "monospace", padding: 0 }}>Clear</button>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <button onClick={() => { setClientsOnly(!clientsOnly); if (!clientsOnly) setSelectedIndustries([]); }}
                style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${clientsOnly ? "#d97706" : "#e2e8f0"}`, background: clientsOnly ? "#fffbeb" : "#fff", color: clientsOnly ? "#d97706" : "#94a3b8", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: clientsOnly ? 600 : 400, transition: "all 0.15s" }}>
                Previous Clients
              </button>
              {!clientsOnly && ["Healthcare", "Finance", "Insurance", "Manufacturing", "Retail", "Logistics", "Education", "Real Estate", "Energy", "Aerospace", "Automotive", "Food & Bev", "Hospitality", "Media", "Telecom", "Agriculture", "Construction", "Government", "Pharma", "FinTech"].map(ind => {
                const checked = selectedIndustries.includes(ind);
                return (
                  <button key={ind} onClick={() => setSelectedIndustries(prev => checked ? prev.filter(i => i !== ind) : [...prev, ind])}
                    style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${checked ? "#6366f1" : "#e2e8f0"}`, background: checked ? "#eef2ff" : "#fff", color: checked ? "#6366f1" : "#94a3b8", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: checked ? 600 : 400, transition: "all 0.15s" }}>
                    {ind}
                  </button>
                );
              })}
            </div>
          </div>

          {phase === "scanning" ? (
            <button onClick={stopScan}
              style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "#ef4444", color: "white", fontFamily: "monospace", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              ■ STOP SCAN
            </button>
          ) : (
            <button className="ds-btn" onClick={runScan} disabled={enrichPhase === "enriching"}
              style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", cursor: enrichPhase === "enriching" ? "not-allowed" : "pointer", background: enrichPhase === "enriching" ? "#cbd5e1" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", fontFamily: "monospace", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: enrichPhase === "enriching" ? 0.6 : 1, transition: "all 0.2s" }}>
              ⚡ SCAN FOR PROSPECTS
            </button>
          )}

          {phase === "idle" && (
            <>
              <button onClick={loadDemo}
                style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", background: "#ffffff", color: "#64748b", fontFamily: "monospace", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em" }}>
                ▶&nbsp;&nbsp;LOAD DEMO DATA
              </button>
            </>
          )}

          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>MAX EMPLOYEES</span><span style={{ color: "#3b82f6" }}>100–{scanMaxSize.toLocaleString()}</span>
            </div>
            <input type="range" min={100} max={15000} step={100} value={scanMaxSize} onChange={e => setScanMaxSize(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
          </div>

          {phase === "scanning" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em" }}>PROGRESS</span>
                <span style={{ fontSize: 10, color: "#3b82f6", fontFamily: "monospace" }}>{progress}%</span>
              </div>
              <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2 }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", borderRadius: 2, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div ref={logRef} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, maxHeight: 200, overflowY: "auto", fontFamily: "monospace", fontSize: 11 }}>
              {logs.map((l, i) => (
                <div key={i} style={{ color: l.done ? "#16a34a" : "#94a3b8", lineHeight: 1.9 }}>
                  {l.done ? "✓ " : "▶ "}{l.text}
                </div>
              ))}
            </div>
          )}

          {enrichPhase === "enriching" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em" }}>CROSS-REFERENCE</span>
                <span style={{ fontSize: 10, color: "#7c3aed", fontFamily: "monospace" }}>{enrichProgress}%</span>
              </div>
              <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2 }}>
                <div style={{ width: `${enrichProgress}%`, height: "100%", background: "linear-gradient(90deg,#8b5cf6,#ec4899)", borderRadius: 2, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
              </div>
            </div>
          )}

        </div>

        {/* Main panel */}
        <div className="ds-main" style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

          {phase === "idle" && results.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80%", gap: 14, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e2e8f0", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#334155" }}>Ready to Scout</div>
              <div style={{ fontSize: 13, color: "#64748b", maxWidth: 360, lineHeight: 1.7 }}>
                Searches <span style={{ color: "#2557a7" }}>Indeed</span> + <span style={{ color: "#0a66c2" }}>LinkedIn</span> + <span style={{ color: "#00a960" }}>ZipRecruiter</span> + <span style={{ color: "#f26522" }}>BuiltIn</span> + <span style={{ color: "#eb1c26" }}>Dice</span> in real time,<br />
                verifies headcount, scores every company for outreach fit, and automates sequence.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {["100–10,000 employees", "Live job data", "AI-scored"].map(t => (
                  <span key={t} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: "1px solid #cbd5e1", color: "#64748b", fontFamily: "monospace" }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {phase === "error" && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 20, color: "#dc2626", fontFamily: "monospace", fontSize: 12, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ Scan failed</div>
              <div style={{ wordBreak: "break-word" }}>{errorMsg}</div>
            </div>
          )}

          {filtered.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  {summary && <div style={{ fontSize: 12, color: "#94a3b8" }}>{summary}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#6366f1", fontWeight: 700 }}>{filtered.length} found</span>
                  {/* View toggle */}
                  <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                    <button onClick={() => setViewMode("list")}
                      style={{ padding: "6px 10px", border: "none", background: viewMode === "list" ? "#eef2ff" : "#fff", color: viewMode === "list" ? "#6366f1" : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <button onClick={() => setViewMode("pipeline")}
                      style={{ padding: "6px 10px", border: "none", borderLeft: "1px solid #e2e8f0", background: viewMode === "pipeline" ? "#eef2ff" : "#fff", color: viewMode === "pipeline" ? "#6366f1" : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>
                    </button>
                  </div>
                  <button onClick={exportCSV} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>↓ Export CSV</button>
                </div>
              </div>

              {viewMode === "pipeline" ? (
                <Pipeline results={filtered} sequences={sequences} onStageChange={handleStageChange} onSelectProspect={r => setSelected(selected?.id === r.id ? null : r)} />
              ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map(r => {
                  const isOpen = selected?.id === r.id;
                  const seq = sequences[r.id];
                  const seqStep = seq?.step;
                  const isActive = seqStep && seqStep !== "idle";
                  const initials = r.company.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                  const hue = (r.company.charCodeAt(0) * 37 + (r.company.charCodeAt(1) || 0) * 13) % 360;
                  const lc = `hsl(${hue},50%,45%)`;

                  return (
                    <div key={r.id} onClick={() => setSelected(isOpen ? null : r)}
                      className="ds-card" style={{ background: "#ffffff", border: `1px solid ${isOpen ? "#3b82f6" : "#e2e8f0"}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s", position: "relative", boxShadow: `${isActive ? `inset 3px 0 0 ${ACCENT_COLORS[seqStep] || DEFAULT_ACCENT}, ` : ""}${isOpen ? "0 1px 8px rgba(59,130,246,0.08)" : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"}` }}>
                      <span className="ds-show-mobile" style={{ display: "none", position: "absolute", top: 12, right: 14, fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: (r.matchScore || 0) >= 85 ? "#16a34a" : (r.matchScore || 0) >= 70 ? "#d97706" : "#94a3b8" }}>{r.matchScore || 0}%</span>

                      <div className="ds-card-row" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <div className="ds-hide-mobile" style={{ width: 42, height: 42, borderRadius: 9, background: lc + "18", border: `1px solid ${lc}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: lc, fontFamily: "monospace", flexShrink: 0, overflow: "hidden", position: "relative" }}>
                          {initials}
                          <img
                            src={r.logoUrl || `https://logo.clearbit.com/${r.company.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)[0]}.com`}
                            alt=""
                            style={{ width: 42, height: 42, objectFit: "contain", position: "absolute", background: "#fff", padding: 4, borderRadius: 9 }}
                            onError={e => {
                              const tries = parseInt(e.target.dataset.tried || "0");
                              const words = r.company.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => !["inc", "llc", "corp", "co", "group", "the", "and"].includes(w));
                              if (tries === 0) {
                                e.target.dataset.tried = "1";
                                e.target.src = `https://logo.clearbit.com/${words.join("")}.com`;
                              } else if (tries === 1 && words.length > 1) {
                                e.target.dataset.tried = "2";
                                e.target.src = `https://logo.clearbit.com/${words.slice(0,2).join("")}.com`;
                              } else { e.target.style.display = "none"; }
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{r.company}</span>
                            {r.isExistingClient && <Tag color="#d97706">EXISTING CLIENT</Tag>}
                            {r.isNew && <Tag color="#16a34a">NEW</Tag>}
                            <Tag color={sourceColors[r.source] || "#64748b"}>{r.source || "—"}</Tag>
                            {r.connectionStatus && r.connectionStatus.status !== "none" && r.connectionStatus.connectionDegree && r.connectionStatus.connectionDegree !== "unknown" && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#0a66c2", marginLeft: 4 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2"><path d="M20.47 2H3.53A1.45 1.45 0 002 3.47v17.06A1.45 1.45 0 003.53 22h16.94A1.45 1.45 0 0022 20.53V3.47A1.45 1.45 0 0020.47 2zM8.09 18.74h-3v-9h3v9zM6.59 8.48a1.56 1.56 0 110-3.12 1.56 1.56 0 010 3.12zm12.32 10.26h-3v-4.83c0-1.21-.43-2-1.52-2A1.65 1.65 0 0012.85 13a2 2 0 00-.1.73v5h-3v-9h3v1.2a3 3 0 012.71-1.5c2 0 3.45 1.29 3.45 4.06v5.25z"/></svg>
                                · {r.connectionStatus.connectionDegree}
                              </span>
                            )}
                            {r.posted && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{r.posted}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                            {r.location && <span>{r.location}</span>}
                            {r.industry && <span>{INDUSTRY_ICONS[r.industry] || "🏢"} {r.industry}</span>}
                            {r.size && <span>{r.size.toLocaleString()} employees</span>}
                          </div>
                          {(r.roles || []).length > 0 && (() => {
                            const grouped = (r.roles || []).reduce((acc, role) => { acc[role] = (acc[role] || 0) + 1; return acc; }, {});
                            return (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Open Developer Roles</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {Object.entries(grouped).map(([role, count]) => (
                                  <div key={role} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />{role}{count > 1 ? ` (${count})` : ""}
                                  </div>
                                ))}
                              </div>
                            </div>
                            );
                          })()}
                          {(!seq || seqStep === "idle" || seqStep === "error") && (() => {
                            const claimedByOther = r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local';
                            return (
                              <div style={{ marginTop: 14 }}>
                                {r.isExistingClient ? (
                                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#d97706", padding: "6px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, display: "inline-block" }}>
                                    Existing BairesDev Client — upsell opportunity
                                  </span>
                                ) : claimedByOther ? (
                                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6366f1", padding: "6px 12px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 6, display: "inline-block" }}>
                                    Assigned to {r.claimed_by_name || 'another user'}
                                  </span>
                                ) : (
                                  <button className="ds-btn" onClick={e => { e.stopPropagation(); startSequence(r); setSelected(r); handleStageChange(r.id, "prospecting"); }}
                                    style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", fontSize: 12, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                    ▶ Start Sequence
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="ds-hide-mobile" style={{ width: 150, flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontFamily: "monospace", cursor: "default" }} title="Match Score based on number of open dev roles, company growth, company size fit, industry, hiring urgency and propensity to nearshore, based on public information.">MATCH SCORE</div>
                          <MatchBar value={r.matchScore || 0} />
                        </div>
                        {seqStep === "ready" && <span style={{ ...BADGE_BASE, ...STEP_COLORS.ready, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animation: "pulse 2s ease-in-out infinite" }} />PROSPECTING</span>}
                        {seqStep === "sent" && <span style={{ ...BADGE_BASE, ...STEP_COLORS.sent }}>SENT</span>}
                        {seqStep === "replied" && <span style={{ ...BADGE_BASE, ...STEP_COLORS.replied }}>REPLIED</span>}
                        {seqStep === "researching" && <span style={{ ...BADGE_BASE, ...STEP_COLORS.researching, display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #bfdbfe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />RESEARCHING</span>}
                        {!seqStep && r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local' && (
                          <span style={{ ...BADGE_BASE, fontSize: 9, padding: "3px 8px", background: "#eef2ff", color: "#6366f1", border: "1px solid #c7d2fe" }}>
                            {r.claimed_by_name || 'Assigned'}
                          </span>
                        )}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                        <button onClick={e => {
                            e.stopPropagation();
                            const claimedByOther = r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local';
                            if (claimedByOther) return;
                            const mySeq = sequences[r.id];
                            const isClaimed = mySeq && mySeq.step !== "idle";
                            const msg = isClaimed ? "This prospect has an active sequence. Delete anyway?" : `Delete ${r.company}?`;
                            if (!confirm(msg)) return;
                            setResults(prev => prev.filter(p => p.id !== r.id));
                            setSequences(prev => { const next = { ...prev }; delete next[r.id]; return next; });
                            if (selected?.id === r.id) setSelected(null);
                          }}
                          title={r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local' ? `Claimed by ${r.claimed_by_name || 'another user'}` : "Remove prospect"}
                          style={{ padding: 4, borderRadius: 4, border: "none", background: "transparent", cursor: r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local' ? "not-allowed" : "pointer", color: r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local' ? "#e2e8f0" : "#cbd5e1", display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.15s", opacity: r.claimed_by && r.claimed_by !== user?.id && r.claimed_by !== 'local' ? 0.3 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                          onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                        </button>
                      </div>

                      {isOpen && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                          {r.notes && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, fontStyle: "italic" }}>{r.notes}</div>}

                          {/* Hiring Contact */}
                          {r.recruiter?.name && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>HIRING CONTACT</div>
                              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#475569", fontWeight: 600, flexShrink: 0, overflow: "hidden", position: "relative" }}>
                                  {r.recruiter.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                                  {r.recruiter.photoUrl && <img src={r.recruiter.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", position: "absolute", top: 0, left: 0 }} onError={e => { e.target.style.display = "none"; }} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{r.recruiter.name}</div>
                                  {r.recruiter.title && <div style={{ fontSize: 11, color: "#64748b" }}>{r.recruiter.title}</div>}
                                  {r.recruiter.email && <div style={{ fontSize: 11, color: "#3b82f6", fontFamily: "monospace" }}>{r.recruiter.email}</div>}
                                </div>
                                {r.recruiter.linkedinUrl && (
                                  <a href={r.recruiter.linkedinUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                    style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #bfdbfe", color: "#0a66c2", fontSize: 11, textDecoration: "none", fontFamily: "monospace" }}>
                                    Profile →
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Connection Status */}
                          {r.connectionStatus && r.connectionStatus.status !== "none" && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>CONNECTION STATUS</div>
                              <div style={{
                                background: r.connectionStatus.status === "likely" ? "#f0fdf4" : r.connectionStatus.status === "possible" ? "#fffbeb" : "#f8fafc",
                                border: `1px solid ${r.connectionStatus.status === "likely" ? "#bbf7d0" : r.connectionStatus.status === "possible" ? "#fde68a" : "#e2e8f0"}`,
                                borderRadius: 8, padding: "12px 16px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2" style={{ flexShrink: 0 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>
                                    {r.connectionStatus.status === "likely" ? "Likely Connection" : r.connectionStatus.status === "possible" ? "Possible Connection" : r.connectionStatus.status}
                                  </span>
                                  {r.connectionStatus.connectionDegree && r.connectionStatus.connectionDegree !== "unknown" && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: r.connectionStatus.connectionDegree === "1st" ? "#dcfce7" : r.connectionStatus.connectionDegree === "2nd" ? "#fef3c7" : "#f1f5f9", color: r.connectionStatus.connectionDegree === "1st" ? "#16a34a" : r.connectionStatus.connectionDegree === "2nd" ? "#d97706" : "#64748b", fontFamily: "monospace" }}>
                                      {r.connectionStatus.connectionDegree}
                                    </span>
                                  )}
                                </div>
                                {r.companyRelationship && r.companyRelationship !== "No known relationship" && (
                                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 4 }}><span style={{ fontWeight: 600, color: "#334155" }}>Company:</span> {r.companyRelationship}</div>
                                )}
                                {r.recruiterRelationship && r.recruiterRelationship !== "No known connection" && (
                                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 4 }}><span style={{ fontWeight: 600, color: "#334155" }}>Recruiter:</span> {r.recruiterRelationship}</div>
                                )}
                                {r.connectionStatus.details && <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{r.connectionStatus.details}</div>}
                                {(r.connectionStatus.mutualConnections || []).length > 0 && (
                                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontFamily: "monospace" }}>Mutual: {r.connectionStatus.mutualConnections.join(", ")}</div>
                                )}
                                {(r.connectionStatus.sharedGroups || []).length > 0 && (
                                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>Groups: {r.connectionStatus.sharedGroups.join(", ")}</div>
                                )}
                              </div>
                            </div>
                          )}


                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {seqStep === "researching" && (
                              <button disabled style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", fontSize: 12, cursor: "not-allowed", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #cbd5e1", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Preparing...
                              </button>
                            )}
                            {seqStep === "error" && (
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#dc2626", fontFamily: "monospace", flex: 1 }}>
                                  ⚠ {seq.error}
                                </div>
                                <button onClick={e => { e.stopPropagation(); startSequence(r); }}
                                  style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  ↻ Retry
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Sequence Panel */}
                          {isActive && seqStep !== "researching" && isOpen && (
                            <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                              {/* Research Brief */}
                              {seq.research && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>RESEARCH BRIEF</div>
                                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                                    {seq.research.replace(/<cite[^>]*>/gi, '').replace(/<\/cite>/gi, '')}
                                  </div>
                                </div>
                              )}

                              {/* Email Tabs */}
                              {(seq.emails || []).length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>OUTREACH SEQUENCE</div>
                                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                    {seq.emails.map((em, idx) => (
                                      <button key={idx} onClick={e => { e.stopPropagation(); setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], activeEmail: idx } })); }}
                                        style={{ padding: "6px 12px", borderRadius: 5, border: `1px solid ${(seq.activeEmail || 0) === idx ? "#3b82f6" : "#e2e8f0"}`, background: (seq.activeEmail || 0) === idx ? "#eff6ff" : "#ffffff", color: (seq.activeEmail || 0) === idx ? "#3b82f6" : "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                        {em.type === "intro" ? "Intro" : em.type === "follow-up-1" ? "Follow-up 1" : "Follow-up 2"}
                                      </button>
                                    ))}
                                  </div>
                                  {(() => {
                                    const em = seq.emails[seq.activeEmail || 0];
                                    if (!em) return null;
                                    return (
                                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Subject: {em.subject}</div>
                                        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                                          {em.body.replace(/<cite[^>]*>/gi, '').replace(/<\/cite>/gi, '').split(/\n\n+/).map((para, pi) => <p key={pi} style={{ margin: "0 0 10px 0" }}>{para}</p>)}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                          <button onClick={e => {
                                              e.stopPropagation();
                                              const to = r.recruiter?.email || "";
                                              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}`;
                                              window.open(gmailUrl, "_blank");
                                            }}
                                            style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
                                            <svg width="16" height="12" viewBox="0 0 48 36" fill="none"><path d="M6 0h36c3.3 0 6 2.7 6 6v24c0 3.3-2.7 6-6 6H6c-3.3 0-6-2.7-6-6V6c0-3.3 2.7-6 6-6z" fill="#F1F3F4"/><path d="M2 6l22 15L46 6" stroke="#EA4335" strokeWidth="2" fill="none"/><path d="M0 6v24c0 3.3 2.7 6 6 6h4V12L0 6z" fill="#4285F4"/><path d="M48 6v24c0 3.3-2.7 6-6 6h-4V12l10-6z" fill="#34A853"/><path d="M10 36V12L24 21 38 12v24" fill="#C5221F" opacity="0.05"/><path d="M0 6l10 6 14 9 14-9 10-6" fill="none"/><path d="M0 6l24 15L48 6" stroke="#EA4335" strokeWidth="0" fill="none"/><rect x="10" y="0" width="28" height="12" rx="0" fill="#C5221F" opacity="0.9"/><path d="M10 12L0 6c0-3.3 2.7-6 6-6h4v12z" fill="#F14336"/><path d="M38 12l10-6c0-3.3-2.7-6-6-6h-4v12z" fill="#FBBC05"/><path d="M10 12l14 9 14-9" fill="#C5221F"/></svg>
                                            Draft in Gmail
                                          </button>
                                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`); setCopiedId(r.id); setTimeout(() => setCopiedId(null), 2000); }}
                                            style={{ padding: "6px 12px", borderRadius: 5, border: `1px solid ${copiedId === r.id ? "#bbf7d0" : "#e2e8f0"}`, background: copiedId === r.id ? "#f0fdf4" : "#ffffff", color: copiedId === r.id ? "#16a34a" : "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
                                            {copiedId === r.id ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>} {copiedId === r.id ? "Copied!" : "Copy Email"}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Status Actions */}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {seqStep === "ready" && (
                                  <button onClick={async e => {
                                      e.stopPropagation();
                                      setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], step: "sent" } }));
                                      handleStageChange(r.id, "contacted");
                                      try {
                                        const { supabase } = await import('./supabaseClient');
                                        if (supabase && user?.id !== 'local') {
                                          const activeIdx = sequences[r.id]?.activeEmail || 0;
                                          const emailType = sequences[r.id]?.emails?.[activeIdx]?.type || 'intro';
                                          await supabase.from('outreach_events').insert({ user_id: user.id, prospect_id: r.dbId || null, event_type: 'sent', email_type: emailType });
                                          if (sequences[r.id]?.dbId) {
                                            await supabase.from('sequences').update({ step: 'sent', updated_at: new Date().toISOString() }).eq('id', sequences[r.id].dbId);
                                          }
                                        }
                                      } catch (err) { console.error('Outreach event error:', err); }
                                    }}
                                    style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
                                    Mark Sent
                                  </button>
                                )}
                                {seqStep === "sent" && (
                                  <>
                                    <span style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#94a3b8", fontSize: 11, fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Sent
                                    </span>
                                    <button onClick={async e => {
                                        e.stopPropagation();
                                        setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], step: "replied" } }));
                                        handleStageChange(r.id, "replied");
                                        try {
                                          const { supabase } = await import('./supabaseClient');
                                          if (supabase && user?.id !== 'local') {
                                            await supabase.from('outreach_events').insert({ user_id: user.id, prospect_id: r.dbId || null, event_type: 'replied', email_type: sequences[r.id]?.emails?.[sequences[r.id]?.activeEmail || 0]?.type || 'intro' });
                                            if (sequences[r.id]?.dbId) {
                                              await supabase.from('sequences').update({ step: 'replied', updated_at: new Date().toISOString() }).eq('id', sequences[r.id].dbId);
                                            }
                                          }
                                        } catch (err) { console.error('Outreach event error:', err); }
                                      }}
                                      style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                      Mark Replied
                                    </button>
                                  </>
                                )}
                                {seqStep === "replied" && (
                                  <span style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontFamily: "monospace", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Replied
                                  </span>
                                )}
                                {(seq.refreshCount || 0) < 3 ? (
                                  <button onClick={e => { e.stopPropagation(); setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], refreshCount: (prev[r.id].refreshCount || 0) + 1 } })); startSequence(r); }}
                                    style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Refresh Email ({3 - (seq.refreshCount || 0)})
                                  </button>
                                ) : (
                                  <span style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#94a3b8", fontSize: 11, fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> No Refreshes Left
                                  </span>
                                )}
                                <button onClick={e => { e.stopPropagation(); setSequences(prev => { const next = { ...prev }; delete next[r.id]; return next; }); setSelected(null); }}
                                  style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #fecaca", background: "#ffffff", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ width: 8, height: 8, background: "#ef4444", display: "inline-block" }} /> Stop Prospecting
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`.ds-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.ds-btn:active { transform: translateY(0); }
.ds-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important; }
input:focus, textarea:focus, select:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@media (max-width: 768px) {
  .ds-root { min-height: auto !important; height: auto !important; }
  .ds-layout { flex-direction: column !important; height: auto !important; flex: none !important; }
  .ds-sidebar { width: 100% !important; border-right: none !important; border-top: 1px solid #e2e8f0; order: 2; flex: none !important; }
  .ds-main { padding: 16px !important; order: 1; overflow: visible !important; flex: none !important; height: auto !important; }
  .ds-hide-mobile { display: none !important; }
  .ds-show-mobile { display: flex !important; }
  .ds-card-row { gap: 8px !important; }
}`}</style>
    </div>
  );
}
