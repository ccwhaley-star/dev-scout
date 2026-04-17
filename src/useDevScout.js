import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { isExistingClient } from "./clients";

/* ============================================================
   useDevScout — Data layer hook.
   Encapsulates scan logic, sequences, Supabase persistence,
   and the Anthropic API proxy calls. Returns a state + actions
   object consumed by the shell.
   ============================================================ */

const API_URL = import.meta.env.VITE_API_URL || "";
const AGENT_MODEL = "claude-haiku-4-5-20251001";
const AGENT_MAX_ROUNDS = 6;

// ── Prompt constants ─────────────────────────────────────────────────────
const SYSTEM_SCAN = `You search job boards and return results as JSON. Search for companies hiring software developers across Indeed, LinkedIn Jobs, ZipRecruiter, BuiltIn, and Dice. Do 3-4 web searches covering different boards, then IMMEDIATELY return JSON.

Rules:
- Do 3-4 web searches across different job boards, then STOP and return JSON.
- Always return JSON even with partial data.
- Include ANY company hiring developers.
- Every prospect MUST include a recruiter name. If no contact on posting, search LinkedIn for talent acquisition at that company.
- Try to find real recruiter emails (firstname@company.com format preferred over careers@).
- Do NOT explain or apologize. Only return a JSON object.
- Start with { and end with }. Nothing else.

JSON format (omit empty fields):
{"prospects":[{"company":"","industry":"","size":0,"location":"","roles":[],"source":"","posted":"","matchScore":0,"signals":[],"recruiter":{"name":"","title":"","email":""},"nearshoreScore":0}],"searchSummary":""}

matchScore: 90-100=perfect, 75-89=strong, 60-74=moderate. signals: 2-4 plain-language sentences describing what makes this company a good target (e.g. "Hiring surge after Series C", "New VP of Eng from Target Nov 2025"). Return 4-6 prospects max. Notes under 10 words.`;

const SYSTEM_SEQUENCE = `You are a sales development outreach agent. Research the prospect (company news, recruiter background), then generate a 3-email sequence.

Return ONLY JSON:
{
  "research": "2-3 sentence brief: company context, recruiter background, specific angle to reference",
  "emails": [
    { "type": "intro", "subject": "short specific subject", "body": "max 75 words. Hook (specific signal) + value (specific BairesDev case study) + CTA. Mention BairesDev by name." },
    { "type": "follow-up-1", "subject": "Re: ...", "body": "2-3 sentences, new angle/insight" },
    { "type": "follow-up-2", "subject": "Re: ...", "body": "2 sentence breakup email" }
  ]
}

Write like a human, not a press release. No hedging language. BairesDev is a leading nearshore tech company.`;

