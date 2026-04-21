
import os,sys,json,time,math,shutil,hashlib,struct,threading,subprocess,re
import ctypes
from datetime import datetime
from pathlib import Path
from flask import Flask,request,jsonify
from flask_cors import CORS

app=Flask(__name__)
CORS(app)

BASE_DIR       = Path(__file__).parent.parent
DATA_FILE      = BASE_DIR/"data"/"history.json"
MODELS_DIR     = BASE_DIR/"models"
QUARANTINE_DIR = BASE_DIR/"data"/"quarantine"
DATA_FILE.parent.mkdir(exist_ok=True)
QUARANTINE_DIR.mkdir(exist_ok=True)

def find_defender():
    fixed=[r"C:\Program Files\Windows Defender\MpCmdRun.exe",
           r"C:\Program Files (x86)\Windows Defender\MpCmdRun.exe"]
    for p in fixed:
        if os.path.isfile(p): return p
    platform=Path(r"C:\ProgramData\Microsoft\Windows Defender\Platform")
    if platform.exists():
        for v in sorted(platform.iterdir(),reverse=True):
            exe=v/"MpCmdRun.exe"
            if exe.exists(): return str(exe)
    return None

DEFENDER_EXE=find_defender()
print(f"[{'OK' if DEFENDER_EXE else 'WARN'}] Defender: {DEFENDER_EXE or 'NOT FOUND'}")

def is_admin():
    try: return ctypes.windll.shell32.IsUserAnAdmin()!=0
    except: return False

