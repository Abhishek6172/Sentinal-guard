// components/Topbar.jsx
export default function Topbar({ health }) {
  const online = health?.status === "ok";
  return (
    <div style={{
      height:"40px", background:"var(--surface)", borderBottom:"1px solid var(--border)",
      display:"flex", alignItems:"center", padding:"0 24px", gap:"20px",
      fontSize:"11px", color:"var(--muted)", flexShrink:0,
    }}>
      <span style={{ color:"var(--blue)", fontWeight:700, fontFamily:"'Syne',sans-serif",
                     letterSpacing:".06em", fontSize:"12px" }}>
        SENTINEL GUARD
      </span>
      <span style={{ color:"var(--border2)" }}>|</span>
      <span>
        Backend:{" "}
        <span style={{ color: online ? "var(--green)" : "var(--red)",
                       fontWeight:600 }}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </span>
      {health?.stack && (
        <>
          <span style={{ color:"var(--border2)" }}>|</span>
          <span>Stack: <span style={{ color:"var(--purple)" }}>{health.stack}</span></span>
        </>
      )}
      <span style={{ marginLeft:"auto" }}>
        {new Date().toLocaleDateString("en-IN",
          { weekday:"short", year:"numeric", month:"short", day:"numeric" })}
      </span>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

export function Card({ children, style={} }) {
  return (
    <div style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"12px", padding:"22px", ...style,
    }}>
      {children}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom:"26px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <span style={{ fontSize:"26px" }}>{icon}</span>
        <div>
          <h1 style={{ margin:0, fontSize:"20px", fontWeight:800,
                       fontFamily:"'Syne',sans-serif", color:"var(--text)" }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin:"3px 0 0", fontSize:"12px", color:"var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThreatBadge({ level }) {
  const map = {
    None:     ["var(--faint)",      "var(--muted)"],
    Low:      ["var(--green-dim)",  "var(--green)"],
    Medium:   ["var(--yellow-dim)", "var(--yellow)"],
    High:     ["var(--red-dim)",    "var(--red)"],
    Critical: ["#2d0a0a",           "var(--red)"],
  };
  const [bg, fg] = map[level] ?? map.None;
  return (
    <span style={{ background:bg, color:fg, padding:"2px 9px", borderRadius:"4px",
                   fontSize:"10px", fontWeight:700, letterSpacing:".05em" }}>
      {(level||"NONE").toUpperCase()}
    </span>
  );
}

export function Spinner({ size=16 }) {
  return (
    <span style={{
      display:"inline-block", width:`${size}px`, height:`${size}px`,
      border:"2px solid var(--blue-dim)", borderTopColor:"var(--blue)",
      borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0,
    }} />
  );
}

export function Btn({ children, onClick, disabled, variant="primary", style={} }) {
  const variants = {
    primary: ["var(--blue-dim)",   "var(--blue)",   "var(--blue)30"],
    danger:  ["var(--red-dim)",    "var(--red)",    "var(--red)30"],
    success: ["var(--green-dim)",  "var(--green)",  "var(--green)30"],
    ghost:   ["transparent",       "var(--muted)",  "var(--border)"],
  };
  const [bg, fg, border] = variants[variant] ?? variants.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:bg, color:fg, border:`1px solid ${border}`,
      borderRadius:"8px", padding:"9px 18px", cursor:disabled?"not-allowed":"pointer",
      fontFamily:"inherit", fontSize:"12.5px", fontWeight:600,
      opacity:disabled?.5:1, transition:"all .15s",
      display:"inline-flex", alignItems:"center", gap:"7px", ...style,
    }}>
      {children}
    </button>
  );
}

export function Alert({ type="info", children }) {
  const map = {
    info:    ["var(--blue-dim)",   "var(--blue)",   "ℹ"],
    success: ["var(--green-dim)",  "var(--green)",  "✓"],
    warning: ["var(--yellow-dim)", "var(--yellow)", "⚠"],
    error:   ["var(--red-dim)",    "var(--red)",    "✗"],
  };
  const [bg, fg, icon] = map[type] ?? map.info;
  return (
    <div style={{ background:bg, border:`1px solid ${fg}30`, borderRadius:"8px",
                  padding:"12px 16px", color:fg, fontSize:"12px",
                  display:"flex", gap:"10px", alignItems:"flex-start",
                  marginBottom:"16px" }}>
      <span style={{ flexShrink:0, fontWeight:700 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function IndicatorList({ items=[] }) {
  if (!items.length) return null;
  return (
    <ul style={{ margin:"10px 0 0", padding:0, listStyle:"none" }}>
      {items.map((it,i) => (
        <li key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start",
                             fontSize:"11.5px", color:"var(--muted)", marginBottom:"5px" }}>
          <span style={{ color:"var(--red)", flexShrink:0, marginTop:"1px" }}>▸</span>
          {it}
        </li>
      ))}
    </ul>
  );
}

export function StatCard({ label, value, color="var(--blue)", icon }) {
  return (
    <Card style={{ textAlign:"center", padding:"20px 16px" }}>
      {icon && <div style={{ fontSize:"22px", marginBottom:"8px" }}>{icon}</div>}
      <div style={{ fontSize:"30px", fontWeight:700, color, fontFamily:"'Syne',sans-serif" }}>
        {value ?? "–"}
      </div>
      <div style={{ fontSize:"11px", color:"var(--muted)", marginTop:"4px" }}>{label}</div>
    </Card>
  );
}
