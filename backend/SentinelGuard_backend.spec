# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('..\\models', 'models'), ('..\\data', 'data')],
    hiddenimports=['flask', 'flask_cors', 'flask.json.provider', 'werkzeug', 'werkzeug.serving', 'jinja2', 'click', 'xgboost', 'sklearn', 'sklearn.utils', 'numpy', 'numpy.core', 'watchdog', 'watchdog.observers', 'watchdog.observers.winapi', 'watchdog.events', 'ctypes', 'ctypes.wintypes', 'ipaddress', 'pickle', 'hashlib', 'struct', 'threading', 'subprocess'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'PIL', 'PyQt5'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SentinelGuard_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
