import { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthProvider";
import { TopBar } from "../components/Shell";
import { supabase } from "../supabaseClient";

const sectionStyle = {
  background: "var(--paper-0)", border: "1px solid var(--stone-200)", borderRadius: 10, padding: 24,
};
const labelStyle = {
  fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-500)",
  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6,
};
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--stone-300)",
  fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--ink-800)",
  background: "var(--paper-50)", outline: "none", boxSizing: "border-box",
};
const sectionTitle = {
  fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)",
  margin: 0, lineHeight: 1.2, letterSpacing: "-0.01em",
};
const sectionSub = {
  fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-600)",
  marginTop: 4, lineHeight: 1.5,
};
const primaryBtn = {
  padding: "10px 16px", borderRadius: 7, border: "none",
  background: "var(--brand-coral-500)", color: "var(--paper-50)",
  fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
  letterSpacing: "-0.005em", cursor: "pointer",
};
const inkBtn = {
  ...primaryBtn, background: "var(--ink-900)",
  display: "inline-flex", alignItems: "center", gap: 8,
};

function parseLinkedInCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase());
  const firstIdx = header.findIndex(h => h.includes("first name") || h === "first");
  const lastIdx = header.findIndex(h => h.includes("last name") || h === "last");
  const companyIdx = header.findIndex(h => h.includes("company") || h.includes("organization"));
  const positionIdx = header.findIndex(h => h.includes("position") || h.includes("title"));
  const emailIdx = header.findIndex(h => h.includes("email"));
  const urlIdx = header.findIndex(h => h.includes("url") || h.includes("profile"));
  const connections = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = [];
    let current = "", inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cols.push(current.trim());
    const firstName = firstIdx >= 0 ? cols[firstIdx] || "" : "";
    const lastName = lastIdx >= 0 ? cols[lastIdx] || "" : "";
    if (!firstName && !lastName) continue;
    connections.push({
      firstName, lastName, name: `${firstName} ${lastName}`.trim(),
      company: companyIdx >= 0 ? cols[companyIdx] || "" : "",
      position: positionIdx >= 0 ? cols[positionIdx] || "" : "",
      email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
      profileUrl: urlIdx >= 0 ? cols[urlIdx] || "" : "",
    });
  }
  return connections;
}

