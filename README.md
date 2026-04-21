# SentinelGuard – Python + Electron
## Quick Start Guide

---

## What's Inside

```
SentinelGuard_Python/
├── backend/
│   ├── app.py              ← Python Flask API (all detection logic)
│   └── requirements.txt    ← Python packages
├── frontend/
│   ├── src/                ← React pages + components
│   ├── package.json
│   └── vite.config.js
├── models/
│   ├── phishing_model_top10.pkl   ← PUT YOUR MODEL HERE
│   └── ransomware_model.pkl       ← PUT YOUR MODEL HERE
├── main.js                 ← Electron main process
├── preload.js              ← Electron context bridge
├── package.json            ← Electron + build config
├── build.bat               ← ONE-CLICK full build
└── run_dev.bat             ← ONE-CLICK dev mode
```

---

## Prerequisites

Install these before anything else:

| Software | Version  | Download |
|----------|----------|----------|
| Python   | 3.9+     | python.org |
| Node.js  | 20 LTS   | nodejs.org |

---

## Option A — Run in Dev Mode (Fastest, No Build)

**Step 1:** Copy your .pkl files into the `models/` folder

**Step 2:** Double-click `run_dev.bat`

That's it. Three windows open:
- Python backend on http://localhost:57432
- React dev server on http://localhost:3000
- Electron window showing the app

---

## Option B — Build a Full .exe Installer

**Step 1:** Copy your .pkl files into the `models/` folder

**Step 2:** Double-click `build.bat`

Wait ~5 minutes. Output:
```
dist_electron\SentinelGuard Setup 1.0.0.exe
```

Run that installer on any Windows machine — no Python or Node needed.

---

## Manual Steps (if batch files don't work)

```bash
# 1. Python deps
pip install flask flask-cors xgboost numpy scikit-learn watchdog pyinstaller

# 2. Electron deps
npm install

# 3. Frontend
cd frontend && npm install && npm run build && cd ..

# 4. Bundle Python backend
cd backend
pyinstaller --onefile --name SentinelGuard_backend \
  --add-data "../models;models" \
  --hidden-import xgboost \
  --hidden-import flask_cors \
  app.py
cd ..

# 5. Build installer
npx electron-builder --win --x64
```

---

## Adding Your Models

Simply copy both files here:
```
models/ransomware_model.pkl
models/phishing_model_top10.pkl
```

The app works without them — it falls back to the traditional
heuristic engine automatically.

---

## API Endpoints

The Python backend exposes these on http://localhost:57432:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /api/health | Service status + model availability |
| GET  | /api/stats  | Scan counts and uptime |
| POST | /api/scan/ransomware | Scan a file by path |
| POST | /api/scan/phishing   | Scan a URL |
| POST | /api/scan/quick      | Scan Desktop/Documents/Downloads |
| GET  | /api/temp/scan  | List temp directories |
| POST | /api/temp/clean | Delete temp files |
| GET  | /api/history    | Paginated threat history |
| DELETE | /api/history  | Clear history |
| GET/POST | /api/protection/level | Read/write settings |
