import { useState, useRef, useCallback, useMemo } from "react";

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
const AGENT_MODEL = "claude-haiku-4-5-20251001";
const AGENT_MAX_ROUNDS = 6;

// ── Shared agentic loop: handles tool_use rounds until stop_reason = "end_turn" ──
async function runAgentLoopCore({ system, max_tokens, userMsg, onSearchLog }) {
  const messages = [{ role: "user", content: userMsg }];

  for (let round = 0; round < AGENT_MAX_ROUNDS; round++) {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AGENT_MODEL,
        max_tokens,
        system,
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

    return textBlocks.map(b => b.text).join("").trim();
  }

  throw new Error("Agent did not produce a final response after max rounds.");
}

async function runAgentLoop(userMsg, onSearchLog) {
  return runAgentLoopCore({ system: SYSTEM, max_tokens: 4000, userMsg, onSearchLog: q => onSearchLog(`Searching: "${q}"`) });
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
      "subject": "Short, personalized subject line",
      "body": "The intro email body. Reference specific details about the company/role. If there's a connection (shared employer, school, group), mention it naturally. Include 1-2 relevant BairesDev client references or public case studies from a similar industry to build credibility (e.g. 'We helped a Series B healthtech company scale their backend team by 4 engineers in 3 weeks' or reference known BairesDev clients like Google, Salesforce, BMW, Pinterest, etc. if relevant to the prospect's industry). Keep it concise (4-6 sentences). End with a clear call to action."
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
- In the intro email, include 1-2 BairesDev references: either public clients (Google, Salesforce, BMW, Pinterest, ViacomCBS, Rolls-Royce) or anonymized case studies from the prospect's industry (e.g. "We helped a mid-size logistics company reduce their dev hiring timeline from 3 months to 2 weeks"). Match references to the prospect's industry when possible.
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

  return runAgentLoopCore({ system: SYSTEM_ENRICH, max_tokens: 6000, userMsg, onSearchLog: q => onSearchLog(`Cross-ref: "${q}"`) });
}

async function runSequenceAgent(prospect, userLinkedin, userName) {
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

  return runAgentLoopCore({ system: SYSTEM_SEQUENCE, max_tokens: 6000, userMsg });
}

