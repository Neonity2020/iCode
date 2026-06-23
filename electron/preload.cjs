const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("icode", {
  getState: () => ipcRenderer.invoke("icode:get-state"),
  pickDirectory: () => ipcRenderer.invoke("icode:pick-directory"),
  startThread: (payload) => ipcRenderer.invoke("icode:codex-start-thread", payload),
  sendTurn: (payload) => ipcRenderer.invoke("icode:codex-send-turn", payload),
  interruptTurn: (payload) => ipcRenderer.invoke("icode:codex-interrupt", payload),
  respondToCodex: (payload) => ipcRenderer.invoke("icode:codex-respond", payload),
  onCodexEvent: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on("icode:codex-event", handler);
    return () => ipcRenderer.removeListener("icode:codex-event", handler);
  },
  openExternal: (url) => ipcRenderer.invoke("icode:open-external", url),
  revealInFinder: (filePath) => ipcRenderer.invoke("icode:reveal-in-finder", filePath),
  ptySpawn: (payload) => ipcRenderer.invoke("icode:pty-spawn", payload),
  ptyWrite: (payload) => ipcRenderer.invoke("icode:pty-write", payload),
  ptyResize: (payload) => ipcRenderer.invoke("icode:pty-resize", payload),
  ptyKill: (payload) => ipcRenderer.invoke("icode:pty-kill", payload),
  onPtyData: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on("icode:pty-data", handler);
    return () => ipcRenderer.removeListener("icode:pty-data", handler);
  },
  onPtyExit: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on("icode:pty-exit", handler);
    return () => ipcRenderer.removeListener("icode:pty-exit", handler);
  },
  listFs: (payload) => ipcRenderer.invoke("icode:fs-list", payload),
  platform: process.platform,
});
