
import { useState, useEffect } from "react";
import { Card, StatCard, ThreatBadge, Btn, Spinner, Alert } from "../components/Topbar.jsx";
import { API } from "../App.jsx";

export function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState([]);
  const [scanning,setScan]    = useState(false);
  const [msg,     setMsg]     = useState(null);

  const load = () => {
    fetch(`${API}/stats`).then(r=>r.json()).then(setStats).catch(()=>{});
    fetch(`${API}/history?pageSize=6`).then(r=>r.json()).then(d=>setHistory(d.items||[])).catch(()=>{});
  };
  useEffect(() => { load(); const id=setInterval(load,8000); return ()=>clearInterval(id); },[]);

  const quickScan = async () => {
    setScan(true); setMsg(null);
    try {
      const r = await fetch(`${API}/scan/quick`,{method:"POST"});
      const d = await r.json();
      setMsg({ type: d.threats>0?"warning":"success",
               text:`Scanned ${d.scanned} files — ${d.threats} threat(s) found` });
      load();
    } catch { setMsg({type:"error", text:"Backend unavailable"}); }
    setScan(false);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                    marginBottom:"24px" }}>
        <div>
          <h1 style={{ margin:0, fontSize:"20px", fontWeight:800,
                       fontFamily:"'Syne',sans-serif" }}>⬡ Dashboard</h1>
          <p style={{ margin:"4px 0 0", fontSize:"12px", color:"var(--muted)" }}>
            Real-time protection overview
          </p>
        </div>
        <Btn onClick={quickScan} disabled={scanning}>
          {scanning ? <><Spinner size={13}/> Scanning…</> : "⚡ Quick Scan"}
        </Btn>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
                    gap:"14px", marginBottom:"22px" }}>
        <StatCard label="Files Scanned"    value={stats?.totalFilesScanned}    color="var(--blue)"   icon="🔍"/>
        <StatCard label="Threats Detected" value={stats?.totalThreatsDetected} color="var(--red)"    icon="🚨"/>
        <StatCard label="Files Blocked"    value={stats?.totalFilesBlocked}    color="var(--yellow)" icon="🚫"/>
        <StatCard label="History Records"  value={stats?.historyCount}         color="var(--purple)" icon="📋"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px" }}>
        {/* Protection modules */}
        <Card>
          <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                        textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
            Protection Modules
          </div>
          {[
            ["Python Backend",       true,  "Flask REST API"],
            ["Ransomware ML",        stats?.ransomwareModelLoaded, "XGBoost pkl"],
            ["Phishing ML",          stats?.phishingModelLoaded,   "XGBoost pkl"],
            ["Signature Engine",     true,  "Hash + string patterns"],
            ["Entropy Analysis",     true,  "Shannon entropy"],
            ["Real-time Watcher",    true,  "watchdog library"],
            ["Kernel Driver",        false, "Not used in this stack"],
          ].map(([label, ok, note]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:"10px",
                                      padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
              <span style={{ width:"8px", height:"8px", borderRadius:"50%", flexShrink:0,
                             background: ok?"var(--green)":"var(--faint)",
                             boxShadow: ok?"0 0 6px var(--green)80":"none" }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"12px" }}>{label}</div>
                <div style={{ fontSize:"10px", color:"var(--muted)" }}>{note}</div>
              </div>
              <span style={{ fontSize:"10px", fontWeight:700,
                             color: ok?"var(--green)":"var(--faint)" }}>
                {ok?"ON":"–"}
              </span>
            </div>
          ))}
        </Card>

        {/* Recent events */}
        <Card>
          <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                        textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
            Recent Events
          </div>
          {history.length===0
            ? <div style={{ color:"var(--muted)", fontSize:"12px", paddingTop:"10px" }}>
                No threats detected ✓
              </div>
            : history.map(r => (
              <div key={r.id} style={{ display:"flex", gap:"10px", alignItems:"center",
                                       padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
                <ThreatBadge level={r.threatLevel} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:"11px", overflow:"hidden",
                                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {(r.filePath||"").split(/[\\/]/).pop() || r.filePath}
                  </div>
                  <div style={{ fontSize:"10px", color:"var(--muted)" }}>
                    {r.type} · {new Date(r.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      {stats?.serviceUptime && (
        <div style={{ marginTop:"16px", fontSize:"11px", color:"var(--faint)",
                      textAlign:"right" }}>
          Uptime: {stats.serviceUptime}
        </div>
      )}
    </div>
  );
}


export function Ransomware() {
  const [path,    setPath]    = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const scan = async () => {
    if (!path.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const r = await fetch(`${API}/scan/ransomware`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({filePath:path}),
      });
      if (r.status===404){ setError("File not found on this machine."); return; }
      setResult(await r.json());
    } catch { setError("Backend unavailable."); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:"20px", fontWeight:800,
                   fontFamily:"'Syne',sans-serif" }}>🛡 Ransomware Detection</h1>
      <p style={{ margin:"0 0 22px", fontSize:"12px", color:"var(--muted)" }}>
        XGBoost ML (6 PE features) + signature + entropy analysis
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px",
                    marginBottom:"22px" }}>
        {[
          ["🤖 ML Engine", "var(--blue)", "XGBoost trained on DllCharacteristics · DebugSize · DebugRVA · MajorLinkerVersion · MajorOSVersion · ResourceSize"],
          ["🔍 Traditional Engine","var(--purple)","Extension blacklist (30+) · SHA-256 hash DB · Ransom-note strings · Shannon entropy > 7.5 · Shadow-copy deletion patterns"],
        ].map(([title,color,desc])=>(
          <Card key={title} style={{ borderColor:`${color}30` }}>
            <div style={{ fontSize:"12px", fontWeight:700, color, marginBottom:"6px" }}>{title}</div>
            <div style={{ fontSize:"11px", color:"var(--muted)", lineHeight:1.6 }}>{desc}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom:"18px" }}>
        <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                      textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
          Scan File
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          <input value={path} onChange={e=>setPath(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&scan()}
            placeholder="C:\Users\...\suspicious.exe"
            style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)",
                     borderRadius:"8px", padding:"9px 13px", color:"var(--text)",
                     fontFamily:"inherit", fontSize:"12px" }} />
          <Btn onClick={scan} disabled={loading||!path.trim()}>
            {loading?<><Spinner size={13}/> Scanning…</>:"Scan File"}
          </Btn>
        </div>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      {result && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
          <Card style={{ border:`1px solid ${result.isThreat?"var(--red)30":"var(--green)30"}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"14px" }}>
              <span style={{ fontSize:"32px" }}>{result.isThreat?"🚨":"✅"}</span>
              <div>
                <div style={{ fontSize:"15px", fontWeight:700,
                              color:result.isThreat?"var(--red)":"var(--green)" }}>
                  {result.isThreat?"RANSOMWARE DETECTED":"No Threat Found"}
                </div>
                <div style={{ fontSize:"11px", color:"var(--muted)", marginTop:"2px" }}>
                  Confidence: {(result.confidence*100).toFixed(1)}% · {result.method}
                </div>
              </div>
              <div style={{ marginLeft:"auto" }}><ThreatBadge level={result.threatLevel}/></div>
            </div>
            <div style={{ background:"var(--bg)", borderRadius:"6px", padding:"9px 12px",
                          fontSize:"11px", color:"var(--muted)", marginBottom:"10px" }}>
              {result.details}
              {result.mlProbability!=null && (
                <span style={{ marginLeft:"12px", color:"var(--purple)" }}>
                  ML: {(result.mlProbability*100).toFixed(1)}%
                </span>
              )}
            </div>
            {result.indicators?.length>0 && (
              <>
                <div style={{ fontSize:"10px", color:"var(--faint)", textTransform:"uppercase",
                              letterSpacing:".05em", marginBottom:"5px" }}>Indicators</div>
                {result.indicators.map((ind,i)=>(
                  <div key={i} style={{ fontSize:"11px", color:"var(--muted)",
                                        padding:"3px 0", display:"flex", gap:"7px" }}>
                    <span style={{ color:"var(--red)" }}>▸</span>{ind}
                  </div>
                ))}
              </>
            )}
          </Card>

          {/* PE features card */}
          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
              PE Feature Extraction
            </div>
            {["DllCharacteristics","DebugSize","DebugRVA",
              "MajorLinkerVersion","MajorOSVersion","ResourceSize"].map(f=>(
              <div key={f} style={{ display:"flex", justifyContent:"space-between",
                                    padding:"6px 0", borderBottom:"1px solid var(--border)",
                                    fontSize:"11px" }}>
                <span style={{ color:"var(--muted)" }}>{f}</span>
                <span style={{ color:"var(--blue)", fontFamily:"monospace" }}>
                  {result.mlProbability!=null ? "extracted" : "N/A (not PE)"}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}


const EXAMPLES = [
  "http://paypal-secure-login.verify-account.com/auth",
  "http://192.168.1.1/bank/login.php",
  "https://bit.ly/3xR9kZ",
  "https://google.com",
];

export function Phishing() {
  const [url,     setUrl]     = useState("");
  const [useML,   setUseML]   = useState(true);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const scan = async () => {
    if (!url.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const r = await fetch(`${API}/scan/phishing`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({url, useML}),
      });
      setResult(await r.json());
    } catch { setError("Backend unavailable."); }
    finally { setLoading(false); }
  };

  const breakdown = (u) => {
    try {
      const p = new URL(u.startsWith("http")?u:"http://"+u);
      return [
        ["Protocol",   p.protocol],
        ["Host",       p.hostname],
        ["Port",       p.port||"default"],
        ["Path",       p.pathname||"/"],
        ["Query",      p.search||"none"],
        ["Subdomains", p.hostname.split(".").length-2],
        ["URL Length", u.length+" chars"],
      ];
    } catch { return []; }
  };

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:"20px", fontWeight:800,
                   fontFamily:"'Syne',sans-serif" }}>🔗 Phishing Detection</h1>
      <p style={{ margin:"0 0 22px", fontSize:"12px", color:"var(--muted)" }}>
        XGBoost ML (10 URL features) + heuristic analysis + manual URL inspector
      </p>

      <Card style={{ marginBottom:"18px" }}>
        <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                      textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
          Scan URL
        </div>
        <div style={{ display:"flex", gap:"10px", marginBottom:"10px" }}>
          <input value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&scan()}
            placeholder="https://suspicious-site.com/login"
            style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)",
                     borderRadius:"8px", padding:"9px 13px", color:"var(--text)",
                     fontFamily:"inherit", fontSize:"12px" }} />
          <Btn onClick={scan} disabled={loading||!url.trim()}>
            {loading?<><Spinner size={13}/> Scanning…</>:"Scan URL"}
          </Btn>
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:"9px",
                        fontSize:"11px", color:"var(--muted)", cursor:"pointer",
                        marginBottom:"12px" }}>
          <input type="checkbox" checked={useML} onChange={e=>setUseML(e.target.checked)}
            style={{ accentColor:"var(--blue)", width:"13px", height:"13px" }} />
          Use XGBoost ML model
        </label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
          {EXAMPLES.map(ex=>(
            <button key={ex} onClick={()=>setUrl(ex)} style={{
              background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"4px",
              padding:"3px 9px", fontSize:"10px", color:"var(--muted)",
              fontFamily:"monospace", cursor:"pointer",
            }}>
              {ex.length>42?ex.slice(0,42)+"…":ex}
            </button>
          ))}
        </div>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      {result && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
          <Card style={{ border:`1px solid ${result.isThreat?"var(--red)30":"var(--green)30"}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
              <span style={{ fontSize:"32px" }}>{result.isThreat?"🎣":"✅"}</span>
              <div>
                <div style={{ fontSize:"15px", fontWeight:700,
                              color:result.isThreat?"var(--red)":"var(--green)" }}>
                  {result.isThreat?"PHISHING DETECTED":"URL Appears Safe"}
                </div>
                <div style={{ fontSize:"11px", color:"var(--muted)", marginTop:"2px" }}>
                  {result.method} · {(result.confidence*100).toFixed(1)}% confidence
                  {result.mlProbability!=null && ` · ML: ${(result.mlProbability*100).toFixed(1)}%`}
                </div>
              </div>
              <div style={{ marginLeft:"auto" }}><ThreatBadge level={result.threatLevel}/></div>
            </div>
            <div style={{ background:"var(--bg)", borderRadius:"6px", padding:"9px 12px",
                          fontSize:"11px", color:"var(--muted)", marginBottom:"10px" }}>
              {result.details}
            </div>
            {result.indicators?.map((ind,i)=>(
              <div key={i} style={{ fontSize:"11px", color:"var(--muted)",
                                    padding:"3px 0", display:"flex", gap:"7px" }}>
                <span style={{ color:"var(--red)" }}>▸</span>{ind}
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
              URL Breakdown
            </div>
            {breakdown(url).map(([k,v])=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between",
                                    padding:"6px 0", borderBottom:"1px solid var(--border)",
                                    fontSize:"11px" }}>
                <span style={{ color:"var(--muted)" }}>{k}</span>
                <span style={{ color:"var(--blue)", fontFamily:"monospace",
                               maxWidth:"180px", overflow:"hidden",
                               textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}


export function TempClean() {
  const [info,     setInfo]     = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [msg,      setMsg]      = useState(null);

  const fmt = mb => mb>=1000?(mb/1024).toFixed(2)+" GB":mb.toFixed(2)+" MB";

  const doScan = async () => {
    setScanning(true); setMsg(null);
    try { setInfo(await (await fetch(`${API}/temp/scan`)).json()); }
    catch { setMsg({type:"error",text:"Backend unavailable"}); }
    finally { setScanning(false); }
  };
  const doClean = async () => {
    setCleaning(true); setMsg(null);
    try {
      const r = await (await fetch(`${API}/temp/clean`,{method:"POST"})).json();
      setMsg({type:"success",
              text:`Cleaned ${r.cleanedCount} items · Freed ${fmt(r.cleanedSizeMb)}`});
      await doScan();
    } catch { setMsg({type:"error",text:"Clean failed"}); }
    finally { setCleaning(false); }
  };
  useEffect(()=>{ doScan(); },[]);

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:"20px", fontWeight:800,
                   fontFamily:"'Syne',sans-serif" }}>🧹 Temp File Cleaner</h1>
      <p style={{ margin:"0 0 22px", fontSize:"12px", color:"var(--muted)" }}>
        Scan and remove temporary files from all Windows temp directories
      </p>

      {info && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
                      gap:"14px", marginBottom:"20px" }}>
          <StatCard label="Total Size"  value={fmt(info.totalSizeMb)} color="var(--red)"  icon="💾"/>
          <StatCard label="File Count"  value={info.fileCount}        color="var(--yellow)"icon="📄"/>
          <StatCard label="Directories" value={info.locations?.length}color="var(--blue)" icon="📁"/>
        </div>
      )}

      <div style={{ display:"flex", gap:"10px", marginBottom:"20px" }}>
        <Btn onClick={doScan}  disabled={scanning}>
          {scanning?<><Spinner size={13}/> Scanning…</>:"🔍 Rescan"}
        </Btn>
        <Btn onClick={doClean} disabled={cleaning||!info||info.fileCount===0} variant="danger">
          {cleaning?<><Spinner size={13}/> Cleaning…</>:
            `🗑 Clean All${info?` (${fmt(info.totalSizeMb)})`:""}` }
        </Btn>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {info?.locations?.length>0 && (
        <Card>
          <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                        textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
            Temp Directories
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
            <thead>
              <tr style={{ color:"var(--muted)" }}>
                {["Path","Files","Size"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"7px 0",
                                       borderBottom:"1px solid var(--border)",
                                       fontWeight:600, letterSpacing:".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.locations.map((loc,i)=>(
                <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"9px 0", fontFamily:"monospace",
                               fontSize:"10px", color:"var(--text)" }}>{loc.path}</td>
                  <td style={{ padding:"9px 0", color:"var(--muted)",
                               paddingLeft:"12px" }}>{loc.count}</td>
                  <td style={{ padding:"9px 0", color:"var(--yellow)" }}>
                    {fmt(loc.size/1024/1024)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export function History() {
  const [records,  setRecords]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [filter,   setFilter]   = useState("all");
  const [clearing, setClearing] = useState(false);

  const load = (p=1, f=filter) =>
    fetch(`${API}/history?page=${p}&pageSize=20${f!=="all"?`&type=${f}`:""}`)
      .then(r=>r.json()).then(d=>{setRecords(d.items||[]);setTotal(d.total||0);}).catch(()=>{});

  useEffect(()=>{ load(page,filter); },[page,filter]);

  const clearAll = async () => {
    if (!confirm("Clear all history?")) return;
    setClearing(true);
    await fetch(`${API}/history`,{method:"DELETE"}).catch(()=>{});
    setPage(1); await load(1,filter); setClearing(false);
  };

  const typeColor = { ransomware:"var(--red)", phishing:"var(--yellow)",
    temp_clean:"var(--green)", default:"var(--muted)" };

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:"20px", fontWeight:800,
                   fontFamily:"'Syne',sans-serif" }}>📋 Threat History</h1>
      <p style={{ margin:"0 0 20px", fontSize:"12px", color:"var(--muted)" }}>
        All detections, scans, and cleanup actions
      </p>

      <div style={{ display:"flex", gap:"10px", marginBottom:"18px", alignItems:"center" }}>
        <div style={{ display:"flex", background:"var(--surface)",
                      border:"1px solid var(--border)", borderRadius:"8px", padding:"3px" }}>
          {[["all","All"],["ransomware","Ransomware"],["phishing","Phishing"],
            ["temp_clean","Temp"]].map(([id,l])=>(
            <button key={id} onClick={()=>{setFilter(id);setPage(1);}} style={{
              background:filter===id?"var(--blue-dim)":"transparent",
              color:filter===id?"var(--blue)":"var(--muted)",
              border:"none", borderRadius:"6px", padding:"6px 13px",
              fontFamily:"inherit", fontSize:"11px", cursor:"pointer",
            }}>{l}</button>
          ))}
        </div>
        <span style={{ fontSize:"11px", color:"var(--faint)", marginLeft:"auto" }}>
          {total} record(s)
        </span>
        <Btn onClick={clearAll} disabled={clearing} variant="danger"
             style={{ padding:"7px 13px", fontSize:"11px" }}>
          {clearing?"Clearing…":"🗑 Clear"}
        </Btn>
      </div>

      <Card style={{ padding:0, overflow:"hidden" }}>
        {records.length===0
          ? <div style={{ padding:"36px", textAlign:"center", color:"var(--muted)" }}>
              No records found ✓
            </div>
          : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
              <thead>
                <tr style={{ background:"var(--bg)" }}>
                  {["Time","Type","Path / URL","Level","Method","Status"].map(h=>(
                    <th key={h} style={{ padding:"11px 14px", textAlign:"left",
                                         color:"var(--muted)", fontWeight:600,
                                         letterSpacing:".04em",
                                         borderBottom:"1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r=>(
                  <tr key={r.id} style={{ borderBottom:"1px solid var(--border)" }}>
                    <td style={{ padding:"9px 14px", color:"var(--muted)", whiteSpace:"nowrap" }}>
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding:"9px 14px" }}>
                      <span style={{ color:typeColor[r.type]||typeColor.default,
                                     background:"var(--bg)", border:"1px solid var(--border)",
                                     borderRadius:"4px", padding:"2px 7px", fontSize:"10px" }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding:"9px 14px", fontFamily:"monospace", fontSize:"10px",
                                 maxWidth:"240px", overflow:"hidden",
                                 textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {r.filePath||"–"}
                    </td>
                    <td style={{ padding:"9px 14px" }}><ThreatBadge level={r.threatLevel}/></td>
                    <td style={{ padding:"9px 14px", color:"var(--muted)" }}>
                      {r.detectionMethod||"–"}
                    </td>
                    <td style={{ padding:"9px 14px" }}>
                      <span style={{ fontSize:"10px", fontWeight:700,
                        color:{detected:"var(--yellow)",blocked:"var(--red)",
                               cleaned:"var(--green)",allowed:"var(--faint)"}[r.status]||"var(--muted)" }}>
                        {r.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </Card>

      {total>20 && (
        <div style={{ display:"flex", gap:"6px", marginTop:"14px", justifyContent:"center" }}>
          {Array.from({length:Math.min(Math.ceil(total/20),8)},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>setPage(p)} style={{
              background:page===p?"var(--blue-dim)":"var(--surface)",
              color:page===p?"var(--blue)":"var(--muted)",
              border:"1px solid var(--border)", borderRadius:"6px",
              padding:"5px 11px", fontFamily:"inherit", fontSize:"11px", cursor:"pointer",
            }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Settings() {
  const [cfg,    setCfg]    = useState({
    level:2, blockOnSuspicious:true, enableRansomwareHeuristics:true,
    enableEntropyCheck:true, monitorRegistry:false, monitorNetwork:false,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(()=>{
    fetch(`${API}/protection/level`).then(r=>r.json()).then(setCfg).catch(()=>{});
  },[]);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await fetch(`${API}/protection/level`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify(cfg),
      });
      setSaved(true); setTimeout(()=>setSaved(false),3000);
    } catch {}
    setSaving(false);
  };

  const Toggle = ({label,desc,k}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"12px 0", borderBottom:"1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize:"12px" }}>{label}</div>
        {desc&&<div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"2px" }}>{desc}</div>}
      </div>
      <div onClick={()=>setCfg(p=>({...p,[k]:!p[k]}))} style={{
        width:"38px", height:"20px", borderRadius:"10px", cursor:"pointer",
        background:cfg[k]?"var(--blue-dim)":"var(--faint)", position:"relative",
        border:`1px solid ${cfg[k]?"var(--blue)":"var(--border)"}`, transition:"all .2s",
      }}>
        <div style={{
          position:"absolute", top:"2px", left:cfg[k]?"18px":"2px",
          width:"14px", height:"14px", borderRadius:"50%",
          background:cfg[k]?"var(--blue)":"var(--muted)", transition:"all .2s",
        }}/>
      </div>
    </div>
  );

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:"20px", fontWeight:800,
                   fontFamily:"'Syne',sans-serif" }}>⚙ Settings</h1>
      <p style={{ margin:"0 0 22px", fontSize:"12px", color:"var(--muted)" }}>
        Configure detection engines and protection behaviour
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px" }}>
        <Card>
          <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                        textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
            Protection Level
          </div>
          {[[0,"Off","No active scanning"],
            [1,"Passive","Monitor and log only"],
            [2,"Active","Block threats (Recommended)"],
            [3,"Aggressive","Block all suspicious activity"]].map(([v,name,desc])=>(
            <div key={v} onClick={()=>setCfg(p=>({...p,level:v}))} style={{
              display:"flex", gap:"12px", padding:"11px", borderRadius:"8px",
              cursor:"pointer", marginBottom:"5px",
              background:cfg.level===v?"var(--blue-dim)":"transparent",
              border:`1px solid ${cfg.level===v?"var(--blue)30":"transparent"}`,
              transition:"all .15s",
            }}>
              <div style={{ width:"18px", height:"18px", borderRadius:"50%", flexShrink:0,
                            border:`2px solid ${cfg.level===v?"var(--blue)":"var(--faint)"}`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            marginTop:"1px" }}>
                {cfg.level===v&&<div style={{ width:"8px",height:"8px",
                  borderRadius:"50%",background:"var(--blue)" }}/>}
              </div>
              <div>
                <div style={{ fontSize:"12px", fontWeight:cfg.level===v?700:400,
                              color:cfg.level===v?"var(--blue)":"var(--text)" }}>
                  Level {v}: {name}
                </div>
                <div style={{ fontSize:"10px", color:"var(--muted)" }}>{desc}</div>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"4px" }}>
              Detection Features
            </div>
            <Toggle k="blockOnSuspicious"          label="Block on Suspicious"
              desc="Block files flagged as threats"/>
            <Toggle k="enableRansomwareHeuristics" label="Ransomware Heuristics"
              desc="Extension + string pattern checks"/>
            <Toggle k="enableEntropyCheck"         label="Entropy Analysis"
              desc="Flag high-entropy files (> 7.5 bits)"/>
            <Toggle k="monitorRegistry"            label="Registry Monitor"
              desc="Watch for persistence keys (future)"/>
            <Toggle k="monitorNetwork"             label="Network Monitor"
              desc="C2 IP detection (future)"/>
          </Card>

          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
              Stack Info
            </div>
            {[["Backend","Python 3 + Flask"],["ML Engine","XGBoost (pkl)"],
              ["Frontend","React 18 + Vite"],["Desktop","Electron"],
              ["File Watch","watchdog library"],["Installer","PyInstaller + electron-builder"],
            ].map(([k,v])=>(
              <div key={k} style={{ display:"flex", gap:"12px", padding:"6px 0",
                                    borderBottom:"1px solid var(--border)", fontSize:"11px" }}>
                <span style={{ color:"var(--muted)", minWidth:"90px" }}>{k}</span>
                <span style={{ fontFamily:"monospace", color:"var(--blue)", fontSize:"10px" }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <div style={{ display:"flex", gap:"12px", marginTop:"20px", alignItems:"center" }}>
        <Btn onClick={save} disabled={saving}>
          {saving?"Saving…":"💾 Save Settings"}
        </Btn>
        {saved && <span style={{ fontSize:"12px", color:"var(--green)" }}>
          ✓ Saved successfully
        </span>}
      </div>
    </div>
  );
}

export default Dashboard;
