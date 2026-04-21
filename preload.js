// preload.js  –  Secure context bridge
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  getVersion:       ()      => ipcRenderer.invoke("get-app-version"),
  getBackendStatus: ()      => ipcRenderer.invoke("get-backend-status"),
  openExternal:     (url)   => ipcRenderer.invoke("open-external", url),
  showNotification: (opts)  => ipcRenderer.invoke("show-notification", opts),
  minimizeWindow:   ()      => ipcRenderer.invoke("minimize-window"),
  maximizeWindow:   ()      => ipcRenderer.invoke("maximize-window"),
  onBackendReady:   (cb)    => ipcRenderer.on("backend-ready",  cb),
  onBackendFailed:  (cb)    => ipcRenderer.on("backend-failed", cb),
});