export default function Profile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [csvName, setCsvName] = useState(null);
  const [csvCount, setCsvCount] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("ds_linkedin_connections");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCsvName(localStorage.getItem("ds_linkedin_csv_name") || "connections.csv");
        setCsvCount(parsed.length);
      } catch (e) {}
    }
  }, []);

  const saveAccount = async () => {
    setMsg(null);
    try {
      if (supabase && user?.id !== "local") {
        await supabase.from("user_profiles").update({ full_name: fullName }).eq("id", user.id);
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }
      setMsg({ type: "success", text: "Saved." });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
  };

  const updatePassword = async () => {
    setPwMsg(null);
    if (newPw.length < 12) return setPwMsg({ type: "error", text: "Minimum 12 characters." });
    if (newPw !== confirmPw) return setPwMsg({ type: "error", text: "Passwords don't match." });
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPw });
        if (error) throw error;
      }
      setPwMsg({ type: "success", text: "Password updated." });
      setNewPw(""); setConfirmPw("");
    } catch (e) { setPwMsg({ type: "error", text: e.message }); }
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = parseLinkedInCSV(evt.target.result);
        if (parsed.length === 0) {
          alert("No connections found. Make sure it's a LinkedIn Connections CSV.");
          return;
        }
        localStorage.setItem("ds_linkedin_connections", JSON.stringify(parsed));
        localStorage.setItem("ds_linkedin_csv_name", f.name);
        setCsvName(f.name);
        setCsvCount(parsed.length);
      } catch (err) {
        alert("Error parsing CSV: " + err.message);
      }
    };
    reader.readAsText(f);
  };

  const clearCSV = () => {
    localStorage.removeItem("ds_linkedin_connections");
    localStorage.removeItem("ds_linkedin_csv_name");
    setCsvName(null);
    setCsvCount(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <TopBar subtitle="Profile" title="Account" />
      <div style={{ padding: "24px 32px", maxWidth: 680, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Account */}
        <section style={sectionStyle}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={sectionTitle}>Account</h2>
            <div style={sectionSub}>Basic details. Your name is used in outreach email signatures.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><div style={labelStyle}>Full name</div><input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Email</div><input value={email} disabled style={{ ...inputStyle, background: "var(--paper-100)", color: "var(--ink-500)" }} /></div>
            {msg && <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: msg.type === "error" ? "var(--danger-600)" : "var(--success-600)" }}>{msg.text}</div>}
            <div style={{ marginTop: 4 }}>
              <button onClick={saveAccount} style={primaryBtn}>Save changes</button>
            </div>
          </div>
        </section>

        {/* Password */}
        <section style={sectionStyle}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={sectionTitle}>Change password</h2>
            <div style={sectionSub}>Minimum 12 characters. You'll be signed out of other sessions.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><div style={labelStyle}>New password</div><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} /></div>
              <div><div style={labelStyle}>Confirm</div><input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputStyle} /></div>
            </div>
            {pwMsg && <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: pwMsg.type === "error" ? "var(--danger-600)" : "var(--success-600)" }}>{pwMsg.text}</div>}
            <div style={{ marginTop: 4 }}>
              <button onClick={updatePassword} style={primaryBtn}>Update password</button>
            </div>
          </div>
        </section>

        {/* LinkedIn CSV */}
        <section style={sectionStyle}>
          <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <h2 style={sectionTitle}>LinkedIn connections</h2>
              <div style={sectionSub}>Upload your LinkedIn connections CSV to cross-reference prospects. DevScout uses it to surface 1st- and 2nd-degree paths to hiring contacts.</div>
            </div>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#0a66c2" style={{ flex: "none" }}>
              <path d="M20.47 2H3.53A1.45 1.45 0 002 3.47v17.06A1.45 1.45 0 003.53 22h16.94A1.45 1.45 0 0022 20.53V3.47A1.45 1.45 0 0020.47 2zM8.09 18.74h-3v-9h3v9zM6.59 8.48a1.56 1.56 0 110-3.12 1.56 1.56 0 010 3.12zm12.32 10.26h-3v-4.83c0-1.21-.43-2-1.52-2A1.65 1.65 0 0012.85 13a2 2 0 00-.1.73v5h-3v-9h3v1.2a3 3 0 012.71-1.5c2 0 3.45 1.29 3.45 4.06v5.25z" />
            </svg>
          </div>
          {csvName ? (
            <div style={{ padding: "14px 16px", background: "var(--paper-100)", border: "1px solid var(--stone-200)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink-900)", fontWeight: 600, marginBottom: 2 }}>{csvName}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)" }}>
                  <span style={{ color: "var(--brand-coral-600)" }}>✓</span> {csvCount?.toLocaleString()} connections imported
                </div>
              </div>
              <button onClick={clearCSV}
                style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid var(--stone-300)", background: "var(--paper-0)", color: "var(--ink-700)", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Replace
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} id="csv-upload" />
              <label htmlFor="csv-upload" style={{ ...inkBtn, cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Upload CSV
              </label>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-500)" }}>.csv · up to 50MB</span>
            </div>
          )}
          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--paper-50)", border: "1px dashed var(--stone-300)", borderRadius: 6 }}>
            <div className="ds-label" style={{ letterSpacing: "0.1em", marginBottom: 6 }}>How to export</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-700)", lineHeight: 1.6 }}>
              LinkedIn <span style={{ color: "var(--ink-400)" }}>→</span> Settings <span style={{ color: "var(--ink-400)" }}>→</span> Data Privacy <span style={{ color: "var(--ink-400)" }}>→</span> Get a copy of your data <span style={{ color: "var(--ink-400)" }}>→</span> Connections
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
