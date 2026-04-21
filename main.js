// =============================================================================
//  SentinelGuard  -  main.js
//  Fixed:  Black screen  -  correct frontend path in packaged app
//  Fixed:  Models OFF    -  wait longer for backend before loading UI
//  Fixed:  Icon crash    -  safe icon loading
// =============================================================================

const { app, BrowserWindow, Tray, Menu, nativeImage,
        ipcMain, shell, Notification } = require("electron");
const path   = require("path");
const { spawn, execSync } = require("child_process");
const http   = require("http");
const fs     = require("fs");

let mainWindow  = null;
let tray        = null;
let backendProc = null;
let backendReady= false;

const API_PORT    = 57432;
const BACKEND_URL = `http://127.0.0.1:${API_PORT}`;
const isDev       = process.env.NODE_ENV === "development";

// ── Safe icon (no crash if missing) ──────────────────────────────────────────
function safeIcon(p) {
  try { if (fs.existsSync(p)) return nativeImage.createFromPath(p); } catch(_){}
  return nativeImage.createEmpty();
}

// ── Find frontend index.html ──────────────────────────────────────────────────
function getFrontendPath() {
  const candidates = [
    // asar packaged - most common
    path.join(__dirname, "frontend", "dist", "index.html"),
    // resources folder (electron-builder extraResources)
    path.join(process.resourcesPath || "", "frontend", "dist", "index.html"),
    // one level up
    path.join(__dirname, "..", "frontend", "dist", "index.html"),
    // app unpacked
    path.join(process.resourcesPath || "", "app", "frontend", "dist", "index.html"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      console.log("[Electron] Frontend found:", c);
      return c;
    }
  }
  console.error("[Electron] Frontend NOT found. Tried:", candidates);
  return null;
}

// ── Find backend exe ──────────────────────────────────────────────────────────
function getBackendPath() {
  const candidates = [
    path.join(process.resourcesPath || "", "backend", "SentinelGuard_backend.exe"),
    path.join(__dirname, "backend", "SentinelGuard_backend.exe"),
    path.join(process.resourcesPath || "", "SentinelGuard_backend.exe"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      console.log("[Electron] Backend found:", c);
      return c;
    }
  }
  console.error("[Electron] Backend NOT found. Tried:", candidates);
  return null;
}

