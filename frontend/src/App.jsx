import { useState, useEffect } from "react";
import Sidebar    from "./components/Sidebar.jsx";
import Topbar     from "./components/Topbar.jsx";
import Dashboard  from "./pages/Dashboard.jsx";
import Ransomware from "./pages/Ransomware.jsx";
import Phishing   from "./pages/Phishing.jsx";
import TempClean  from "./pages/TempClean.jsx";
import History    from "./pages/History.jsx";
import Settings   from "./pages/Settings.jsx";
import Defender   from "./pages/Defender.jsx";


export const API = window.location.protocol === "file:"
  ? "http://127.0.0.1:57432/api"
  : "/api";

const PAGES = {
  dashboard: Dashboard, ransomware: Ransomware,
  phishing:  Phishing,  temp:       TempClean,
  history:   History,   settings:   Settings,
  defender:  Defender,
};

export default function App() {
  const [page,    setPage]    = useState("dashboard");
  const [health,  setHealth]  = useState(null);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    let mounted   = true;
    let attempts  = 0;
    const MAX     = 20;   // try up to 20 times on startup
    let intervalId = null;

    const check = () => {
      fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.json())
        .then(d => {
          if (!mounted) return;
          setHealth(d);
          attempts = 0; // reset on success
        })
        .catch(() => {
          if (!mounted) return;
          attempts++;
          if (attempts <= MAX) {
            // still starting up — keep health as null (loading state)
            setRetries(attempts);
          } else {
            // give up — mark as offline
            setHealth(prev => prev ? { ...prev, status:"offline" } : { status:"offline" });
          }
        });
    };


    check();
    intervalId = setInterval(check, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const Page = PAGES[page] ?? Dashboard;


  if (health === null) {
    return (
      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", height:"100vh",
        background:"var(--bg)", color:"var(--text)", gap:"16px",
      }}>
        <div style={{ fontSize:"52px", animation:"pulse 1.5s ease-in-out infinite" }}>🛡</div>
        <div style={{
          fontFamily:"'Syne',sans-serif", fontSize:"24px",
          fontWeight:800, color:"var(--blue)"
        }}>
          SentinelGuard
        </div>
        <div style={{ fontSize:"13px", color:"var(--muted)" }}>
          Starting protection engine...
        </div>
        <div style={{
          width:"200px", height:"3px", background:"var(--border)",
          borderRadius:"2px", overflow:"hidden"
        }}>
          <div style={{
            height:"100%", background:"var(--blue)",
            animation:"slide 1.4s ease-in-out infinite",
          }}/>
        </div>
        {retries > 3 && (
          <div style={{ fontSize:"11px", color:"var(--faint)" }}>
            Waiting for backend... ({retries})
          </div>
        )}
        <style>{`
          @keyframes slide {
            0%   { width:0%;   margin-left:0% }
            50%  { width:60%;  margin-left:20% }
            100% { width:0%;   margin-left:100% }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
      <Sidebar page={page} onNav={setPage} health={health} />
      <div style={{
        flex:1, display:"flex", flexDirection:"column",
        overflow:"hidden", background:"var(--bg)"
      }}>
        <Topbar health={health} />
        <main style={{ flex:1, overflowY:"auto", padding:"28px 32px" }}
              className="fade-in" key={page}>
          <Page />
        </main>
      </div>
    </div>
  );
}