def run_defender(args,timeout=60):
    if not DEFENDER_EXE:
        return {"success":False,"stdout":"","stderr":"Defender not found","returncode":-1}
    try:
        r=subprocess.run([DEFENDER_EXE]+args,capture_output=True,text=True,
                         timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
        return {"success":r.returncode==0,"stdout":r.stdout.strip(),
                "stderr":r.stderr.strip(),"returncode":r.returncode}
    except subprocess.TimeoutExpired:
        return {"success":False,"stdout":"","stderr":"Timeout","returncode":-2}
    except Exception as e:
        return {"success":False,"stdout":"","stderr":str(e),"returncode":-3}

def run_ps(cmd,timeout=15):
    try:
        r=subprocess.run(["powershell","-NoProfile","-NonInteractive","-Command",cmd],
                         capture_output=True,text=True,timeout=timeout,
                         creationflags=subprocess.CREATE_NO_WINDOW)
        return {"success":r.returncode==0,"stdout":r.stdout.strip(),"stderr":r.stderr.strip()}
    except Exception as e:
        return {"success":False,"stdout":"","stderr":str(e)}

phishing_model=ransomware_model=None

def load_models():
    global phishing_model,ransomware_model
    try:
        import pickle,xgboost
        p=MODELS_DIR/"phishing_model_top10.pkl"
        if p.exists():
            with open(p,"rb") as f: phishing_model=pickle.load(f)
            print("[OK] Phishing model loaded")
        r=MODELS_DIR/"ransomware_model.pkl"
        if r.exists():
            with open(r,"rb") as f: ransomware_model=pickle.load(f)
            print("[OK] Ransomware model loaded")
    except Exception as e: print(f"[WARN] {e}")

load_models()

_hlock=threading.Lock()

def load_history():
    if DATA_FILE.exists():
        try: return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except: pass
    return []

def save_history(r): DATA_FILE.write_text(json.dumps(r,indent=2,ensure_ascii=False),encoding="utf-8")

def add_history(rec):
    with _hlock:
        recs=load_history()
        rec.setdefault("id",int(time.time()*1000))
        rec.setdefault("timestamp",datetime.now().isoformat())
        recs.insert(0,rec); save_history(recs[:1000])
    return rec

_stats={"scanned":0,"threats":0,"blocked":0,"quarantined":0}
_slock=threading.Lock()

def inc_stat(k,n=1):
    with _slock: _stats[k]=_stats.get(k,0)+n

def load_settings():
    sf=BASE_DIR/"data"/"settings.json"
    if sf.exists():
        try: return json.loads(sf.read_text())
        except: pass
    return {"level":2,"blockOnSuspicious":True,"enableRansomwareHeuristics":True,
            "enableEntropyCheck":True,"useDefenderBlocking":True,
            "autoQuarantine":True,"blockPhishingUrls":True}



def defender_status():
    r=run_ps("Get-MpComputerStatus|Select-Object AntivirusEnabled,"
             "RealTimeProtectionEnabled,AntivirusSignatureVersion,"
             "AntivirusSignatureLastUpdated,BehaviorMonitorEnabled,"
             "IoavProtectionEnabled,IsTamperProtected|ConvertTo-Json")
    if r["success"] and r["stdout"]:
        try:
            data=json.loads(r["stdout"])
            for k in ("AntivirusSignatureLastUpdated",):
                v=data.get(k,"")
                if isinstance(v,str) and "/Date(" in v:
                    try:
                        ms=int(re.search(r"\d+",v).group())
                        data[k]=datetime.fromtimestamp(ms/1000).isoformat()
                    except: pass
            return {"available":True,"error":None,**data}
        except: pass
    return {"available":DEFENDER_EXE is not None,"error":"Run as Administrator for full status",
            "AntivirusEnabled":None,"RealTimeProtectionEnabled":None,
            "AntivirusSignatureVersion":"Unknown","AntivirusSignatureLastUpdated":"Unknown"}

def defender_scan_file(filepath):
    r=run_defender(["-Scan","-ScanType","3","-File",filepath,"-DisableRemediation","0"])
    threat=(r["returncode"] in (2,3) or
            "threat" in r["stdout"].lower() or "infected" in r["stdout"].lower())
    rem=(r["returncode"]==2 or "remediat" in r["stdout"].lower() or
         "removed" in r["stdout"].lower())
    return {"defenderScanned":True,"defenderThreat":threat,"defenderRemediated":rem,
            "defenderOutput":r["stdout"] or r["stderr"],"defenderReturnCode":r["returncode"]}

def defender_remove_threat(filepath):
    # Method 1: scan+remediate
    r=run_defender(["-Scan","-ScanType","3","-File",filepath,"-DisableRemediation","0"])
    if r["returncode"] in (0,2):
        inc_stat("blocked")
        return {"success":True,"method":"Windows Defender Remediation","output":r["stdout"]}
    # Method 2: PowerShell Remove-MpThreat
    r2=run_ps("Remove-MpThreat")
    if r2["success"]:
        inc_stat("blocked")
        return {"success":True,"method":"PowerShell Remove-MpThreat","output":r2["stdout"]}
    # Method 3: Our own quarantine
    return sentinel_quarantine(filepath)

def sentinel_quarantine(filepath):
    try:
        src=Path(filepath)
        dest=QUARANTINE_DIR/f"{src.name}.{int(time.time())}.quarantined"
        shutil.move(str(src),str(dest))
        os.chmod(str(dest),0o000)
        inc_stat("quarantined")
        return {"success":True,"method":"SentinelGuard Quarantine",
                "quarantinePath":str(dest),"output":f"Moved to: {dest}"}
    except Exception as e:
        return {"success":False,"method":"SentinelGuard Quarantine","output":str(e)}

def defender_quarantine(filepath):
    r=run_ps(f"Start-MpScan -ScanPath '{filepath}' -ScanType CustomScan;"
             f"Get-MpThreatDetection|Remove-MpThreat")
    if r["success"]:
        inc_stat("quarantined")
        return {"success":True,"method":"Windows Defender Quarantine","output":r["stdout"]}
    return sentinel_quarantine(filepath)

def list_quarantine():
    our=[]
    for f in QUARANTINE_DIR.glob("*.quarantined"):
        our.append({"name":f.name,"path":str(f),"size":f.stat().st_size,
                    "quarantined":datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                    "source":"SentinelGuard"})
    defender_items=[]
    r=run_ps("Get-MpThreat|Select-Object ThreatName,SeverityID,"
             "Resources,InitialDetectionTime|ConvertTo-Json -Depth 3")
    if r["success"] and r["stdout"]:
        try:
            raw=json.loads(r["stdout"])
            if isinstance(raw,dict): raw=[raw]
            for t in raw:
                defender_items.append({"name":t.get("ThreatName","Unknown"),
                    "severity":t.get("SeverityID",0),"resources":t.get("Resources",""),
                    "detected":t.get("InitialDetectionTime",""),"source":"Windows Defender"})
        except: pass
    return {"sentinelItems":our,"defenderItems":defender_items,
            "totalCount":len(our)+len(defender_items)}

def restore_quarantine(filename):
    src=QUARANTINE_DIR/filename
    if not src.exists(): return {"success":False,"message":"Not found in quarantine"}
    try:
        original=src.name.rsplit(".",2)[0]
        dest=Path.home()/"Desktop"/original
        os.chmod(str(src),0o644)
        shutil.move(str(src),str(dest))
        return {"success":True,"restoredTo":str(dest)}
    except Exception as e: return {"success":False,"message":str(e)}

def block_url(url):
    try:
        from urllib.parse import urlparse
        host=urlparse(url if url.startswith("http") else "http://"+url).hostname
        if not host: return {"success":False,"message":"Cannot parse hostname"}
        hf=Path(r"C:\Windows\System32\drivers\etc\hosts")
        content=hf.read_text(encoding="utf-8") if hf.exists() else ""
        if host in content:
            return {"success":True,"message":f"{host} already blocked","alreadyBlocked":True,"host":host}
        with open(str(hf),"a",encoding="utf-8") as f:
            f.write(f"\n127.0.0.1\t{host}\t# SentinelGuard block\n")
        return {"success":True,"message":f"Blocked: {host}","host":host}
    except PermissionError:
        return {"success":False,"message":"Permission denied — run as Administrator to block URLs"}
    except Exception as e:
        return {"success":False,"message":str(e)}

def unblock_url(url):
    try:
        from urllib.parse import urlparse
        host=urlparse(url if url.startswith("http") else "http://"+url).hostname
        hf=Path(r"C:\Windows\System32\drivers\etc\hosts")
        lines=hf.read_text(encoding="utf-8").splitlines(keepends=True)
        hf.write_text("".join(l for l in lines if host not in l or "SentinelGuard" not in l),encoding="utf-8")
        return {"success":True,"message":f"Unblocked: {host}"}
    except Exception as e: return {"success":False,"message":str(e)}

def list_blocked_urls():
    try:
        hf=Path(r"C:\Windows\System32\drivers\etc\hosts")
        return [l for l in hf.read_text(encoding="utf-8").splitlines() if "SentinelGuard block" in l]
    except: return []



RANSOM_EXTENSIONS={".encrypted",".locked",".crypto",".vault",".crypt",".locky",".cerber",
    ".zepto",".thor",".aesir",".zzz",".wncry",".wcry",".wncryt",".sage",".globe",
    ".purge",".wallet",".onion",".darkness",".r5a",".ha3",".vvv",".exx",".ezz",
    ".ecc",".abc",".xyz",".micro",".ttt",".breaking_bad"}
KNOWN_HASHES={"84c82835a5d21bbcf75a61706d8ab549","db349b97c37d22f5ea1d1841e3c89eb4",
              "027cc450ef5f8c5f653329641ec1fed9"}
RANSOM_STRINGS=["your files have been encrypted","bitcoin","btc wallet","decrypt your files",
    "ransom","pay to recover","your data is encrypted",".onion","tor browser",
    "vssadmin delete shadows","wbadmin delete catalog"]

def shannon_entropy(data):
    if not data: return 0.0
    freq=[0]*256
    for b in data: freq[b]+=1
    n=len(data); e=0.0
    for f in freq:
        if f:
            p=f/n; e-=p*math.log2(p)
    return e

def extract_pe_features(fp):
    try:
        with open(fp,"rb") as f: data=f.read(4096)
        if data[:2]!=b"MZ": return None
        peo=struct.unpack_from("<I",data,0x3C)[0]
        if data[peo:peo+4]!=b"PE\x00\x00": return None
        oo=peo+24; is64=struct.unpack_from("<H",data,oo)[0]==0x20b
        ddo=oo+(112 if is64 else 96)
        return {"DllCharacteristics":struct.unpack_from("<H",data,oo+70)[0],
                "DebugSize":struct.unpack_from("<I",data,ddo+52)[0] if ddo+56<=len(data) else 0,
                "DebugRVA":struct.unpack_from("<I",data,ddo+48)[0] if ddo+52<=len(data) else 0,
                "MajorLinkerVersion":data[oo+2],
                "MajorOSVersion":struct.unpack_from("<H",data,oo+40)[0],
                "ResourceSize":struct.unpack_from("<I",data,ddo+20)[0] if ddo+24<=len(data) else 0}
    except: return None

def traditional_ransomware_scan(fp):
    indicators,score=[],0
    ext=Path(fp).suffix.lower()

    # Skip files under 10KB — too small to be ransomware
    try:
        if os.path.getsize(fp) < 10240:
            return {"isThreat":False,"threatLevel":"None","confidence":0.0,
                    "indicators":[],"details":"File too small to scan","method":"Signature + Heuristic"}
    except: pass

    if ext in RANSOM_EXTENSIONS:
        indicators.append(f"Ransomware extension: {ext}"); score+=40
    try:
        with open(fp,"rb") as f: raw=f.read(512*1024)
        md5=hashlib.md5(raw).hexdigest()
        if md5 in KNOWN_HASHES:
            indicators.append(f"Known hash: {md5}"); score+=100
        text=raw.decode("utf-8",errors="ignore").lower()
        for s in RANSOM_STRINGS:
            if s in text:
                indicators.append(f"Ransom string: '{s}'"); score+=15
        # Only flag entropy on binary files (.exe, .dll etc) not script files
        if ext in {".exe",".dll",".sys",".drv",".ocx"}:
            ent=shannon_entropy(raw[:4096])
            if ent>7.8:   # raised from 7.5 to reduce false positives
                indicators.append(f"High entropy ({ent:.2f})"); score+=30
    except: pass
    level="Critical" if score>=80 else "High" if score>=60 else "Medium" if score>=40 else "Low" if score>=20 else "None"
    return {"isThreat":score>=40,"threatLevel":level,"confidence":min(score/100,1.0),
            "indicators":indicators,"details":f"Heuristic score: {score}/100",
            "method":"Signature + Heuristic"}

def ml_ransomware_scan(fp):
    if not ransomware_model: return None
    f=extract_pe_features(fp)
    if not f: return None
    try:
        import numpy as np
        X=np.array([[f["DllCharacteristics"],f["DebugSize"],f["DebugRVA"],
                     f["MajorLinkerVersion"],f["MajorOSVersion"],f["ResourceSize"]]])
        return float(ransomware_model.predict_proba(X)[0][1])
    except: return None

URL_SHORTENERS={"bit.ly","tinyurl.com","goo.gl","ow.ly","t.co","is.gd","buff.ly",
                "adf.ly","bit.do","rb.gy","cutt.ly","mcaf.ee"}
PHISHING_PATTERNS=["secure-login","account-verify","update-info","confirm-account",
    "bank-alert","paypal-secure","amazon-update","apple-id-locked","netflix-billing",
    "microsoft-support","google-verify","signin-","-login.","-secure.","-verify."]

def traditional_phishing_scan(url):
    from urllib.parse import urlparse
    import ipaddress
    indicators,score=[],0
    try:
        if not url.startswith("http"): url="http://"+url
        p=urlparse(url); host=(p.hostname or "").lower()
        try: ipaddress.ip_address(host); indicators.append("IP as host"); score+=35
        except: pass
        if host in URL_SHORTENERS: indicators.append("URL shortener"); score+=20
        for pat in PHISHING_PATTERNS:
            if pat in host: indicators.append(f"Suspicious pattern: '{pat}'"); score+=25
        if host.count(".")>=4: indicators.append("Excessive subdomains"); score+=20
        if p.scheme=="http": indicators.append("Non-HTTPS"); score+=15
        if len(url)>100: indicators.append(f"Long URL ({len(url)} chars)"); score+=10
        if "@" in url: indicators.append("@ symbol in URL"); score+=30
        if p.port and p.port not in (80,443): indicators.append(f"Non-standard port:{p.port}"); score+=20
        if url.count("%")>5: indicators.append("Excessive encoding"); score+=15
    except: indicators.append("Malformed URL"); score+=40
    level="Critical" if score>=80 else "High" if score>=60 else "Medium" if score>=40 else "Low" if score>=20 else "None"
    return {"isThreat":score>=40,"threatLevel":level,"confidence":min(score/100,1.0),
            "indicators":indicators,"details":f"Heuristic score: {score}/100","method":"Heuristic"}

def ml_phishing_scan(url):
    if not phishing_model: return None
    try:
        from urllib.parse import urlparse
        import numpy as np
        if not url.startswith("http"): url="http://"+url
        p=urlparse(url); host=p.hostname or ""; path=p.path or "/"; qstr=p.query or ""
        tld=host.split(".")[-1] if "." in host else ""
        X=np.array([[1 if tld in qstr else 0,path.count("%")/max(len(path),1),
                     qstr.count("."),1 if host in URL_SHORTENERS else 0,
                     path.count("-"),path.count("_")/max(len(path),1),
                     365,host.count("."),url.count("/"),len(path)]])
        return float(phishing_model.predict_proba(X)[0][1])
    except: return None

@app.route("/api/scan/ransomware",methods=["POST"])
def scan_ransomware():
    data=request.get_json() or {}
    fp=data.get("filePath","").strip()
    if not fp: return jsonify({"error":"filePath required"}),400
    if not os.path.isfile(fp): return jsonify({"error":"File not found"}),404
    settings=load_settings(); inc_stat("scanned")

    result=traditional_ransomware_scan(fp)
    ml=ml_ransomware_scan(fp)
    if ml is not None:
        result["method"]="ML (XGBoost) + Signature"; result["mlProbability"]=round(ml,4)
        if ml>0.6:
            result["indicators"].append(f"ML: {ml*100:.1f}% probability")
            result["isThreat"]=True; result["confidence"]=max(result["confidence"],ml)
            if result["threatLevel"]=="None": result["threatLevel"]="Medium"

    # Defender scan
    dr=defender_scan_file(fp)
    result["defenderScan"]=dr
    if dr["defenderThreat"]:
        result["isThreat"]=True
        result["indicators"].append("Windows Defender: threat detected")
        if result["threatLevel"] in ("None","Low"): result["threatLevel"]="High"
        result["method"]+=" + Windows Defender"

    result["blocked"]=result["quarantined"]=result["defenderBlocked"]=False

    if result["isThreat"]:
        inc_stat("threats")
        # Step 1: Try Defender block
        if settings.get("useDefenderBlocking",True) and DEFENDER_EXE:
            br=defender_remove_threat(fp)
            result["defenderBlocked"]=br["success"]
            result["blockOutput"]=br.get("output","")
            result["blockMethod"]=br.get("method","")
            if br["success"]:
                result["blocked"]=True; result["status"]="blocked"
                result["indicators"].append(f"BLOCKED: {br['method']}")
        # Step 2: Our quarantine if Defender failed
        if not result["blocked"] and settings.get("autoQuarantine",True):
            qr=defender_quarantine(fp)
            if qr["success"]:
                result["quarantined"]=True
                result["quarantinePath"]=qr.get("quarantinePath","")
                result["status"]="quarantined"
                result["indicators"].append(f"QUARANTINED: {qr['method']}")
        result.setdefault("status","detected")
        add_history({"type":"ransomware","filePath":fp,
            "threatLevel":result["threatLevel"],"detectionMethod":result["method"],
            "details":result["details"],"confidenceScore":result["confidence"],
            "indicators":result["indicators"],"status":result["status"],
            "wasBlocked":result["blocked"],"wasQuarantined":result["quarantined"],
            "defenderBlocked":result["defenderBlocked"]})
    return jsonify(result)

@app.route("/api/scan/phishing",methods=["POST"])
def scan_phishing():
    data=request.get_json() or {}
    url=data.get("url","").strip()
    use_ml=data.get("useML",True)
    if not url: return jsonify({"error":"url required"}),400
    settings=load_settings()

    result=traditional_phishing_scan(url)
    if use_ml:
        ml=ml_phishing_scan(url)
        if ml is not None:
            result["method"]="ML (XGBoost) + Heuristic"; result["mlProbability"]=round(ml,4)
            if ml>0.5:
                result["indicators"].append(f"ML: {ml*100:.1f}% phishing probability")
                result["isThreat"]=True; result["confidence"]=max(result["confidence"],ml)
                if result["threatLevel"]=="None": result["threatLevel"]="Medium"

    result["urlBlocked"]=False
    if result["isThreat"] and settings.get("blockPhishingUrls",True):
        br=block_url(url)
        result["urlBlocked"]=br["success"]
        result["urlBlockNote"]=br["message"]
        if br["success"]:
            result["indicators"].append(f"URL blocked: {br.get('host',url)}")
            result["status"]="blocked"
        else:
            result["status"]="detected"
    else:
        result["status"]="detected" if result["isThreat"] else "clean"

    if result["isThreat"]:
        add_history({"type":"phishing","filePath":url,
            "threatLevel":result["threatLevel"],"detectionMethod":result["method"],
            "details":result["details"],"confidenceScore":result["confidence"],
            "indicators":result["indicators"],"status":result["status"],
            "wasBlocked":result["urlBlocked"]})
    return jsonify(result)

@app.route("/api/scan/quick",methods=["POST"])
def quick_scan():
    dirs=[os.path.expanduser("~/Desktop"),os.path.expanduser("~/Documents"),
          os.path.expanduser("~/Downloads")]
    exts={".exe",".dll",".bat",".ps1",".vbs",".cmd"}
    project_dir=str(BASE_DIR).lower()
    scanned=threats=0
    for d in dirs:
        if not os.path.isdir(d): continue
        for root,_,files in os.walk(d):
            # Skip our own project folder
            if project_dir in root.lower(): continue
            for f in files:
                if Path(f).suffix.lower() in exts:
                    fp=os.path.join(root,f)
                    try:
                        r=traditional_ransomware_scan(fp)
                        inc_stat("scanned"); scanned+=1
                        if r["isThreat"]:
                            inc_stat("threats"); threats+=1
                            add_history({"type":"ransomware","filePath":fp,
                                "threatLevel":r["threatLevel"],"detectionMethod":r["method"],
                                "details":r["details"],"confidenceScore":r["confidence"],
                                "indicators":r["indicators"],"status":"detected"})
                    except: pass
                    if scanned>=500: break
    return jsonify({"scanned":scanned,"threats":threats,"completed":True})



@app.route("/api/defender/status",methods=["GET"])
def api_defender_status(): return jsonify(defender_status())

@app.route("/api/defender/scan/quick",methods=["POST"])
def api_defender_quick():
    threading.Thread(target=lambda:run_defender(["-Scan","-ScanType","1"],timeout=300),daemon=True).start()
    return jsonify({"success":True,"message":"Quick scan started"})

@app.route("/api/defender/scan/full",methods=["POST"])
def api_defender_full():
    threading.Thread(target=lambda:run_defender(["-Scan","-ScanType","2"],timeout=7200),daemon=True).start()
    return jsonify({"success":True,"message":"Full scan started (may take hours)"})

@app.route("/api/defender/scan/custom",methods=["POST"])
def api_defender_custom():
    folder=(request.get_json() or {}).get("folder","").strip()
    if not folder: return jsonify({"error":"folder required"}),400
    threading.Thread(target=lambda:run_defender(["-Scan","-ScanType","3","-File",folder],timeout=600),daemon=True).start()
    return jsonify({"success":True,"message":f"Custom scan started: {folder}"})

@app.route("/api/defender/update",methods=["POST"])
def api_defender_update():
    r=run_defender(["-SignatureUpdate"],timeout=120)
    return jsonify({"success":r["success"],"output":r["stdout"] or r["stderr"]})

@app.route("/api/defender/realtime",methods=["POST"])
def api_defender_realtime():
    enabled=(request.get_json() or {}).get("enabled",True)
    r=run_ps(f"Set-MpPreference -DisableRealtimeMonitoring ${'False' if enabled else 'True'}")
    return jsonify({"success":r["success"],"enabled":enabled,"output":r["stdout"] or r["stderr"]})

@app.route("/api/defender/quarantine",methods=["GET"])
def api_quarantine_list(): return jsonify(list_quarantine())

@app.route("/api/defender/quarantine/file",methods=["POST"])
def api_quarantine_file():
    fp=(request.get_json() or {}).get("filePath","").strip()
    if not fp: return jsonify({"error":"filePath required"}),400
    r=defender_quarantine(fp)
    if r["success"]:
        add_history({"type":"quarantine","filePath":fp,"threatLevel":"High",
                     "status":"quarantined","detectionMethod":"Manual",
                     "indicators":[],"confidenceScore":0,"details":"Manually quarantined"})
    return jsonify(r)

@app.route("/api/defender/quarantine/restore",methods=["POST"])
def api_quarantine_restore():
    fn=(request.get_json() or {}).get("filename","").strip()
    if not fn: return jsonify({"error":"filename required"}),400
    return jsonify(restore_quarantine(fn))

@app.route("/api/defender/exclusion",methods=["POST"])
def api_add_exclusion():
    p=(request.get_json() or {}).get("path","").strip()
    if not p: return jsonify({"error":"path required"}),400
    r=run_ps(f"Add-MpPreference -ExclusionPath '{p}'")
    return jsonify({"success":r["success"],"output":r["stdout"] or r["stderr"]})

@app.route("/api/defender/threats",methods=["GET"])
def api_defender_threats():
    r=run_ps("Get-MpThreatDetection|Select-Object ThreatID,ProcessName,DomainUser,"
             "InitialDetectionTime,RemediationTime,ActionSuccess|ConvertTo-Json -Depth 3")
    if r["success"] and r["stdout"]:
        try:
            raw=json.loads(r["stdout"])
            return jsonify(raw if isinstance(raw,list) else [raw])
        except: pass
    return jsonify([])

@app.route("/api/defender/block-url",methods=["POST"])
def api_block_url():
    url=(request.get_json() or {}).get("url","").strip()
    if not url: return jsonify({"error":"url required"}),400
    r=block_url(url)
    if r["success"]:
        add_history({"type":"url_block","filePath":url,"threatLevel":"High",
                     "status":"blocked","detectionMethod":"Hosts File",
                     "indicators":[],"confidenceScore":0,"details":f"Blocked: {r.get('host',url)}"})
    return jsonify(r)

@app.route("/api/defender/unblock-url",methods=["POST"])
def api_unblock_url():
    url=(request.get_json() or {}).get("url","").strip()
    if not url: return jsonify({"error":"url required"}),400
    return jsonify(unblock_url(url))

@app.route("/api/defender/blocked-urls",methods=["GET"])
def api_blocked_urls(): return jsonify({"blockedUrls":list_blocked_urls()})

def get_temp_dirs():
    import tempfile
    dirs=set()
    for k in ("TEMP","TMP"):
        v=os.environ.get(k,"")
        if v and os.path.isdir(v): dirs.add(v)
    dirs.add(tempfile.gettempdir())
    dirs.add(os.path.join(os.environ.get("WINDIR","C:\\Windows"),"Temp"))
    return [d for d in dirs if os.path.isdir(d)]

@app.route("/api/temp/scan",methods=["GET"])
def temp_scan():
    locs,ts,tc=[],0,0
    for d in get_temp_dirs():
        sz,cnt=0,0
        for root,_,files in os.walk(d):
            for f in files:
                try: sz+=os.path.getsize(os.path.join(root,f)); cnt+=1
                except: pass
        locs.append({"path":d,"size":sz,"count":cnt}); ts+=sz; tc+=cnt
    return jsonify({"locations":locs,"totalSize":ts,"totalSizeMb":round(ts/1024/1024,2),"fileCount":tc})

@app.route("/api/temp/clean",methods=["POST"])
def temp_clean():
    cs,cc,errs=0,0,[]
    for d in get_temp_dirs():
        for item in os.listdir(d):
            ip=os.path.join(d,item)
            try:
                if os.path.isfile(ip): cs+=os.path.getsize(ip); os.remove(ip); cc+=1
                elif os.path.isdir(ip):
                    for r,_,fs in os.walk(ip):
                        for f in fs:
                            try: cs+=os.path.getsize(os.path.join(r,f))
                            except: pass
                    shutil.rmtree(ip,ignore_errors=True); cc+=1
            except Exception as e: errs.append(str(e))
    add_history({"type":"temp_clean","filePath":"","details":f"Removed {cc} items ({round(cs/1024/1024,2)} MB)",
                 "threatLevel":"None","status":"cleaned","detectionMethod":"Manual","indicators":[],"confidenceScore":0})
    return jsonify({"success":True,"cleanedSize":cs,"cleanedSizeMb":round(cs/1024/1024,2),
                    "cleanedCount":cc,"errors":errs[:10]})

@app.route("/api/history",methods=["GET"])
def get_history():
    page=int(request.args.get("page",1)); ps=int(request.args.get("pageSize",50))
    ft=request.args.get("type",None); recs=load_history()
    if ft: recs=[r for r in recs if r.get("type")==ft]
    return jsonify({"items":recs[(page-1)*ps:page*ps],"total":len(recs)})

@app.route("/api/history",methods=["DELETE"])
def clear_history(): save_history([]); return jsonify({"success":True})

_start=time.time()

@app.route("/api/health",methods=["GET"])
def health():
    return jsonify({"status":"ok","version":"2.0.0","stack":"Python + Flask",
        "phishingModel":phishing_model is not None,
        "ransomwareModel":ransomware_model is not None,
        "defenderAvailable":DEFENDER_EXE is not None,
        "defenderPath":DEFENDER_EXE,"isAdmin":is_admin(),
        "timestamp":datetime.now().isoformat()})

@app.route("/api/stats",methods=["GET"])
def stats():
    recs=load_history(); up=int(time.time()-_start)
    h,m,s=up//3600,(up%3600)//60,up%60
    return jsonify({**_stats,
        "totalFilesScanned":_stats["scanned"],"totalThreatsDetected":_stats["threats"],
        "totalFilesBlocked":_stats["blocked"],"totalFilesQuarantined":_stats["quarantined"],
        "kernelDriverConnected":False,"defenderAvailable":DEFENDER_EXE is not None,
        "serviceUptime":f"{h}h {m}m {s}s","historyCount":len(recs),
        "phishingModelLoaded":phishing_model is not None,
        "ransomwareModelLoaded":ransomware_model is not None,
        "stack":"Python + Flask + Windows Defender","isAdmin":is_admin()})

@app.route("/api/protection/level",methods=["GET","POST"])
def protection_level():
    sf=BASE_DIR/"data"/"settings.json"
    if request.method=="POST":
        sf.write_text(json.dumps(request.get_json() or {},indent=2))
        return jsonify({"success":True})
    return jsonify(load_settings())

def start_watcher():
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler

        # Extensions to monitor — NO .js (causes false positives on minified JS)
        EXTS={".exe",".dll",".bat",".ps1",".vbs",".cmd",
              ".encrypted",".locked",".wncry",".cerber",".locky",
              ".crypto",".vault",".crypt",".zepto",".thor",".aesir"}

        # Folders to EXCLUDE from scanning (project files, temp build output)
        PROJECT_DIR  = str(BASE_DIR).lower()
        EXCLUDE_DIRS = [
            PROJECT_DIR,                                      # our own project
            os.path.expanduser("~/appdata").lower(),          # AppData
            str(Path(os.environ.get("TEMP",""))).lower(),     # Temp
            str(Path(os.environ.get("TMP",""))).lower(),      # Tmp
        ]

        def is_excluded(path_str):
            pl = path_str.lower()
            return any(pl.startswith(ex) for ex in EXCLUDE_DIRS if ex)

        class H(FileSystemEventHandler):
            def __init__(self): self._seen=set(); self._lock=threading.Lock()
            def _handle(self,path,rename=False):
                # Skip excluded directories
                if is_excluded(path): return
                # Skip non-target extensions
                if Path(path).suffix.lower() not in EXTS: return
                with self._lock:
                    if path in self._seen: return
                    self._seen.add(path)
                def scan():
                    time.sleep(0.5)
                    if not os.path.isfile(path): return
                    s=load_settings(); r=traditional_ransomware_scan(path)
                    if rename and r["threatLevel"]=="None":
                        r["isThreat"]=True; r["threatLevel"]="Medium"
                        r["indicators"].append("Renamed to ransomware extension")
                    if r["isThreat"]:
                        inc_stat("threats"); blocked=False
                        if s.get("useDefenderBlocking",True) and DEFENDER_EXE:
                            br=defender_remove_threat(path)
                            if br["success"]:
                                blocked=True; r["indicators"].append(f"Blocked: {br['method']}")
                        if not blocked and s.get("autoQuarantine",True):
                            qr=defender_quarantine(path)
                            if qr["success"]: r["indicators"].append(f"Quarantined: {qr['method']}")
                        add_history({"type":"ransomware","filePath":path,
                            "threatLevel":r["threatLevel"],
                            "detectionMethod":"Watcher+"+r["method"],
                            "details":r["details"],"confidenceScore":r["confidence"],
                            "indicators":r["indicators"],"status":"blocked" if blocked else "detected"})
                    with self._lock: self._seen.discard(path)
                threading.Thread(target=scan,daemon=True).start()
            def on_created(self,e):
                if not e.is_directory: self._handle(e.src_path)
            def on_modified(self,e):
                if not e.is_directory: self._handle(e.src_path)
            def on_moved(self,e):
                if not e.is_directory: self._handle(e.dest_path,rename=True)

        obs=Observer(); h=H()
        watch_paths=[
            os.path.expanduser("~/Desktop"),
            os.path.expanduser("~/Documents"),
            os.path.expanduser("~/Downloads"),
        ]
        for p in watch_paths:
            if os.path.isdir(p) and not is_excluded(p):
                obs.schedule(h,p,recursive=True)
                print(f"[OK] Watching: {p}")
        obs.daemon=True; obs.start()
        print("[OK] File watcher + Defender auto-block active")
    except ImportError: print("[WARN] watchdog not installed")
    except Exception as e: print(f"[WARN] Watcher: {e}")

threading.Thread(target=start_watcher,daemon=True).start()

if __name__=="__main__":
    print(f"SentinelGuard v2.0 | Admin:{is_admin()} | Defender:{DEFENDER_EXE or 'NOT FOUND'}")
    load_models()   # force reload before server starts
    app.run(host="127.0.0.1",port=57432,debug=False,threaded=True)
