const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("assistBall", {
  openAssistant: () => ipcRenderer.invoke("open-assistant"),
  getScreenshot: () => ipcRenderer.invoke("get-screenshot"),
  closeChat: () => ipcRenderer.invoke("close-chat"),
  recapture: () => ipcRenderer.invoke("recapture"),

  startBallDrag: (screenX, screenY) =>
    ipcRenderer.invoke("start-ball-drag", { screenX, screenY }),

  moveBall: (screenX, screenY) =>
    ipcRenderer.invoke("move-ball", { screenX, screenY }),

  endBallDrag: () => ipcRenderer.invoke("end-ball-drag")
});
