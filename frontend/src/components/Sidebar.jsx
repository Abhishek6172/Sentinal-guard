// components/Sidebar.jsx
const NAV = [
  { id:"dashboard",  icon:"⬡", label:"Dashboard"   },
  { id:"defender",   icon:"🪟", label:"Defender"     },
  { id:"ransomware", icon:"🛡", label:"Ransomware"   },
  { id:"phishing",   icon:"🔗", label:"Phishing"     },
  { id:"temp",       icon:"🧹", label:"Temp Cleaner" },
  { id:"history",    icon:"📋", label:"History"      },
  { id:"settings",   icon:"⚙",  label:"Settings"     },
];

export default function Sidebar({ page, onNav, health }) {
  const loading  = health === null;           // still fetching
  const online   = health?.status === "ok";
 const mlRansom = Boolean(health?.ransomwareModel);
const mlPhish  = Boolean(health?.phishingModel);
  const defender = health?.defenderAvailable;

  const pill = (ok, loadingText="…", onText, offText) => {
    if (loading) return { color:"var(--muted)", bg:"var(--faint)", text: loadingText };
    return ok
      ? { color:"var(--green)", bg:"var(--green-dim)", text: onText }
      : { color:"var(--muted)", bg:"var(--faint)",     text: offText };
  };

  return (
    <aside style={{
      width:"220px", background:"var(--surface)", borderRight:"1px solid var(--border)",
      display:"flex", flexDirection:"column", flexShrink:0, userSelect:"none",
    }}>
      {/* Logo */}
      <div style={{ padding:"22px 18px 16px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px" }}>
          <div style={{ width:"36px", height:"36px", borderRadius:"10px",
                        background:"var(--blue-dim)", border:"1px solid var(--blue)30",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"18px" }}>🛡</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:"15px",
                          color:"var(--blue)", letterSpacing:".02em" }}>SentinelGuard</div>
            <div style={{ fontSize:"10px", color:"var(--muted)" }}>Python · v2.0</div>
          </div>
        </div>

        {/* Status pills */}
        {[
          ["Service",   pill(online,   "…",  "Running",  "Offline")],
          ["ML Ransom", pill(mlRansom, "…",  "Loaded",   "No model")],
          ["ML Phish",  pill(mlPhish,  "…",  "Loaded",   "No model")],
          ["Defender",  pill(defender, "…",  "Available","Not found")],
        ].map(([label, style]) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between",
                                    alignItems:"center", marginBottom:"5px" }}>
            <span style={{ fontSize:"11px", color:"var(--muted)" }}>{label}</span>
            <span style={{ fontSize:"10px", fontWeight:600,
                           color:style.color, background:style.bg,
                           padding:"1px 7px", borderRadius:"4px",
                           animation: loading ? "pulse 1.5s ease-in-out infinite" : "none" }}>
              {style.text}
            </span>
          </div>
        ))}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"10px 10px" }}>
        {NAV.map(n => {
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => onNav(n.id)} style={{
              display:"flex", alignItems:"center", gap:"11px", width:"100%",
              padding:"10px 12px", borderRadius:"8px", border:"none",
              cursor:"pointer", textAlign:"left", fontSize:"12.5px",
              fontFamily:"inherit", marginBottom:"2px",
              background: active ? "var(--blue-dim)" : "transparent",
              color:      active ? "var(--blue)"     : "var(--muted)",
              fontWeight: active ? 700 : 400,
              transition:"all .15s",
              borderLeft: active ? "3px solid var(--blue)" : "3px solid transparent",
            }}>
              <span style={{ fontSize:"15px", width:"18px", textAlign:"center" }}>{n.icon}</span>
              {n.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding:"14px 18px", borderTop:"1px solid var(--border)",
                    fontSize:"10px", color:"var(--faint)" }}>
        Python + Flask + Electron<br/>No kernel driver required
      </div>
    </aside>
  );
}