// ── Agent loop core ──────────────────────────────────────────────────────
async function runAgentLoopCore({ system, max_tokens, userMsg, onSearchLog, signal, noTools, token, action }) {
  const messages = [{ role: "user", content: userMsg }];
  const tools = noTools ? undefined : [{ type: "web_search_20250305", name: "web_search" }];
  let accumulatedText = "";

  for (let round = 0; round < AGENT_MAX_ROUNDS; round++) {
    if (signal?.aborted) throw new DOMException("Scan stopped", "AbortError");
    const isLastRound = round === AGENT_MAX_ROUNDS - 1;
    const roundTools = isLastRound ? undefined : tools;
    const body = { model: AGENT_MODEL, max_tokens, system, messages };
    if (roundTools) body.tools = roundTools;

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (action) headers["x-devscout-action"] = action;

    const res = await fetch(`${API_URL}/api/messages`, { method: "POST", headers, signal, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const toolUses = data.content.filter(b => b.type === "tool_use");
    const texts = data.content.filter(b => b.type === "text");
    const text = texts.map(t => t.text || "").join("").trim();
    if (text) accumulatedText += (accumulatedText ? "\n" : "") + text;

    if (toolUses.length > 0 && !isLastRound) {
      if (onSearchLog) toolUses.forEach(t => { if (t.name === "web_search" && t.input?.query) onSearchLog(t.input.query); });
      messages.push({ role: "assistant", content: data.content });
      messages.push({ role: "user", content: toolUses.map(t => ({ type: "tool_result", tool_use_id: t.id, content: "OK" })) });
      continue;
    }
    return text || accumulatedText;
  }
  return accumulatedText;
}

function parseJSON(raw) {
  let cleaned = (raw || "").replace(/```json|```/gi, "").trim();
  cleaned = cleaned.replace(/<cite[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  cleaned = cleaned.slice(start, end + 1);
  try { return JSON.parse(cleaned); } catch (e) {
    // Try repair for truncated JSON
    const lastObj = cleaned.lastIndexOf("}");
    if (lastObj > 0) {
      try { return JSON.parse(cleaned.slice(0, lastObj + 1) + '],"searchSummary":""}'); } catch (e2) {}
      try { return JSON.parse(cleaned.slice(0, lastObj + 1) + "]}"); } catch (e3) {}
    }
    throw new Error("Could not parse JSON");
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useDevScout(user, getToken) {
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sequences, setSequences] = useState({});
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [filters, setFilters] = useState({ industry: "Any industry", size: 1000 });
  const scanAbort = useRef(null);
  const nextId = useRef(1);

  // Load prospects + sequences from Supabase on mount
  useEffect(() => {
    if (!user || !supabase || user.id === "local") return;
    (async () => {
      const { data: prospects } = await supabase.from("prospects").select("*").order("match_score", { ascending: false });
      if (prospects && prospects.length) {
        const claimerIds = [...new Set(prospects.filter(p => p.claimed_by).map(p => p.claimed_by))];
        const { data: profiles } = claimerIds.length
          ? await supabase.from("user_profiles").select("id, full_name").in("id", claimerIds)
          : { data: [] };
        const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
        const mapped = prospects.map(p => ({
          id: p.id,
          dbId: p.id,
          company: p.company,
          domain: p.domain || null,
          industry: p.industry,
          size: p.size,
          location: p.location,
          roles: p.roles || [],
          openRoles: p.roles || [],
          source: p.source,
          posted: p.posted,
          matchScore: p.match_score,
          nearshoreScore: p.nearshore_score,
          signals: p.nearshore_signals || [],
          signalsUpdated: p.signals_updated_hours ?? 48,
          recruiter: {
            name: p.recruiter_name || "",
            title: p.recruiter_title || "",
            email: p.recruiter_email || "",
            linkedinUrl: p.recruiter_linkedin_url || "",
            photoUrl: p.recruiter_photo_url || "",
            connection: p.recruiter_connection || "none",
            sharedVia: p.recruiter_shared_via || "",
          },
          notes: p.notes,
          stage: p.pipeline_stage || "new",
          claimed_by: p.claimed_by,
          claimed_by_name: p.claimed_by ? nameMap[p.claimed_by] : null,
          isExistingClient: isExistingClient(p.company),
          prevClient: isExistingClient(p.company),
        }));
        setResults(mapped);
        nextId.current = Math.max(...prospects.map(p => p.id || 0)) + 1;
      }
      const { data: seqs } = await supabase.from("sequences").select("*");
      if (seqs && seqs.length) {
        const map = {};
        seqs.forEach(s => {
          map[s.prospect_id] = {
            step: s.step, research: s.research, emails: s.emails || [],
            activeEmail: s.active_email || 0, dbId: s.id,
          };
        });
        setSequences(map);
      }
    })();
  }, [user]);

  // Cross-reference with LinkedIn connections from localStorage
  const applyLinkedInConnections = useCallback((prospects) => {
    const stored = localStorage.getItem("ds_linkedin_connections");
    if (!stored) return prospects;
    let conns;
    try { conns = JSON.parse(stored); } catch (e) { return prospects; }

    return prospects.map(p => {
      const lower = (p.company || "").toLowerCase();
      const matches = conns.filter(c => c.company && (lower.includes(c.company.toLowerCase()) || c.company.toLowerCase().includes(lower)));
      if (matches.length === 0) return p;
      const recruiterMatch = p.recruiter?.name && matches.find(m => m.name.toLowerCase() === p.recruiter.name.toLowerCase());
      return {
        ...p,
        recruiter: {
          ...p.recruiter,
          connection: recruiterMatch ? "1st" : "2nd",
          sharedVia: recruiterMatch ? "" : matches[0].name,
        },
      };
    });
  }, []);

  const pushLog = useCallback(l => setLogs(prev => [...prev, l].slice(-40)), []);

  // Run scan
  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true); setLogs([]); setErrorMsg("");
    const controller = new AbortController();
    scanAbort.current = controller;
    const token = await getToken?.();

    try {
      const industryFocus = filters.industry && filters.industry !== "Any industry"
        ? ` Focus on the ${filters.industry} industry.`
        : " Focus on non-tech industries.";
      const userMsg = `Search Indeed, LinkedIn, ZipRecruiter, BuiltIn, and Dice for companies actively hiring software developers. Company size around ${filters.size} employees.${industryFocus} Return only JSON.`;

      pushLog("Initializing search agent…");
      const raw = await runAgentLoopCore({
        system: SYSTEM_SCAN, max_tokens: 8000, userMsg,
        onSearchLog: q => pushLog(`Searching: ${q}`),
        signal: controller.signal, token, action: "scan",
      });

      pushLog("Parsing results…");
      let parsed;
      try { parsed = parseJSON(raw); } catch (e) {
        // Retry with JSON-only prompt
        pushLog("Converting to JSON…");
        const retry = await runAgentLoopCore({
          system: 'Return ONLY a JSON object with a "prospects" array. No text outside JSON.',
          max_tokens: 8000,
          userMsg: raw.slice(0, 3000),
          noTools: true, token, action: "scan",
        });
        parsed = parseJSON(retry);
      }

      const newProspects = (parsed.prospects || [])
        .map(p => {
          const ms = p.matchScore || 0;
          const ns = p.nearshoreScore || 0;
          const combined = Math.round((ms + ns) / 2);
          const domain = (p.company || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => !["inc", "llc", "corp", "co", "group", "the", "and"].includes(w))[0] + ".com";
          return {
            ...p,
            id: nextId.current++,
            domain,
            openRoles: p.roles || [],
            matchScore: combined,
            rawMatchScore: ms,
            rawNearshoreScore: ns,
            signalsUpdated: 2, // fresh from scan
            stage: "new",
            isNew: true,
            isExistingClient: isExistingClient(p.company),
            prevClient: isExistingClient(p.company),
          };
        });

      // Apply LinkedIn connection matching
      const enriched = applyLinkedInConnections(newProspects);

      // Merge with existing (dedupe by company)
      setResults(prev => {
        const existing = new Map(prev.map(r => [(r.company || "").toLowerCase(), r]));
        for (const p of enriched) {
          const key = (p.company || "").toLowerCase();
          if (existing.has(key)) {
            existing.set(key, { ...existing.get(key), ...p, id: existing.get(key).id });
          } else {
            existing.set(key, p);
          }
        }
        return [...existing.values()];
      });

      pushLog(`Scan complete — ${enriched.length} prospects found.`);

      // Save to Supabase
      if (supabase && user?.id !== "local") {
        for (const p of enriched) {
          await supabase.from("prospects").upsert({
            company: p.company,
            industry: p.industry,
            size: p.size,
            location: p.location,
            roles: p.roles || [],
            source: p.source,
            posted: p.posted,
            match_score: p.matchScore,
            raw_match_score: p.rawMatchScore,
            raw_nearshore_score: p.rawNearshoreScore,
            nearshore_score: p.nearshoreScore,
            nearshore_signals: p.signals || [],
            notes: p.notes || "",
            recruiter_name: p.recruiter?.name,
            recruiter_title: p.recruiter?.title,
            recruiter_email: p.recruiter?.email,
            recruiter_connection: p.recruiter?.connection,
            recruiter_shared_via: p.recruiter?.sharedVia,
            scanned_by: user.id,
            pipeline_stage: "new",
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_lower" }).select();
        }
      }
    } catch (err) {
      if (err.name === "AbortError") { pushLog("Scan stopped."); }
      else {
        const friendly = err.message.includes("rate limit") ? "Rate limit reached — wait 1 minute and try again."
          : err.message.includes("credit balance") ? "API credits depleted."
          : err.message.includes("Failed to fetch") ? "Cannot reach scan service."
          : `Scan failed: ${err.message.slice(0, 120)}`;
        setErrorMsg(friendly);
        pushLog(friendly);
      }
    } finally {
      setScanning(false);
      scanAbort.current = null;
    }
  }, [scanning, filters, user, getToken, pushLog, applyLinkedInConnections]);

  const stopScan = useCallback(() => {
    scanAbort.current?.abort();
  }, []);

  // Start sequence for a prospect
  const startSequence = useCallback(async (prospect) => {
    if (!prospect || sequences[prospect.id]?.step === "researching") return;
    setSequences(prev => ({ ...prev, [prospect.id]: { step: "researching", research: "", emails: [] } }));
    try {
      const token = await getToken?.();
      const userMsg = `Generate outreach sequence for:
Company: ${prospect.company}
Industry: ${prospect.industry}
Open roles: ${(prospect.openRoles || []).join(", ")}
Recruiter: ${prospect.recruiter?.name} (${prospect.recruiter?.title})
Signals: ${(prospect.signals || []).join("; ")}
Connection: ${prospect.recruiter?.connection || "none"}${prospect.recruiter?.sharedVia ? ` (via ${prospect.recruiter.sharedVia})` : ""}

Research this prospect and return the outreach JSON.`;
      const raw = await runAgentLoopCore({
        system: SYSTEM_SEQUENCE, max_tokens: 6000, userMsg, token, action: "sequence",
      });
      let parsed;
      try { parsed = parseJSON(raw); } catch (e) {
        const retry = await runAgentLoopCore({
          system: 'Convert the following into JSON with "research" and "emails" array. Return ONLY JSON.',
          max_tokens: 6000, userMsg: raw.slice(0, 3000), noTools: true, token, action: "sequence",
        });
        parsed = parseJSON(retry);
      }
      setSequences(prev => ({ ...prev, [prospect.id]: {
        step: "ready", research: parsed.research || "", emails: parsed.emails || [], activeEmail: 0,
      }}));

      // Persist to Supabase
      if (supabase && user?.id !== "local" && prospect.dbId) {
        await supabase.from("sequences").upsert({
          prospect_id: prospect.dbId, user_id: user.id,
          step: "ready", research: parsed.research || "", emails: parsed.emails || [],
          updated_at: new Date().toISOString(),
        }, { onConflict: "prospect_id" });
        await supabase.from("prospects")
          .update({ claimed_by: user.id, claimed_at: new Date().toISOString(), pipeline_stage: "prospecting" })
          .eq("id", prospect.dbId)
          .is("claimed_by", null);
        setResults(prev => prev.map(r => r.id === prospect.id ? { ...r, claimed_by: user.id, claimed_by_name: user.user_metadata?.full_name, stage: "prospecting" } : r));
      } else {
        setResults(prev => prev.map(r => r.id === prospect.id ? { ...r, stage: "prospecting" } : r));
      }
    } catch (err) {
      setSequences(prev => ({ ...prev, [prospect.id]: { step: "error", error: err.message } }));
    }
  }, [sequences, user, getToken]);

  // Move prospect to stage
  const moveStage = useCallback(async (prospectId, stage) => {
    setResults(prev => prev.map(r => r.id === prospectId ? { ...r, stage } : r));
    const p = results.find(r => r.id === prospectId);
    if (supabase && user?.id !== "local" && p?.dbId) {
      await supabase.from("prospects").update({ pipeline_stage: stage, updated_at: new Date().toISOString() }).eq("id", p.dbId);
    }
  }, [results, user]);

  // Mark email sent
  const markSent = useCallback(async (prospect) => {
    setSequences(prev => ({ ...prev, [prospect.id]: { ...prev[prospect.id], step: "sent" } }));
    await moveStage(prospect.id, "contacted");
    if (supabase && user?.id !== "local") {
      await supabase.from("outreach_events").insert({
        user_id: user.id, prospect_id: prospect.dbId, event_type: "sent", email_type: "intro",
      });
      if (sequences[prospect.id]?.dbId) {
        await supabase.from("sequences").update({ step: "sent" }).eq("id", sequences[prospect.id].dbId);
      }
    }
  }, [moveStage, sequences, user]);

  // Mark replied
  const markReplied = useCallback(async (prospect) => {
    setSequences(prev => ({ ...prev, [prospect.id]: { ...prev[prospect.id], step: "replied" } }));
    await moveStage(prospect.id, "replied");
    if (supabase && user?.id !== "local") {
      await supabase.from("outreach_events").insert({
        user_id: user.id, prospect_id: prospect.dbId, event_type: "replied", email_type: "intro",
      });
    }
  }, [moveStage, user]);

  // Delete prospect
  const deleteProspect = useCallback(async (prospect) => {
    setResults(prev => prev.filter(r => r.id !== prospect.id));
    setSequences(prev => { const next = { ...prev }; delete next[prospect.id]; return next; });
    if (selected?.id === prospect.id) setSelected(null);
    if (supabase && user?.id !== "local" && prospect.dbId) {
      await supabase.from("sequences").delete().eq("prospect_id", prospect.dbId);
      await supabase.from("prospects").delete().eq("id", prospect.dbId);
    }
  }, [selected, user]);

  return {
    results, setResults, selected, setSelected, sequences,
    scanning, logs, errorMsg, filters, setFilters,
    runScan, stopScan, startSequence, moveStage, markSent, markReplied, deleteProspect,
  };
}