function parseAgentJSON(raw) {
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

  const loadDemo = () => {
    const demoProspects = [
      { id: "demo-1", company: "MedVault Health", industry: "Healthcare", size: 420, sizeSource: "LinkedIn", location: "Austin, TX", roles: ["Senior Backend Engineer", "DevOps Engineer"], source: "LinkedIn", posted: "2d ago", matchScore: 92, linkedinUrl: "https://linkedin.com/company/medvault", nearshoreScore: 88, nearshoreSignals: ["No existing offshore presence", "6 open dev roles unfilled 3+ weeks", "Non-tech healthcare company scaling fast"], recruiter: { name: "Sarah Chen", title: "Technical Recruiter", linkedinUrl: "https://linkedin.com/in/sarah-chen" }, connectionStatus: { status: "possible", connectionDegree: "2nd", details: "You and Sarah Chen both worked at companies in the Austin healthtech ecosystem", mutualConnections: ["David Kim - Engineering Lead at HealthStack"], sharedGroups: [] }, companyRelationship: "Shared Austin tech community", recruiterRelationship: "2nd degree via David Kim" },
      { id: "demo-2", company: "FreightWise Logistics", industry: "Logistics", size: 680, sizeSource: "Indeed", location: "Nashville, TN", roles: ["Full Stack Developer", "React Engineer"], source: "Indeed", posted: "5d ago", matchScore: 85, linkedinUrl: "", indeedUrl: "https://indeed.com/jobs?q=freightwise", nearshoreScore: 76, nearshoreSignals: ["Mid-size logistics firm", "2 dev roles open", "No mention of offshore teams"], recruiter: { name: "Marcus Johnson", title: "Hiring Manager", linkedinUrl: "https://linkedin.com/in/marcus-johnson" } },
      { id: "demo-3", company: "Apex Financial Group", industry: "Finance", size: 310, sizeSource: "LinkedIn", location: "Denver, CO", roles: ["Software Engineer", "Data Engineer", "Platform Engineer"], source: "Multiple", posted: "1d ago", matchScore: 95, linkedinUrl: "https://linkedin.com/company/apex-financial", ziprecruiterUrl: "https://ziprecruiter.com/c/apex-financial", nearshoreScore: 91, nearshoreSignals: ["Series C fintech, aggressive hiring", "8 engineering roles open", "High cost-of-living market with small eng team"], recruiter: { name: "Jessica Park", title: "VP of Engineering", linkedinUrl: "https://linkedin.com/in/jessica-park" } },
    ];
    setResults(demoProspects);
    setPhase("done");
    setSummary("DEMO MODE — 3 sample prospects loaded");
    setLogs([{ text: "Demo data loaded — click a prospect and try 'Start Sequence'", done: true }]);
    setSequences({
      "demo-1": {
        step: "ready", activeEmail: 0,
        research: "MedVault Health is a Series B healthcare SaaS company based in Austin, TX with ~420 employees. They recently raised $45M and are aggressively scaling their engineering team — 6 open developer roles have been posted for 3+ weeks, suggesting difficulty hiring locally. Sarah Chen is their Technical Recruiter who joined 4 months ago, likely brought on to handle the hiring surge.\n\nLinkedIn connection: Sarah Chen is a 2nd-degree connection via David Kim (Engineering Lead at HealthStack). Both operate in the Austin healthtech ecosystem, which gives a warm intro angle — mentioning David or the shared community could increase response rate significantly.\n\nKey talking points: Their platform handles EHR integrations which require significant backend complexity. The unfilled roles and recent funding signal they'd benefit from augmented staffing. Austin's competitive tech market makes nearshore an attractive cost-effective option.",
        emails: [
          { type: "intro", subject: "Re: your Backend Engineer search at MedVault", body: "Hi Sarah,\n\nI noticed MedVault has several engineering roles open — congrats on the Series B and the growth that's driving. Scaling an eng team in Austin's market is no small feat.\n\nAt BairesDev, we help companies like MedVault extend their engineering capacity with senior nearshore developers who integrate directly into your existing workflows. We recently helped a Series B healthtech company scale their backend team by 4 engineers in 3 weeks — and our developers have deep experience with EHR integrations similar to what MedVault is building. We also work with companies like Salesforce and Google, so our talent bar is high.\n\nWould you be open to a quick 15-minute call this week to see if we might be a fit?" },
          { type: "follow-up-1", subject: "Re: your Backend Engineer search at MedVault", body: "Hi Sarah,\n\nJust following up — I saw MedVault also posted a DevOps role this week, so it seems like the team is really scaling. We recently helped a similar healthcare company staff 3 senior engineers in under 2 weeks.\n\nHappy to share how that worked if it'd be useful." },
          { type: "follow-up-2", subject: "Re: your Backend Engineer search at MedVault", body: "Hi Sarah — I know you're busy with all the hiring. If the timing isn't right now, no worries at all. I'll keep MedVault on my radar and reach out if I see a particularly strong fit." }
        ]
      },
      "demo-2": {
        step: "ready", activeEmail: 0,
        research: "FreightWise Logistics is a mid-size logistics company based in Nashville, TN with ~680 employees. They are expanding their tech capabilities with 2 open developer roles — Full Stack Developer and React Engineer — posted on Indeed 5 days ago. Marcus Johnson is the Hiring Manager overseeing these roles.\n\nLinkedIn connection: No direct connection found. Marcus Johnson is a 3rd-degree connection. However, Nashville's growing tech scene and FreightWise's non-tech background suggest they may struggle to compete for local developer talent.\n\nKey talking points: Logistics companies are increasingly investing in custom software for route optimization, warehouse management, and real-time tracking. BairesDev has helped similar logistics firms like DHL and supply chain startups build React-based dashboards and full-stack platforms. The 2 open roles suggest early-stage tech team growth — a perfect entry point for nearshore augmentation.",
        emails: [
          { type: "intro", subject: "Scaling your dev team at FreightWise", body: "Hi Marcus,\n\nI came across the Full Stack and React Engineer roles at FreightWise — exciting to see the team investing in technology. Building out a dev team in logistics is a smart move, especially with how fast the industry is digitizing.\n\nAt BairesDev, we specialize in helping companies like FreightWise ramp up engineering capacity quickly. We recently helped a mid-size supply chain company build a real-time tracking dashboard with a team of 3 React engineers delivered in under 3 weeks. We also support enterprise logistics clients globally, so our developers understand the domain.\n\nWould you have 15 minutes this week to explore whether we could help accelerate your hiring?" },
          { type: "follow-up-1", subject: "Re: Scaling your dev team at FreightWise", body: "Hi Marcus,\n\nJust circling back — I noticed the React Engineer role is still open, which can be tough to fill in Nashville's market. We've had strong success placing senior React developers with logistics companies who need to move fast.\n\nHappy to share a quick case study if it'd be helpful." },
          { type: "follow-up-2", subject: "Re: Scaling your dev team at FreightWise", body: "Hi Marcus — I know hiring season is hectic. If the timing isn't right, totally understand. I'll keep FreightWise on my radar and reach out if I come across a particularly strong match for your stack." }
        ]
      },
      "demo-3": {
        step: "ready", activeEmail: 0,
        research: "Apex Financial Group is a Series C fintech company based in Denver, CO with ~310 employees. They are aggressively hiring with 8 engineering roles open across Software Engineer, Data Engineer, and Platform Engineer positions — posted across LinkedIn and ZipRecruiter just 1 day ago. Jessica Park, VP of Engineering, is leading the hiring push.\n\nLinkedIn connection: No direct connection data available. Jessica Park is estimated as a 3rd-degree connection. However, the volume of open roles (8 positions) and the Denver market's competitive tech landscape strongly suggest Apex would benefit from augmented staffing.\n\nKey talking points: Fintech requires high-caliber engineering talent with security and compliance awareness. BairesDev works with financial services companies including partners of Salesforce Financial Services Cloud. The combination of 8 open roles, Series C funding, and a small 310-person company signals rapid scaling pain — an ideal nearshore opportunity.",
        emails: [
          { type: "intro", subject: "Supporting Apex Financial's engineering growth", body: "Hi Jessica,\n\nCongratulations on the Series C — and the ambitious hiring push that comes with it. 8 open engineering roles is a big lift, especially in Denver's competitive market.\n\nAt BairesDev, we help fintech companies like Apex scale their engineering teams rapidly without compromising on quality. We recently embedded a 5-person platform engineering team at a Series B payments company that was fully productive within 2 weeks. We also work with financial services teams at companies like Salesforce, so our developers understand compliance-sensitive environments.\n\nWould you be open to a brief call to discuss how we might help accelerate your engineering roadmap?" },
          { type: "follow-up-1", subject: "Re: Supporting Apex Financial's engineering growth", body: "Hi Jessica,\n\nFollowing up — with 8 roles open across software, data, and platform engineering, I imagine the hiring pipeline is getting complex. We've helped similar fintech companies fill senior engineering gaps in as little as 10 days.\n\nHappy to share specifics if you're interested." },
          { type: "follow-up-2", subject: "Re: Supporting Apex Financial's engineering growth", body: "Hi Jessica — I know you have a lot on your plate with the hiring surge. If now isn't the right time, no worries. I'll keep Apex on my radar and reach out when I see a strong fit for your platform or data engineering needs." }
        ]
      }
    });
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
        parsed = parseAgentJSON(raw);
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
      console.error(err);
      setErrorMsg(err.message);
      pushLog("Error: " + err.message, true);
      finalizeLog();
      setPhase("error");
    }
  };

  const industries = useMemo(() => ["All", ...new Set(results.map(r => r.industry).filter(Boolean))], [results]);

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
    setSequences(prev => ({ ...prev, [id]: { step: "researching", research: "", emails: [], activeEmail: 0, notes: prev[id]?.notes || "" } }));
    try {
      const raw = await runSequenceAgent(prospect, linkedinUrl, userName || extractNameFromLinkedIn(linkedinUrl));
      const parsed = parseAgentJSON(raw);
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
          <img src="/logo.svg" alt="DevScout" style={{ width: 38, height: 38 }} />
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>DevScout</div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.12em" }}>AI-POWERED PROSPECTING</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span className="ds-hide-mobile" style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em" }}>INDEED · LINKEDIN · ZIPRECRUITER · BUILTIN · DICE</span>
          {activeSequenceCount > 0 && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b" }}><span style={{ color: "#3b82f6", fontWeight: 700 }}>{activeSequenceCount}</span> sequenced</span>}
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
            style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", cursor: phase === "scanning" ? "not-allowed" : "pointer", background: phase === "scanning" ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: phase === "scanning" ? "#94a3b8" : "white", fontFamily: "monospace", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {phase === "scanning"
              ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #94a3b8", borderTopColor: "#475569", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />SCANNING...</>
              : "⚡ SCAN FOR PROSPECTS"}
          </button>

          {phase === "idle" && (
            <button onClick={loadDemo}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer", background: "#ffffff", color: "#64748b", fontFamily: "monospace", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em" }}>
              ▶&nbsp;&nbsp;LOAD DEMO DATA
            </button>
          )}

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
                            style={{ width: 42, height: 42, objectFit: "contain", position: "absolute", background: "#fff", padding: 4, borderRadius: 9 }}
                            onError={e => {
                              if (!e.target.dataset.tried) {
                                e.target.dataset.tried = "1";
                                const words = r.company.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
                                e.target.src = `https://logo.clearbit.com/${words[0]}.com`;
                              } else { e.target.style.display = "none"; }
                            }}
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
                                          <button onClick={e => {
                                              e.stopPropagation();
                                              const to = r.recruiter?.email || "";
                                              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}`;
                                              window.open(gmailUrl, "_blank");
                                            }}
                                            style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                            <svg width="16" height="12" viewBox="0 0 48 36" fill="none"><path d="M6 0h36c3.3 0 6 2.7 6 6v24c0 3.3-2.7 6-6 6H6c-3.3 0-6-2.7-6-6V6c0-3.3 2.7-6 6-6z" fill="#F1F3F4"/><path d="M2 6l22 15L46 6" stroke="#EA4335" strokeWidth="2" fill="none"/><path d="M0 6v24c0 3.3 2.7 6 6 6h4V12L0 6z" fill="#4285F4"/><path d="M48 6v24c0 3.3-2.7 6-6 6h-4V12l10-6z" fill="#34A853"/><path d="M10 36V12L24 21 38 12v24" fill="#C5221F" opacity="0.05"/><path d="M0 6l10 6 14 9 14-9 10-6" fill="none"/><path d="M0 6l24 15L48 6" stroke="#EA4335" strokeWidth="0" fill="none"/><rect x="10" y="0" width="28" height="12" rx="0" fill="#C5221F" opacity="0.9"/><path d="M10 12L0 6c0-3.3 2.7-6 6-6h4v12z" fill="#F14336"/><path d="M38 12l10-6c0-3.3-2.7-6-6-6h-4v12z" fill="#FBBC05"/><path d="M10 12l14 9 14-9" fill="#C5221F"/></svg>
                                            Draft in Gmail
                                          </button>
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
