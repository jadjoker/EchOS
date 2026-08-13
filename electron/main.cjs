/**
 * The desktop shell. EchOS ships as a Steam application, not a web page.
 *
 * CommonJS on purpose: the app itself is ESM, but Electron's main process is
 * simplest as .cjs and this file has no reason to be clever.
 *
 * The renderer is the game exactly as it runs in a browser. Nothing here is
 * allowed to become a second implementation of anything: no game logic, no
 * generation, no window management. Those belong to the machine inside the
 * window, which already has its own.
 */

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

/**
 * Run against the Vite dev server instead of a built bundle.
 *
 * A flag rather than an env var so one script line works the same on Windows
 * and everywhere else, without pulling in a dependency just to set a variable.
 */
const DEV_URL = process.argv.includes("--dev")
  ? (process.env.ELECTRON_START_URL ?? "http://localhost:5173")
  : null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // The machine draws its own everything. A white flash before the boot
    // sequence would be the first thing anyone sees, so start dark.
    backgroundColor: "#000000",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // The renderer is a self-contained web app that needs nothing from Node.
      // Keeping it sandboxed means a generated page can never reach the disk,
      // which matters more here than in most apps: this game generates and
      // renders arbitrary content by design.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Shown only once the first frame is ready, so there is no empty window
  // sitting there while the bundle parses.
  win.once("ready-to-show", () => win.show());

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // A generated site is not a real site. Nothing in this game should ever be
  // able to open a real browser or send the shell somewhere else.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  /**
   * Blocking every navigation was too blunt and broke the game.
   *
   * "New machine" and "Boot this seed" both work by putting the seed in the
   * URL and reloading, which is a navigation, so the shell was quietly
   * refusing the one control the whole game is built around. It went unnoticed
   * because in a browser there is nothing doing the blocking.
   *
   * So: the machine may navigate to itself, and nothing else.
   */
  win.webContents.on("will-navigate", (event, url) => {
    let allowed = false;
    try {
      const target = new URL(url);
      allowed = DEV_URL
        ? target.origin === new URL(DEV_URL).origin
        : target.protocol === "file:";
    } catch {
      allowed = false;
    }
    if (!allowed) event.preventDefault();
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  // macOS keeps the app alive with no windows; reopening should give one back.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Belt and braces alongside the per-window handler above.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Deliberately not opening it. Left explicit so the decision is visible
    // rather than looking like an oversight.
    void shell;
    void url;
    return { action: "deny" };
  });
});
