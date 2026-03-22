import { useState, useRef, useCallback } from "react";

const sourceColors = { LinkedIn: "#0a66c2", Indeed: "#2557a7", ZipRecruiter: "#00a960", BuiltIn: "#f26522", Dice: "#eb1c26", Multiple: "#7c3aed" };

const MatchBar = ({ value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", borderRadius: 2, transition: "width 1s ease", background: value >= 85 ? "#16a34a" : value >= 70 ? "#d97706" : "#94a3b8" }} />
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 32, fontFamily: "monospace", color: value >= 85 ? "#16a34a" : value >= 70 ? "#d97706" : "#94a3b8" }}>{value}%</span>
  </div>
);

const Tag = ({ children, color = "#64748b" }) => (
  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 3, background: color + "18", color, border: `1px solid ${color}33`, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "monospace" }}>{children}</span>
);

const SYSTEM = `You are a developer-hiring intelligence agent. Find REAL companies that are:
1. Currently hiring software developers or engineers (active job postings)
2. Between 100–1000 employees in size
3. Found on Indeed, LinkedIn Jobs, ZipRecruiter, BuiltIn, or Dice

Use web search to find actual current job postings. Search queries like:
- "site:indeed.com software engineer"
- "LinkedIn jobs software developer 100-500 employees"
- "site:ziprecruiter.com software developer"
- "site:builtin.com software engineer jobs"
- "site:dice.com software developer"

Search across ALL five job boards for the best coverage.

For each company, also find the hiring manager or recruiter for the developer roles. Search for the recruiter name on the job posting itself, or search "[company name] recruiter software engineer LinkedIn". Include their LinkedIn profile URL if found.

After searching, return ONLY a raw JSON object — absolutely no markdown, no code fences, no backticks, no explanation before or after. Start your response with { and end with }.

Format:
{
  "prospects": [
    {
      "company": "Acme Corp",
      "industry": "FinTech",
      "size": 320,
      "sizeSource": "LinkedIn",
      "location": "Austin, TX",
      "roles": ["Senior Backend Engineer", "DevOps Engineer"],
      "source": "LinkedIn",
      "posted": "2d ago",
      "matchScore": 88,
      "linkedinUrl": "https://linkedin.com/company/acme-corp",
      "indeedUrl": "",
      "ziprecruiterUrl": "",
      "builtinUrl": "",
      "diceUrl": "",
      "recruiter": {
        "name": "Jane Smith",
        "title": "Technical Recruiter",
        "linkedinUrl": "https://linkedin.com/in/jane-smith",
        "email": ""
      },
      "nearshoreScore": 85,
      "nearshoreSignals": ["No existing offshore presence", "Multiple open roles suggest scaling pain", "Non-tech industry likely lacks in-house recruiting pipeline"],
      "notes": "Series B fintech, engineering hiring surge"
    }
  ],
  "searchSummary": "Found X companies actively hiring developers with 100-1000 employees"
}

source: Use the board where the listing was found — "LinkedIn", "Indeed", "ZipRecruiter", "BuiltIn", "Dice", or "Multiple" if found on 2+ boards.
matchScore: 90-100 = perfect (100-500 employees, multiple dev roles, non-tech industry, high nearshore propensity); 75-89 = strong; 60-74 = moderate.
recruiter: The hiring manager or recruiter for the dev roles. Use empty strings if not found.
Target non-tech industries: healthcare, finance, manufacturing, retail, logistics, insurance, education, real estate, energy.

nearshoreScore: Rate 0-100 how likely this company is to use a nearshore outsourcing firm. Consider these signals:
- HIGH (80-100): Non-tech company struggling to hire devs, multiple open roles unfilled 2+ weeks, no existing offshore/nearshore mentions, located in high cost-of-living area, scaling fast (funding round, growth stage), small eng team relative to company size
- MEDIUM (50-79): Some dev roles open, mixed signals on existing outsourcing, mid-cost location, moderate hiring volume
- LOW (0-49): Already has offshore teams, large existing eng org, tech-first company, mentions "in-house only" culture
nearshoreSignals: Array of 2-3 short reasons explaining the score.
Return 8-12 prospects. Your entire response must be only the JSON object.`;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── Agentic loop: handles tool_use rounds until stop_reason = "end_turn" ──
async function runAgentLoop(userMsg, onSearchLog) {
  const messages = [{ role: "user", content: userMsg }];
  const MAX_ROUNDS = 12;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // Collect tool use blocks & text blocks
    const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
    const textBlocks = data.content.filter(b => b.type === "text");

    // If there are tool_use blocks, log them and build tool_result turn
    if (toolUseBlocks.length > 0) {
      toolUseBlocks.forEach(b => {
        if (b.name === "web_search" && b.input?.query) {
          onSearchLog(`Searching: "${b.input.query}"`);
        }
      });

      // Push assistant turn with all content blocks
      messages.push({ role: "assistant", content: data.content });

      // Build tool_result blocks (the API handles actual results; we just ack)
      const toolResults = toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: b.output ?? "Search completed."
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // No tool use — this is the final response
    const raw = textBlocks.map(b => b.text).join("").trim();
    return raw;
  }

  throw new Error("Agent did not produce a final response after max rounds.");
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
  "research": "2-3 paragraph brief: company context, recruiter background, why this is a good prospect, specific talking points to reference",
  "emails": [
    {
      "type": "intro",
      "subject": "Short, personalized subject line",
      "body": "The intro email body. Reference specific details about the company/role. If there's a connection (shared employer, school, group), mention it naturally. Keep it concise (3-5 sentences). End with a clear call to action."
    },
    {
      "type": "follow-up-1",
      "subject": "Re: [original subject]",
      "body": "Follow-up after 3 days of no response. Add new value — mention a specific insight about their hiring needs or company. 2-3 sentences."
    },
    {
      "type": "follow-up-2",
      "subject": "Re: [original subject]",
      "body": "Final follow-up after 7 days. Brief breakup email — acknowledge they're busy, leave the door open. 2 sentences max."
    }
  ]
}

