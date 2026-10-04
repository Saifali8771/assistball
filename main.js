const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require("electron");
const path = require("path");

let mainWindow;
let chatWindow;
let latestScreenshot = null;
let dragState = null;

const BALL_SIZE = 72;
const CHAT_WIDTH = 400;
const CHAT_HEIGHT = 610;

function createBallWindow() {
  mainWindow = new BrowserWindow({
    width: BALL_SIZE,
    height: BALL_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function showBall() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.focus();
}

function openChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return;
  }

  const bounds = mainWindow.getBounds();

  chatWindow = new BrowserWindow({
    width: CHAT_WIDTH,
    height: CHAT_HEIGHT,
    x: Math.max(10, bounds.x - CHAT_WIDTH + BALL_SIZE),
    y: Math.max(10, bounds.y - CHAT_HEIGHT + BALL_SIZE),
    minWidth: 340,
    minHeight: 500,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  chatWindow.setAlwaysOnTop(true, "floating");
  chatWindow.loadFile(path.join(__dirname, "index.html"), {
    query: { mode: "chat" }
  });

  chatWindow.once("ready-to-show", () => {
    chatWindow.show();
    chatWindow.focus();
  });

  chatWindow.on("closed", () => {
    chatWindow = null;
    showBall();
  });
}

async function captureFullScreen() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scale = primaryDisplay.scaleFactor || 1;

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(width * scale),
      height: Math.round(height * scale)
    },
    fetchWindowIcons: false
  });

  if (!sources.length) throw new Error("No screen source was found.");

  const source =
    sources.find((s) => String(s.display_id) === String(primaryDisplay.id)) ||
    sources[0];

  const image = source.thumbnail;
  if (image.isEmpty()) throw new Error("Electron returned an empty screenshot.");

  return image.toPNG();
}

ipcMain.handle("start-ball-drag", (_event, { screenX, screenY }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const bounds = mainWindow.getBounds();
  dragState = {
    offsetX: screenX - bounds.x,
    offsetY: screenY - bounds.y,
    moved: false
  };
  return true;
});

ipcMain.handle("move-ball", (_event, { screenX, screenY }) => {
  if (!mainWindow || mainWindow.isDestroyed() || !dragState) return false;

  const x = Math.round(screenX - dragState.offsetX);
  const y = Math.round(screenY - dragState.offsetY);

  if (!dragState.moved && Math.hypot(
    screenX - (dragState.offsetX + mainWindow.getBounds().x),
    screenY - (dragState.offsetY + mainWindow.getBounds().y)
  ) > 4) {
    dragState.moved = true;
  }

  mainWindow.setPosition(x, y, false);
  return true;
});

ipcMain.handle("end-ball-drag", () => {
  const moved = !!dragState?.moved;
  dragState = null;
  return { moved };
});

ipcMain.handle("open-assistant", async () => {
  try {
    mainWindow.hide();
    await new Promise((resolve) => setTimeout(resolve, 150));

    latestScreenshot = await captureFullScreen();
    openChatWindow();

    return { ok: true, message: "Screen captured successfully." };
  } catch (error) {
    console.error("Screenshot error:", error);
    showBall();
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("get-screenshot", async () => {
  if (!latestScreenshot) {
    return { ok: false, message: "No screenshot is available." };
  }

  return {
    ok: true,
    base64: latestScreenshot.toString("base64"),
    mime: "image/png"
  };
});

ipcMain.handle("close-chat", () => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.close();
  } else {
    showBall();
  }
  return { ok: true };
});

ipcMain.handle("recapture", async () => {
  try {
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide();
    await new Promise((resolve) => setTimeout(resolve, 150));

    latestScreenshot = await captureFullScreen();

    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.show();
      chatWindow.focus();
    }

    return { ok: true, message: "Screen recaptured." };
  } catch (error) {
    console.error("Recapture error:", error);
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.show();
      chatWindow.focus();
    }
    return { ok: false, message: error.message };
  }
});

app.whenReady().then(() => {
  createBallWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createBallWindow();
  });
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy();
});
