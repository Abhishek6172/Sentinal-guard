// pages/Defender.jsx  –  Windows Defender Control Panel
import { useState, useEffect } from "react";
import { Card, Btn, Spinner, Alert, ThreatBadge } from "../components/Topbar.jsx";
import { API } from "../App.jsx";

export default function Defender() {
  const [status,      setStatus]      = useState(null);
  const [quarantine,  setQuarantine]  = useState(null);
  const [threats,     setThreats]     = useState([]);
  const [blockedUrls, setBlockedUrls] = useState([]);
  const [tab,         setTab]         = useState("status");
  const [loading,     setLoading]     = useState({});
  const [msg,         setMsg]         = useState(null);
  const [urlInput,    setUrlInput]    = useState("");
  const [fileInput,   setFileInput]   = useState("");
  const [folderInput, setFolderInput] = useState("");
  const [exclInput,   setExclInput]   = useState("");

  const setLoad  = (k,v) => setLoading(p=>({...p,[k]:v}));
  const showMsg  = (type,text) => { setMsg({type,text}); setTimeout(()=>setMsg(null),5000); };

  const load = async () => {
    fetch(`${API}/defender/status`).then(r=>r.json()).then(setStatus).catch(()=>{});
    fetch(`${API}/defender/quarantine`).then(r=>r.json()).then(setQuarantine).catch(()=>{});
    fetch(`${API}/defender/threats`).then(r=>r.json()).then(setThreats).catch(()=>[]);
    fetch(`${API}/defender/blocked-urls`).then(r=>r.json())
      .then(d=>setBlockedUrls(d.blockedUrls||[])).catch(()=>{});
  };
  useEffect(()=>{ load(); },[]);

  const apiPost = async (endpoint, body={}, loadKey="") => {
    if(loadKey) setLoad(loadKey,true);
    try {
      const r = await fetch(`${API}${endpoint}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      const d = await r.json();
      if(loadKey) setLoad(loadKey,false);
      return d;
    } catch(e) {
      if(loadKey) setLoad(loadKey,false);
      return {success:false,message:String(e)};
    }
  };

  const quickScan  = async () => { const r=await apiPost("/defender/scan/quick",{},"qscan");  showMsg(r.success?"success":"error", r.message||r.output||"Done"); };
  const fullScan   = async () => { const r=await apiPost("/defender/scan/full", {},"fscan");  showMsg(r.success?"success":"error", r.message||"Full scan started"); };
  const customScan = async () => {
    if(!folderInput.trim()) return;
    const r=await apiPost("/defender/scan/custom",{folder:folderInput},"cscan");
    showMsg(r.success?"success":"error", r.message||"Done");
  };
  const updateDefs = async () => { const r=await apiPost("/defender/update",{},"update"); showMsg(r.success?"success":"error",r.output||"Done"); };
  const toggleRT   = async (en)  => { const r=await apiPost("/defender/realtime",{enabled:en},"rt"); showMsg(r.success?"success":"warning",`Real-time protection ${en?"enabled":"disabled"}`); await load(); };
  const blockUrlFn = async () => {
    if(!urlInput.trim()) return;
    const r=await apiPost("/defender/block-url",{url:urlInput},"burl");
    showMsg(r.success?"success":"error",r.message); if(r.success){ setUrlInput(""); load(); }
  };
  const unblockUrl = async (line) => {
    const host=line.split("\t")[1]?.trim();
    if(!host) return;
    const r=await apiPost("/defender/unblock-url",{url:host});
    showMsg(r.success?"success":"error",r.message); load();
  };
  const quarantineFile = async () => {
    if(!fileInput.trim()) return;
    const r=await apiPost("/defender/quarantine/file",{filePath:fileInput},"qfile");
    showMsg(r.success?"success":"error",r.output||r.message); if(r.success){ setFileInput(""); load(); }
  };
  const restoreFile = async (filename) => {
    const r=await apiPost("/defender/quarantine/restore",{filename});
    showMsg(r.success?"success":"error",r.restoredTo?`Restored to: ${r.restoredTo}`:r.message); load();
  };
  const addExclusion = async () => {
    if(!exclInput.trim()) return;
    const r=await apiPost("/defender/exclusion",{path:exclInput},"excl");
    showMsg(r.success?"success":"error",r.output||r.message); if(r.success) setExclInput("");
  };

  const StatusPill = ({ok,label}) => (
    <span style={{ fontSize:"11px", fontWeight:700,
      background:ok===true?"var(--green-dim)":ok===false?"var(--red-dim)":"var(--faint)",
      color:ok===true?"var(--green)":ok===false?"var(--red)":"var(--muted)",
      padding:"2px 9px", borderRadius:"4px" }}>
      {ok===true?"ON":ok===false?"OFF":label||"UNKNOWN"}
    </span>
  );

  const TABS = [
    ["status","🛡 Status"],["scan","🔍 Scan"],["quarantine","📦 Quarantine"],
    ["urls","🔗 Block URLs"],["threats","⚠ Threats"],["settings","⚙ Settings"],
  ];

  return (
    <div>
      <div style={{ marginBottom:"22px" }}>
        <h1 style={{ margin:0, fontSize:"20px", fontWeight:800,
                     fontFamily:"'Syne',sans-serif" }}>🛡 Windows Defender</h1>
        <p style={{ margin:"4px 0 0", fontSize:"12px", color:"var(--muted)" }}>
          Integrated blocking, quarantine, URL blocking and signature management
        </p>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {/* Tab bar */}
      <div style={{ display:"flex", gap:"0", background:"var(--surface)",
                    border:"1px solid var(--border)", borderRadius:"8px",
                    padding:"3px", marginBottom:"20px", flexWrap:"wrap" }}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            background:tab===id?"var(--blue-dim)":"transparent",
            color:tab===id?"var(--blue)":"var(--muted)",
            border:"none", borderRadius:"6px", padding:"7px 14px",
            fontFamily:"inherit", fontSize:"11px", cursor:"pointer", fontWeight:600,
          }}>{label}</button>
        ))}
      </div>

      {/* ── STATUS TAB ─────────────────────────────────────────────────────── */}
      {tab==="status" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
              Defender Status
            </div>
            {status ? (
              <>
                {[
                  ["Service Available",      status.available],
                  ["Antivirus Enabled",      status.AntivirusEnabled],
                  ["Real-time Protection",   status.RealTimeProtectionEnabled],
                  ["Behaviour Monitor",      status.BehaviorMonitorEnabled],
                  ["Download Protection",    status.IoavProtectionEnabled],
                  ["Tamper Protection",      status.IsTamperProtected],
                ].map(([label,val])=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between",
                                            alignItems:"center", padding:"9px 0",
                                            borderBottom:"1px solid var(--border)" }}>
                    <span style={{ fontSize:"12px" }}>{label}</span>
                    <StatusPill ok={val} />
                  </div>
                ))}
                <div style={{ padding:"9px 0", fontSize:"11px", color:"var(--muted)" }}>
                  <div>Signature version: <span style={{ color:"var(--blue)" }}>
                    {status.AntivirusSignatureVersion||"Unknown"}</span></div>
                  <div style={{ marginTop:"4px" }}>Last updated: <span style={{ color:"var(--blue)" }}>
                    {status.AntivirusSignatureLastUpdated
                      ? new Date(status.AntivirusSignatureLastUpdated).toLocaleString()
                      : "Unknown"}</span></div>
                </div>
                {status.error && (
                  <div style={{ fontSize:"11px", color:"var(--yellow)", marginTop:"8px" }}>
                    ⚠ {status.error}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:"flex", gap:"10px", alignItems:"center",
                            color:"var(--muted)", fontSize:"12px" }}>
                <Spinner size={14}/> Loading status…
              </div>
            )}
          </Card>

          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
              Quick Actions
            </div>
            {[
              ["⚡ Quick Scan",      quickScan,  "qscan",  "primary"],
              ["🔄 Update Signatures",updateDefs,"update",  "primary"],
              ["▶ Enable Real-time", ()=>toggleRT(true), "rt","success"],
              ["⏸ Disable Real-time",()=>toggleRT(false),"rt","danger"],
            ].map(([label,fn,key,variant])=>(
              <Btn key={label} onClick={fn} disabled={loading[key]} variant={variant}
                   style={{ width:"100%", marginBottom:"8px", justifyContent:"center" }}>
                {loading[key]?<><Spinner size={13}/> Working…</>:label}
              </Btn>
            ))}
            <div style={{ marginTop:"8px", fontSize:"10px", color:"var(--faint)",
                          lineHeight:1.5 }}>
              ⚠ Real-time toggle and signature updates require Administrator privileges.
            </div>
          </Card>
        </div>
      )}

      {/* ── SCAN TAB ───────────────────────────────────────────────────────── */}
      {tab==="scan" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"14px" }}>
          {[
            { title:"⚡ Quick Scan", desc:"Scan most commonly infected locations", fn:quickScan, key:"qscan", label:"Start Quick Scan" },
            { title:"🔍 Full Scan",  desc:"Complete scan of entire system (hours)", fn:fullScan,  key:"fscan", label:"Start Full Scan", variant:"danger" },
          ].map(({title,desc,fn,key,label,variant="primary"})=>(
            <Card key={title}>
              <div style={{ fontSize:"13px", fontWeight:700, marginBottom:"6px" }}>{title}</div>
              <div style={{ fontSize:"11px", color:"var(--muted)", marginBottom:"14px",
                            lineHeight:1.5 }}>{desc}</div>
              <Btn onClick={fn} disabled={loading[key]} variant={variant}
                   style={{ width:"100%", justifyContent:"center" }}>
                {loading[key]?<><Spinner size={13}/> Running…</>:label}
              </Btn>
            </Card>
          ))}
          <Card>
            <div style={{ fontSize:"13px", fontWeight:700, marginBottom:"6px" }}>
              📁 Custom Folder Scan
            </div>
            <div style={{ fontSize:"11px", color:"var(--muted)", marginBottom:"12px",
                          lineHeight:1.5 }}>
              Scan a specific folder or file path
            </div>
            <input value={folderInput} onChange={e=>setFolderInput(e.target.value)}
              placeholder="C:\Users\...\Downloads"
              style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)",
                       borderRadius:"6px", padding:"8px 10px", color:"var(--text)",
                       fontFamily:"inherit", fontSize:"11px", marginBottom:"8px" }}/>
            <Btn onClick={customScan} disabled={loading.cscan||!folderInput.trim()}
                 style={{ width:"100%", justifyContent:"center" }}>
              {loading.cscan?<><Spinner size={13}/> Scanning…</>:"Scan Folder"}
            </Btn>
          </Card>
        </div>
      )}

      {/* ── QUARANTINE TAB ─────────────────────────────────────────────────── */}
      {tab==="quarantine" && (
        <div>
          {/* Manual quarantine input */}
          <Card style={{ marginBottom:"16px" }}>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
              Quarantine a File Manually
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <input value={fileInput} onChange={e=>setFileInput(e.target.value)}
                placeholder="C:\Users\...\suspicious.exe"
                style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)",
                         borderRadius:"8px", padding:"9px 12px", color:"var(--text)",
                         fontFamily:"inherit", fontSize:"12px" }}/>
              <Btn onClick={quarantineFile} disabled={loading.qfile||!fileInput.trim()} variant="danger">
                {loading.qfile?<><Spinner size={13}/> Quarantining…</>:"Quarantine"}
              </Btn>
            </div>
          </Card>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
            {/* SentinelGuard quarantine */}
            <Card>
              <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                            textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
                SentinelGuard Quarantine ({quarantine?.sentinelItems?.length||0})
              </div>
              {!quarantine?.sentinelItems?.length
                ? <div style={{ color:"var(--muted)", fontSize:"12px" }}>No quarantined files ✓</div>
                : quarantine.sentinelItems.map(item=>(
                  <div key={item.name} style={{ padding:"9px 0",
                                                borderBottom:"1px solid var(--border)" }}>
                    <div style={{ fontSize:"11px", fontFamily:"monospace",
                                  overflow:"hidden", textOverflow:"ellipsis",
                                  whiteSpace:"nowrap", marginBottom:"4px" }}>
                      {item.name}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between",
                                  alignItems:"center" }}>
                      <span style={{ fontSize:"10px", color:"var(--muted)" }}>
                        {(item.size/1024).toFixed(1)} KB ·{" "}
                        {new Date(item.quarantined).toLocaleDateString()}
                      </span>
                      <Btn onClick={()=>restoreFile(item.name)} variant="ghost"
                           style={{ padding:"3px 10px", fontSize:"10px" }}>
                        Restore
                      </Btn>
                    </div>
                  </div>
                ))
              }
            </Card>

            {/* Defender quarantine */}
            <Card>
              <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                            textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
                Windows Defender Threats ({quarantine?.defenderItems?.length||0})
              </div>
              {!quarantine?.defenderItems?.length
                ? <div style={{ color:"var(--muted)", fontSize:"12px" }}>
                    No Defender threats detected ✓
                  </div>
                : quarantine.defenderItems.map((item,i)=>(
                  <div key={i} style={{ padding:"9px 0",
                                        borderBottom:"1px solid var(--border)" }}>
                    <div style={{ fontSize:"11px", color:"var(--red)",
                                  marginBottom:"3px" }}>{item.name}</div>
                    <div style={{ fontSize:"10px", color:"var(--muted)" }}>
                      Severity: {item.severity} ·{" "}
                      {item.detected
                        ? new Date(item.detected).toLocaleDateString() : "–"}
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>
        </div>
      )}

      {/* ── BLOCK URLS TAB ─────────────────────────────────────────────────── */}
      {tab==="urls" && (
        <div>
          <Card style={{ marginBottom:"16px" }}>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
              Block a URL (hosts file)
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <input value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&blockUrlFn()}
                placeholder="http://phishing-site.com"
                style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)",
                         borderRadius:"8px", padding:"9px 12px", color:"var(--text)",
                         fontFamily:"inherit", fontSize:"12px" }}/>
              <Btn onClick={blockUrlFn} disabled={loading.burl||!urlInput.trim()} variant="danger">
                {loading.burl?<><Spinner size={13}/> Blocking…</>:"Block URL"}
              </Btn>
            </div>
            <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)" }}>
              Adds the hostname to <code style={{ color:"var(--blue)" }}>
              C:\Windows\System32\drivers\etc\hosts</code> pointing to 127.0.0.1.
              Requires Administrator privileges.
            </div>
          </Card>

          <Card>
            <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:".06em", marginBottom:"12px" }}>
              Currently Blocked URLs ({blockedUrls.length})
            </div>
            {blockedUrls.length===0
              ? <div style={{ color:"var(--muted)", fontSize:"12px" }}>
                  No URLs blocked yet ✓
                </div>
              : blockedUrls.map((line,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                      alignItems:"center", padding:"8px 0",
                                      borderBottom:"1px solid var(--border)" }}>
                  <code style={{ fontSize:"11px", color:"var(--red)" }}>{line}</code>
                  <Btn onClick={()=>unblockUrl(line)} variant="ghost"
                       style={{ padding:"3px 10px", fontSize:"10px" }}>
                    Unblock
                  </Btn>
                </div>
              ))
            }
          </Card>
        </div>
      )}

      {/* ── THREATS TAB ────────────────────────────────────────────────────── */}
      {tab==="threats" && (
        <Card>
          <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                        textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
            Windows Defender Threat History
          </div>
          {threats.length===0
            ? <div style={{ color:"var(--muted)", fontSize:"12px" }}>
                No threats in Defender history ✓
              </div>
            : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
                <thead>
                  <tr>
                    {["Process","User","Detected","Remediated","Success"].map(h=>(
                      <th key={h} style={{ textAlign:"left", padding:"8px 0",
                                           borderBottom:"1px solid var(--border)",
                                           color:"var(--muted)", fontWeight:600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {threats.map((t,i)=>(
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"8px 0", color:"var(--red)",
                                   fontFamily:"monospace", fontSize:"10px" }}>
                        {t.ProcessName||"–"}
                      </td>
                      <td style={{ padding:"8px 0", color:"var(--muted)" }}>
                        {t.DomainUser||"–"}
                      </td>
                      <td style={{ padding:"8px 0", color:"var(--muted)", fontSize:"10px" }}>
                        {t.InitialDetectionTime
                          ? new Date(t.InitialDetectionTime).toLocaleString() : "–"}
                      </td>
                      <td style={{ padding:"8px 0", color:"var(--muted)", fontSize:"10px" }}>
                        {t.RemediationTime
                          ? new Date(t.RemediationTime).toLocaleString() : "–"}
                      </td>
                      <td style={{ padding:"8px 0" }}>
                        <span style={{ fontSize:"10px", fontWeight:700,
                          color:t.ActionSuccess?"var(--green)":"var(--red)" }}>
                          {t.ActionSuccess?"YES":"NO"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Card>
      )}

      {/* ── SETTINGS TAB ───────────────────────────────────────────────────── */}
      {tab==="settings" && (
        <Card>
          <div style={{ fontSize:"11px", color:"var(--muted)", fontWeight:700,
                        textTransform:"uppercase", letterSpacing:".06em", marginBottom:"14px" }}>
            Add Exclusion Path
          </div>
          <div style={{ display:"flex", gap:"10px", marginBottom:"20px" }}>
            <input value={exclInput} onChange={e=>setExclInput(e.target.value)}
              placeholder="C:\MyApp\  or  C:\MyApp\myfile.exe"
              style={{ flex:1, background:"var(--bg)", border:"1px solid var(--border)",
                       borderRadius:"8px", padding:"9px 12px", color:"var(--text)",
                       fontFamily:"inherit", fontSize:"12px" }}/>
            <Btn onClick={addExclusion} disabled={loading.excl||!exclInput.trim()} variant="success">
              {loading.excl?<><Spinner size={13}/> Adding…</>:"Add Exclusion"}
            </Btn>
          </div>
          <Alert type="warning">
            Exclusions tell Windows Defender to skip scanning a path entirely.
            Use with caution — adding malicious folders defeats protection.
            Requires Administrator privileges.
          </Alert>
          <Alert type="info">
            All Defender operations that modify system settings (real-time protection,
            exclusions, quarantine restore) require SentinelGuard to be running as
            Administrator. Right-click run_dev.bat → Run as Administrator.
          </Alert>
        </Card>
      )}
    </div>
  );
}