Guidelines:
- Be professional but warm, not salesy or generic
- Reference specific details from your research (company news, role requirements, etc.)
- If connection data exists, weave it in naturally ("I noticed we both...")
- Keep emails concise — recruiters are busy
- Use the user's name in the signature if provided
Your entire response must be only the JSON object.`;

function extractNameFromLinkedIn(url) {
  if (!url) return "";
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  if (!match) return "";
  return match[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function runEnrichLoop(prospects, userLinkedin, userName, onSearchLog) {
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

  const messages = [{ role: "user", content: userMsg }];
  const MAX_ROUNDS = 15;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        system: SYSTEM_ENRICH,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
    const textBlocks = data.content.filter(b => b.type === "text");

    if (toolUseBlocks.length > 0) {
      toolUseBlocks.forEach(b => {
        if (b.name === "web_search" && b.input?.query) {
          onSearchLog(`Cross-ref: "${b.input.query}"`);
        }
      });
      messages.push({ role: "assistant", content: data.content });
      const toolResults = toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: b.output ?? "Search completed."
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return textBlocks.map(b => b.text).join("").trim();
  }

  throw new Error("Enrichment agent did not finish after max rounds.");
}

async function runSequenceAgent(prospect, userLinkedin, userName) {
  const connectionInfo = prospect.connectionStatus
    ? `Connection status: ${prospect.connectionStatus.status}\nDetails: ${prospect.connectionStatus.details || "none"}\nCompany relationship: ${prospect.companyRelationship || "unknown"}\nRecruiter relationship: ${prospect.recruiterRelationship || "unknown"}`
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

  const messages = [{ role: "user", content: userMsg }];
  const MAX_ROUNDS = 10;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        system: SYSTEM_SEQUENCE,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
    const textBlocks = data.content.filter(b => b.type === "text");

    if (toolUseBlocks.length > 0) {
      messages.push({ role: "assistant", content: data.content });
      const toolResults = toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: b.output ?? "Search completed."
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return textBlocks.map(b => b.text).join("").trim();
  }

  throw new Error("Sequence agent did not finish after max rounds.");
}

function parseProspects(raw) {
  // Strip any accidental markdown fences
  let cleaned = raw.replace(/```json|```/gi, "").trim();
  // Find the outermost JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

export default function DevScout() {
  const [phase, setPhase] = useState("idle"); // idle | scanning | done | error
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState(null);
  const [sequences, setSequences] = useState({});
  const [filters, setFilters] = useState({ source: "All", industry: "All", minSize: 100, maxSize: 10000, minMatch: 0 });
  const [customQuery, setCustomQuery] = useState("");
  const [scanMinSize, setScanMinSize] = useState(100);
  const [scanMaxSize, setScanMaxSize] = useState(() => window.innerWidth <= 768 ? 10000 : 1000);
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [userName, setUserName] = useState("");
  const [enrichPhase, setEnrichPhase] = useState("idle");
  const [enrichProgress, setEnrichProgress] = useState(0);
  const logRef = useRef(null);

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

  const clearAll = () => {
    setResults([]); setSummary(""); setSequences({}); setSelected(null); setPhase("idle"); setLogs([]); nextId.current = 1;
    setEnrichPhase("idle"); setEnrichProgress(0);
  };

  const runScan = async () => {
    setPhase("scanning"); setSummary(""); setLogs([]); setProgress(5); setSelected(null); setErrorMsg("");
    pushLog("Initializing search agent...");

    // Gradual ramp while waiting for first search result
    const rampTimer = setInterval(() => {
      setProgress(prev => prev < 18 ? prev + 2 : prev);
    }, 800);

    const sizeRange = `${scanMinSize.toLocaleString()}–${scanMaxSize.toLocaleString()}`;
    const userMsg = customQuery
      ? `Search Indeed, LinkedIn Jobs, ZipRecruiter, BuiltIn, and Dice for companies actively hiring software developers. Focus: ${customQuery}. Company size must be ${sizeRange} employees. Return only JSON.`
      : `Search Indeed, LinkedIn Jobs, ZipRecruiter, BuiltIn, and Dice for companies actively hiring software developers or engineers right now. Company headcount must be ${sizeRange} employees. Focus on non-tech industries. Return only JSON.`;

    try {
      let searchCount = 0;
      const raw = await runAgentLoop(userMsg, (query) => {
        searchCount++;
        clearInterval(rampTimer);
        setProgress(Math.min(20 + searchCount * 6, 85));
        pushLog(query);
      });

      clearInterval(rampTimer);
      setProgress(90);
      pushLog("Parsing and scoring results...");

      let parsed;
      try {
        parsed = parseProspects(raw);
      } catch (parseErr) {
        // Show raw for debugging
        console.error("Raw response:", raw);
        throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 200)}`);
      }

      const newProspects = (parsed.prospects || []).map(p => ({ ...p, id: nextId.current++ }));

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
      setProgress(100);
      pushLog(`Scan complete — ${newCount} new prospects found.`, true);
      finalizeLog();
      setSummary(parsed.searchSummary || "");
      setPhase("done");

      // Phase 2: LinkedIn cross-reference (only if user provided LinkedIn info)
      const resolvedName = userName || extractNameFromLinkedIn(linkedinUrl);
      if (linkedinUrl || resolvedName) {
        setEnrichPhase("enriching");
        setEnrichProgress(10);
        pushLog("Starting LinkedIn cross-reference...");

        try {
          let enrichSearchCount = 0;
          const enrichRaw = await runEnrichLoop(
            newProspects.slice(0, 6), // top 6 to keep searches manageable
            linkedinUrl,
            resolvedName,
            (query) => {
              enrichSearchCount++;
              setEnrichProgress(Math.min(10 + enrichSearchCount * 8, 90));
              pushLog(query);
            }
          );

          const enrichParsed = parseProspects(enrichRaw);

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
      console.error(err);
      setErrorMsg(err.message);
      pushLog("Error: " + err.message, true);
      finalizeLog();
      setPhase("error");
    }
  };

  const industries = ["All", ...new Set(results.map(r => r.industry).filter(Boolean))];

  const filtered = results.filter(r => {
    if (filters.source !== "All" && r.source !== filters.source) return false;
    if (filters.industry !== "All" && r.industry !== filters.industry) return false;
    if ((r.size || 0) < filters.minSize || (r.size || 9999) > filters.maxSize) return false;
    if ((r.matchScore || 0) < filters.minMatch) return false;
    return true;
  }).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const startSequence = async (prospect) => {
    const id = prospect.id;
    if (sequences[id]?.step === "researching") return;
    setSequences(prev => ({ ...prev, [id]: { step: "researching", research: "", emails: [], activeEmail: 0, notes: prev[id]?.notes || "" } }));
    try {
      const raw = await runSequenceAgent(prospect, linkedinUrl, userName || extractNameFromLinkedIn(linkedinUrl));
      const parsed = parseProspects(raw);
      setSequences(prev => ({ ...prev, [id]: { ...prev[id], step: "ready", research: parsed.research || "", emails: parsed.emails || [] } }));
    } catch (err) {
      console.error("Sequence error:", err);
      setSequences(prev => ({ ...prev, [id]: { ...prev[id], step: "idle" } }));
    }
  };

  const exportCSV = () => {
    const rows = ["Company,Industry,Size,Location,Source,Match Score,Nearshore Score,Nearshore Signals,Roles,Recruiter Name,Recruiter Title,Recruiter LinkedIn,Connection Status,Company Relationship,Recruiter Relationship,Sequence Status,Notes",
      ...filtered.map(r => `"${r.company}","${r.industry || ""}",${r.size || ""},"${r.location || ""}","${r.source || ""}",${r.matchScore || ""},${r.nearshoreScore ?? ""},"${(r.nearshoreSignals || []).join("; ")}","${(r.roles || []).join("; ")}","${r.recruiter?.name || ""}","${r.recruiter?.title || ""}","${r.recruiter?.linkedinUrl || ""}","${r.connectionStatus?.status || ""}","${r.companyRelationship || ""}","${r.recruiterRelationship || ""}","${sequences[r.id]?.step || "none"}","${r.notes || ""}"`)
    ].join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(rows); a.download = "devscout-prospects.csv"; a.click();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", color: "#0f172a", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
            <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
            <rect x="6" y="6" width="20" height="20" rx="3" fill="url(#hg)"/>
            <line x1="11" y1="3" x2="11" y2="6" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="16" y1="3" x2="16" y2="6" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="21" y1="3" x2="21" y2="6" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="11" y1="26" x2="11" y2="29" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="16" y1="26" x2="16" y2="29" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="21" y1="26" x2="21" y2="29" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="3" y1="11" x2="6" y2="11" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="3" y1="16" x2="6" y2="16" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="3" y1="21" x2="6" y2="21" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="26" y1="11" x2="29" y2="11" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="26" y1="16" x2="29" y2="16" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/><line x1="26" y1="21" x2="29" y2="21" stroke="url(#hg)" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="14.5" cy="14.5" r="4" stroke="white" strokeWidth="2"/><line x1="17.5" y1="17.5" x2="21.5" y2="21.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>DevScout</div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.12em" }}>AI-POWERED PROSPECTING</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span className="ds-hide-mobile" style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em" }}>INDEED · LINKEDIN · ZIPRECRUITER · BUILTIN · DICE</span>
          {Object.values(sequences).filter(s => s.step !== "idle").length > 0 && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b" }}><span style={{ color: "#3b82f6", fontWeight: 700 }}>{Object.values(sequences).filter(s => s.step !== "idle").length}</span> sequenced</span>}
          {phase === "done" && <span style={{ fontSize: 11, color: "#16a34a", fontFamily: "monospace" }}>● LIVE DATA</span>}
        </div>
      </div>

      <div className="ds-layout" style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div className="ds-sidebar" style={{ width: 264, borderRight: "1px solid #e2e8f0", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 20, flexShrink: 0, background: "#ffffff" }}>
          <div>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 7 }}>FOCUS QUERY (optional)</div>
            <textarea value={customQuery} onChange={e => setCustomQuery(e.target.value)}
              placeholder="e.g. healthcare in Texas, fintech hiring React devs..."
              rows={3} style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", padding: "8px 10px", fontSize: 12, fontFamily: "monospace", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 7 }}>YOUR LINKEDIN</div>
            <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-profile"
              style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", padding: "8px 10px", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
            <input value={userName} onChange={e => setUserName(e.target.value)}
              placeholder="Your full name (optional)"
              style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", padding: "8px 10px", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", marginTop: 6 }} />
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 4 }}>Enables recruiter cross-referencing</div>
          </div>

          <button onClick={runScan} disabled={phase === "scanning" || enrichPhase === "enriching"}
            style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", cursor: phase === "scanning" ? "not-allowed" : "pointer", background: phase === "scanning" ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: phase === "scanning" ? "#94a3b8" : "white", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {phase === "scanning"
              ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #94a3b8", borderTopColor: "#475569", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />SCANNING...</>
              : "⚡ RUN LIVE SCAN"}
          </button>

          <div>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>MAX EMPLOYEES</span><span style={{ color: "#3b82f6" }}>100–{scanMaxSize.toLocaleString()}</span>
            </div>
            <input type="range" min={100} max={10000} step={100} value={scanMaxSize} onChange={e => setScanMaxSize(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6" }} />
          </div>

          {phase === "scanning" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>PROGRESS</span>
                <span style={{ fontSize: 10, color: "#3b82f6", fontFamily: "monospace" }}>{progress}%</span>
              </div>
              <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2 }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", borderRadius: 2, transition: "width 0.6s ease" }} />
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
                <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>CROSS-REFERENCE</span>
                <span style={{ fontSize: 10, color: "#7c3aed", fontFamily: "monospace" }}>{enrichProgress}%</span>
              </div>
              <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2 }}>
                <div style={{ width: `${enrichProgress}%`, height: "100%", background: "linear-gradient(90deg,#8b5cf6,#ec4899)", borderRadius: 2, transition: "width 0.6s ease" }} />
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 18 }}>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 14 }}>FILTERS</div>
              {[{ label: "SOURCE", key: "source", opts: ["All", "LinkedIn", "Indeed", "ZipRecruiter", "BuiltIn", "Dice", "Multiple"] }, { label: "INDUSTRY", key: "industry", opts: industries }].map(({ label, key, opts }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 6 }}>{label}</div>
                  <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 5, color: "#334155", padding: "7px 9px", fontSize: 11, fontFamily: "monospace", appearance: "none" }}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>HEADCOUNT</span><span style={{ color: "#3b82f6" }}>{filters.minSize}–{filters.maxSize}</span>
                </div>
                <input type="range" min={100} max={5000} value={filters.minSize} onChange={e => setFilters(f => ({ ...f, minSize: +e.target.value }))} style={{ width: "100%", accentColor: "#3b82f6" }} />
                <input type="range" min={500} max={10000} value={filters.maxSize} onChange={e => setFilters(f => ({ ...f, maxSize: +e.target.value }))} style={{ width: "100%", accentColor: "#6366f1" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>MIN MATCH</span><span style={{ color: "#16a34a" }}>{filters.minMatch}%</span>
                </div>
                <input type="range" min={0} max={90} step={5} value={filters.minMatch} onChange={e => setFilters(f => ({ ...f, minMatch: +e.target.value }))} style={{ width: "100%", accentColor: "#16a34a" }} />
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
                  <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{filtered.length}</span>
                  <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>prospects{results.length !== filtered.length ? ` (${results.length} total)` : ""} · sorted by match</span>
                  {summary && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{summary}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={exportCSV} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>↓ Export CSV</button>
                  <button onClick={clearAll} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #fecaca", background: "#ffffff", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>✕ Clear All</button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map(r => {
                  const isOpen = selected?.id === r.id;
                  const initials = r.company.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                  const hue = (r.company.charCodeAt(0) * 37 + (r.company.charCodeAt(1) || 0) * 13) % 360;
                  const lc = `hsl(${hue},50%,45%)`;

                  return (
                    <div key={r.id} onClick={() => setSelected(isOpen ? null : r)}
                      style={{ background: "#ffffff", border: `1px solid ${isOpen ? "#3b82f6" : "#e2e8f0"}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s", boxShadow: isOpen ? "0 1px 8px rgba(59,130,246,0.08)" : "0 1px 3px rgba(0,0,0,0.04)" }}>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 9, background: lc + "18", border: `1px solid ${lc}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: lc, fontFamily: "monospace", flexShrink: 0, overflow: "hidden", position: "relative" }}>
                          {initials}
                          <img
                            src={`https://logo.clearbit.com/${r.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`}
                            alt=""
                            style={{ width: 32, height: 32, objectFit: "contain", position: "absolute", background: lc + "18", padding: 2 }}
                            onError={e => { e.target.style.display = "none"; }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{r.company}</span>
                            <Tag color={sourceColors[r.source] || "#64748b"}>{r.source || "—"}</Tag>
                            {r.connectionStatus?.status === "likely" && <Tag color="#16a34a">Connected</Tag>}
                            {r.connectionStatus?.status === "possible" && <Tag color="#d97706">Possible Link</Tag>}
                            {r.posted && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{r.posted}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                            {r.location && <span>📍 {r.location}</span>}
                            {r.industry && <span>🏢 {r.industry}</span>}
                            {r.size && <span style={{ fontFamily: "monospace", color: "#3b82f6" }}>{r.size.toLocaleString()} employees{r.sizeSource ? <span style={{ color: "#93c5fd", fontSize: 10 }}> via {r.sizeSource}</span> : ""}</span>}
                          </div>
                        </div>
                        <div style={{ width: 150, flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontFamily: "monospace" }}>MATCH SCORE</div>
                          <MatchBar value={r.matchScore || 0} />
                        </div>
                        {r.nearshoreScore != null && (
                          <div style={{ width: 90, flexShrink: 0, textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontFamily: "monospace" }}>NEARSHORE</div>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: r.nearshoreScore >= 80 ? "#16a34a" : r.nearshoreScore >= 50 ? "#d97706" : "#94a3b8" }}>{r.nearshoreScore}%</span>
                          </div>
                        )}
                        {sequences[r.id]?.step === "ready" && <span style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", fontFamily: "monospace", padding: "3px 8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4 }}>READY</span>}
                        {sequences[r.id]?.step === "sent" && <span style={{ fontSize: 10, fontWeight: 600, color: "#3b82f6", fontFamily: "monospace", padding: "3px 8px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4 }}>SENT</span>}
                        {sequences[r.id]?.step === "replied" && <span style={{ fontSize: 10, fontWeight: 600, color: "#7c3aed", fontFamily: "monospace", padding: "3px 8px", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 4 }}>REPLIED</span>}
                        {sequences[r.id]?.step === "researching" && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #cbd5e1", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                      </div>

                      {isOpen && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                          {r.notes && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, fontStyle: "italic" }}>{r.notes}</div>}

                          {/* Hiring Contact */}
                          {r.recruiter?.name && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>HIRING CONTACT</div>
                              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#475569", fontWeight: 600, flexShrink: 0 }}>
                                  {r.recruiter.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
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
                              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>CONNECTION STATUS</div>
                              <div style={{
                                background: r.connectionStatus.status === "likely" ? "#f0fdf4" : r.connectionStatus.status === "possible" ? "#fffbeb" : "#f8fafc",
                                border: `1px solid ${r.connectionStatus.status === "likely" ? "#bbf7d0" : r.connectionStatus.status === "possible" ? "#fde68a" : "#e2e8f0"}`,
                                borderRadius: 8, padding: "12px 16px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", background: r.connectionStatus.status === "likely" ? "#16a34a" : r.connectionStatus.status === "possible" ? "#d97706" : "#94a3b8" }} />
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>
                                    {r.connectionStatus.status === "likely" ? "Likely Connection" : r.connectionStatus.status === "possible" ? "Possible Connection" : r.connectionStatus.status}
                                  </span>
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

                          {/* Nearshore Propensity */}
                          {r.nearshoreScore != null && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>NEARSHORE PROPENSITY</div>
                              <div style={{
                                background: r.nearshoreScore >= 80 ? "#f0fdf4" : r.nearshoreScore >= 50 ? "#fffbeb" : "#f8fafc",
                                border: `1px solid ${r.nearshoreScore >= 80 ? "#bbf7d0" : r.nearshoreScore >= 50 ? "#fde68a" : "#e2e8f0"}`,
                                borderRadius: 8, padding: "12px 16px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: r.nearshoreScore >= 80 ? "#16a34a" : r.nearshoreScore >= 50 ? "#d97706" : "#94a3b8" }}>{r.nearshoreScore}%</span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                                    {r.nearshoreScore >= 80 ? "High Propensity" : r.nearshoreScore >= 50 ? "Medium Propensity" : "Low Propensity"}
                                  </span>
                                </div>
                                {(r.nearshoreSignals || []).length > 0 && (
                                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                                    {r.nearshoreSignals.map((s, i) => <div key={i}>· {s}</div>)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 10, letterSpacing: "0.08em" }}>OPEN DEVELOPER ROLES</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                            {(r.roles || []).map(role => (
                              <div key={role} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 14px", fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />{role}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {r.linkedinUrl && <a href={r.linkedinUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #bfdbfe", color: "#0a66c2", fontSize: 12, textDecoration: "none", fontFamily: "monospace" }}>LinkedIn →</a>}
                            {r.indeedUrl && <a href={r.indeedUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #bfdbfe", color: "#2557a7", fontSize: 12, textDecoration: "none", fontFamily: "monospace" }}>Indeed →</a>}
                            {r.ziprecruiterUrl && <a href={r.ziprecruiterUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #bbf7d0", color: "#00a960", fontSize: 12, textDecoration: "none", fontFamily: "monospace" }}>ZipRecruiter →</a>}
                            {r.builtinUrl && <a href={r.builtinUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #fed7aa", color: "#f26522", fontSize: 12, textDecoration: "none", fontFamily: "monospace" }}>BuiltIn →</a>}
                            {r.diceUrl && <a href={r.diceUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #fca5a5", color: "#eb1c26", fontSize: 12, textDecoration: "none", fontFamily: "monospace" }}>Dice →</a>}
                            {(!sequences[r.id] || sequences[r.id].step === "idle") && (
                              <button onClick={e => { e.stopPropagation(); startSequence(r); }}
                                style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", fontSize: 12, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                ▶ Start Sequence
                              </button>
                            )}
                            {sequences[r.id]?.step === "researching" && (
                              <button disabled style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", fontSize: 12, cursor: "not-allowed", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #cbd5e1", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Preparing...
                              </button>
                            )}
                            {sequences[r.id]?.step === "ready" && (
                              <button onClick={e => { e.stopPropagation(); setSelected(r); }}
                                style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontSize: 12, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                ✉ View Sequence
                              </button>
                            )}
                            {(sequences[r.id]?.step === "sent" || sequences[r.id]?.step === "replied") && (
                              <span style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#3b82f6", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>
                                {sequences[r.id].step === "sent" ? "✓ Sent" : "💬 Replied"}
                              </span>
                            )}
                          </div>

                          {/* Sequence Panel */}
                          {sequences[r.id]?.step && sequences[r.id].step !== "idle" && sequences[r.id].step !== "researching" && isOpen && (
                            <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                              {/* Research Brief */}
                              {sequences[r.id].research && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>RESEARCH BRIEF</div>
                                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                                    {sequences[r.id].research}
                                  </div>
                                </div>
                              )}

                              {/* Email Tabs */}
                              {(sequences[r.id].emails || []).length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 8, letterSpacing: "0.08em" }}>OUTREACH SEQUENCE</div>
                                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                    {sequences[r.id].emails.map((em, idx) => (
                                      <button key={idx} onClick={e => { e.stopPropagation(); setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], activeEmail: idx } })); }}
                                        style={{ padding: "6px 12px", borderRadius: 5, border: `1px solid ${(sequences[r.id].activeEmail || 0) === idx ? "#3b82f6" : "#e2e8f0"}`, background: (sequences[r.id].activeEmail || 0) === idx ? "#eff6ff" : "#ffffff", color: (sequences[r.id].activeEmail || 0) === idx ? "#3b82f6" : "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                        {em.type === "intro" ? "Intro" : em.type === "follow-up-1" ? "Follow-up 1" : "Follow-up 2"}
                                      </button>
                                    ))}
                                  </div>
                                  {(() => {
                                    const em = sequences[r.id].emails[sequences[r.id].activeEmail || 0];
                                    if (!em) return null;
                                    return (
                                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Subject: {em.subject}</div>
                                        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{em.body}</div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`); }}
                                            style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
                                            📋 Copy Email
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Status Actions */}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {sequences[r.id].step === "ready" && (
                                  <button onClick={e => { e.stopPropagation(); setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], step: "sent" } })); }}
                                    style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                    Mark Sent
                                  </button>
                                )}
                                {sequences[r.id].step === "sent" && (
                                  <button onClick={e => { e.stopPropagation(); setSequences(prev => ({ ...prev, [r.id]: { ...prev[r.id], step: "replied" } })); }}
                                    style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #ddd6fe", background: "#f5f3ff", color: "#7c3aed", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
                                    Mark Replied
                                  </button>
                                )}
                                <button onClick={e => { e.stopPropagation(); setSequences(prev => { const next = { ...prev }; delete next[r.id]; return next; }); }}
                                  style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #fecaca", background: "#ffffff", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
                                  Reset
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
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 768px) {
  .ds-layout { flex-direction: column !important; }
  .ds-sidebar { width: 100% !important; border-right: none !important; border-top: 1px solid #e2e8f0; order: 2; }
  .ds-main { padding: 16px !important; order: 1; }
  .ds-hide-mobile { display: none !important; }
}`}</style>
    </div>
  );
}