// ── Loading screen HTML ───────────────────────────────────────────────────────
const LOADING_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0e1a;color:#e2e8f0;font-family:'Segoe UI',monospace;
       display:flex;flex-direction:column;align-items:center;
       justify-content:center;height:100vh;gap:18px}
  .shield{font-size:60px;animation:pulse 1.5s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.95)}}
  h1{font-size:26px;font-weight:800;color:#38bdf8}
  p{font-size:13px;color:#64748b}
  .bar-bg{width:240px;height:3px;background:#1e2a40;border-radius:2px;overflow:hidden}
  .bar{height:100%;background:#38bdf8;border-radius:2px;
       animation:slide 1.4s ease-in-out infinite}
  @keyframes slide{0%{width:0%;margin-left:0%}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}
  .status{font-size:11px;color:#475569}
</style></head><body>
<div class="shield">🛡</div>
<h1>SentinelGuard</h1>
<p>Starting protection engine...</p>
<div class="bar-bg"><div class="bar"></div></div>
<div class="status" id="s">Initialising...</div>
<script>
  const m=['Initialising Python backend...','Loading ML models...',
           'Starting file watcher...','Connecting to Windows Defender...','Almost ready...'];
  let i=0;
  setInterval(()=>{i=(i+1)%m.length;document.getElementById('s').textContent=m[i];},2000);
</script></body></html>`;

// ── Start backend ─────────────────────────────────────────────────────────────
function startBackend() {
  if (isDev) {
    const pyPath = "python";
    const appPy  = path.join(__dirname, "backend", "app.py");
    if (!fs.existsSync(appPy)) { console.error("[Electron] app.py not found"); return; }
    backendProc = spawn(pyPath, [appPy], {
      cwd:   path.join(__dirname, "backend"),
      stdio: ["ignore","pipe","pipe"],
      env:   { ...process.env },
    });
  } else {
    const exe = getBackendPath();
    if (!exe) { console.error("[Electron] Backend exe not found"); return; }
    backendProc = spawn(exe, [], {
      cwd:         path.dirname(exe),
      stdio:       ["ignore","pipe","pipe"],
      windowsHide: true,
    });
  }

  const onData = (d) => {
    const msg = d.toString().trim();
    if (msg) console.log("[Backend]", msg);
    if (msg.includes("starting on") || msg.includes("Running on")) backendReady = true;
  };
  backendProc.stdout?.on("data", onData);
  backendProc.stderr?.on("data", onData);
  backendProc.on("exit",  c   => console.log("[Backend] exited:", c));
  backendProc.on("error", err => console.error("[Backend] error:", err.message));
}

// ── Poll backend until ready ──────────────────────────────────────────────────
function waitForBackend(retries=50, delay=1500) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`${BACKEND_URL}/api/health`, res => {
        if (res.statusCode === 200) { resolve(); } else retry(n);
        res.resume();
      });
      req.on("error",   () => retry(n));
      req.setTimeout(2000, () => { req.destroy(); retry(n); });
    };
    const retry = (n) => {
      if (n <= 0) { reject(new Error("Backend timeout")); return; }
      console.log(`[Electron] Waiting for backend... (${n} left)`);
      setTimeout(() => attempt(n-1), delay);
    };
    attempt(retries);
  });
}

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280, height: 820,
    minWidth: 900, minHeight: 600,
    backgroundColor: "#0a0e1a",
    icon: safeIcon(path.join(__dirname, "assets", "icon.png")),
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, "preload.js"),
      webSecurity:      false,  // needed for file:// → http:// API calls
    },
    show: false,
    titleBarStyle: "default",
    title: "SentinelGuard",
  });

  // Show loading screen while backend starts
  mainWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(LOADING_HTML)
  );

  mainWindow.once("ready-to-show", () => { mainWindow.show(); mainWindow.focus(); });
  mainWindow.on("close", e => { e.preventDefault(); mainWindow.hide(); });
  mainWindow.webContents.on("did-fail-load", (e, code, desc, url) => {
    console.error("[Electron] Load failed:", code, desc, url);
  });
}

// ── Load frontend after backend is ready ──────────────────────────────────────
async function loadFrontend() {
  if (!mainWindow) return;

  if (isDev) {
    try {
      await mainWindow.loadURL("http://localhost:3000");
      console.log("[Electron] Loaded from dev server :3000");
    } catch(err) {
      console.error("[Electron] Dev server not ready, retrying...");
      setTimeout(() => loadFrontend(), 2000);
    }
  } else {
    const indexPath = getFrontendPath();
    if (indexPath) {
      try {
        await mainWindow.loadFile(indexPath);
        console.log("[Electron] Loaded from file:", indexPath);
      } catch(err) {
        console.error("[Electron] Load file failed:", err.message);
        mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
          <html><body style="background:#0a0e1a;color:#f87171;font-family:monospace;padding:40px">
          <h2>Load Error</h2><p>${err.message}</p><p>Path: ${indexPath}</p></body></html>`));
      }
    } else {
      mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
        <html><body style="background:#0a0e1a;color:#f87171;font-family:monospace;padding:40px">
        <h2>Frontend Not Found</h2>
        <p>frontend/dist/index.html is missing.</p>
        <p>Run build_from_scratch.bat to rebuild.</p></body></html>`));
    }
  }
}

// ── System tray ───────────────────────────────────────────────────────────────
function createTray() {
  try {
    tray = new Tray(safeIcon(path.join(__dirname, "assets", "tray.png")));
    tray.setToolTip("SentinelGuard");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label:"Open Dashboard", click:()=>{ mainWindow?.show(); mainWindow?.focus(); } },
      { type:"separator" },
      { label:"Quit", click:()=>{ mainWindow?.removeAllListeners("close"); app.quit(); } },
    ]));
    tray.on("click", ()=>{ mainWindow?.show(); mainWindow?.focus(); });
  } catch(e) { console.warn("[Electron] Tray failed:", e.message); }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle("get-app-version",    () => app.getVersion());
ipcMain.handle("get-backend-status", () => backendReady);
ipcMain.handle("open-external",   (_, url) => shell.openExternal(url));
ipcMain.handle("minimize-window",    () => mainWindow?.minimize());
ipcMain.handle("maximize-window",    () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle("show-notification", (_, {title,body}) => {
  try { new Notification({title,body}).show(); } catch(_){}
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log("[Electron] Ready. isDev:", isDev);
  startBackend();
  createWindow();
  createTray();

  try {
    await waitForBackend();
    backendReady = true;
    console.log("[Electron] Backend ready - loading frontend");
    await loadFrontend();
    mainWindow?.webContents.send("backend-ready");
  } catch(err) {
    console.error("[Electron] Backend failed:", err.message);
    await loadFrontend();
    mainWindow?.webContents.send("backend-failed");
  }
});

app.on("window-all-closed", () => { /* keep in tray */ });
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});
app.on("before-quit", () => {
  if (backendProc) {
    try {
      if (process.platform === "win32")
        execSync(`taskkill /F /PID ${backendProc.pid} /T`, {stdio:"ignore"});
      else backendProc.kill();
    } catch(_) {}
  }
});
