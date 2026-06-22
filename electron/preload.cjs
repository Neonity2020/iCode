const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("icode", {
  pickDirectory: () => ipcRenderer.invoke("icode:pick-directory"),
  openExternal: (url) => ipcRenderer.invoke("icode:open-external", url),
  platform: process.platform,
});
