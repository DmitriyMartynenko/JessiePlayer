const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron');
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

/* ===== Constants ===== */

// Legacy (repo-local) paths (fallback only; new settings live in userData)
const legacySizeFilePath = path.join(__dirname, 'window-size.json');
const legacyBackgroundStatePath = path.join(__dirname, 'background-state.json');

const FILE_FILTERS = [
  { name: 'Animations', extensions: ['json', 'lottie', 'webm'] },
];

const SETTINGS_FILENAME = "settings.json";

/* ===== Runtime state ===== */

let mainWindow = null;
let windowState = 'normal';
let lastBounds = null;
let backgroundOpacity = 1;
let backgroundTheme = 'dark'; // 'dark' | 'light'

/* ===== Helpers ===== */

function loadJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data));
  } catch (e) {
    console.error('[STATE] failed to save', e);
  }
}

function getSettingsPath() {
  // app.getPath('userData') is available after app is ready
  const userDataDir = app.getPath("userData");
  return path.join(userDataDir, SETTINGS_FILENAME);
}

const DEFAULT_SETTINGS = {
  windowBounds: { width: 900, height: 600 },
  isFullScreen: false,
  sidebarOpen: false,
  background: { opacity: 1, theme: "dark" },
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function readSettingsSync() {
  const settingsPath = getSettingsPath();
  const existing = loadJSON(settingsPath, null);
  if (existing) return deepMerge(DEFAULT_SETTINGS, existing);

  // Fallback: migrate legacy files if present
  const legacyBounds = loadJSON(legacySizeFilePath, null);
  const legacyBackground = loadJSON(legacyBackgroundStatePath, { opacity: 1, theme: 'dark' });

  const migrated = deepMerge(DEFAULT_SETTINGS, {
    windowBounds: legacyBounds ? { width: legacyBounds.width, height: legacyBounds.height } : undefined,
    background: { opacity: legacyBackground.opacity ?? 1, theme: legacyBackground.theme ?? "dark" },
  });

  // Best-effort write migration so future loads use userData
  try {
    saveJSON(settingsPath, migrated);
  } catch {
    // ignore
  }

  return migrated;
}

function writeSettingsSync(patch) {
  const settingsPath = getSettingsPath();
  const current = readSettingsSync();
  const next = deepMerge(current, patch);
  saveJSON(settingsPath, next);
  return next;
}

/* ===== Create window ===== */

function createWindow() {
  const settings = readSettingsSync();
  backgroundOpacity = settings.background.opacity ?? 1;
  backgroundTheme = settings.background.theme ?? 'dark';

  mainWindow = new BrowserWindow({
    ...(settings.windowBounds ?? { width: 900, height: 600 }),
    // Use Jessie Player icon for taskbar / window
    icon: path.join(__dirname, '../src/images/icon.png'),
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (settings.isFullScreen) {
    mainWindow.setFullScreen(true);
  }

  const devURL = process.env.ELECTRON_RENDERER_URL;

  if (devURL) {
    mainWindow.loadURL(devURL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send(
      'app:background-changed',
      backgroundOpacity,
      backgroundTheme
    );
    mainWindow.webContents.send('app:full-screen-changed', mainWindow.isFullScreen());
  });

  /* Persist size and background on close */
  mainWindow.on('close', () => {
    if (!mainWindow) return;
    // If we close while in fullscreen, getBounds() is the monitor size.
    // Persist the *normal* window bounds instead so next launch restores
    // the pre-fullscreen size in windowed mode.
    const bounds = mainWindow.isFullScreen()
      ? mainWindow.getNormalBounds()
      : (windowState === "maximized" && lastBounds
          ? lastBounds
          : mainWindow.getBounds());
    writeSettingsSync({
      windowBounds: { width: bounds.width, height: bounds.height },
      // Always start in windowed mode on next launch.
      isFullScreen: false,
      background: { opacity: backgroundOpacity, theme: backgroundTheme },
    });
  });

  mainWindow.on("enter-full-screen", () => {
    if (!mainWindow) return;
    mainWindow.webContents.send("app:full-screen-changed", true);
    writeSettingsSync({ isFullScreen: true });
  });

  mainWindow.on("leave-full-screen", () => {
    if (!mainWindow) return;
    mainWindow.webContents.send("app:full-screen-changed", false);
    writeSettingsSync({ isFullScreen: false });
  });
}

/* ===== App lifecycle ===== */

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ===== IPC: Window controls ===== */

ipcMain.on('ui:window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('ui:window-maximize', () => {
  if (!mainWindow) return;

  if (windowState === 'normal') {
    lastBounds = mainWindow.getBounds();
    const { workArea } = screen.getPrimaryDisplay();
    mainWindow.setBounds(workArea);
    mainWindow.setResizable(false);
    windowState = 'maximized';
  } else {
    if (lastBounds) mainWindow.setBounds(lastBounds);
    mainWindow.setResizable(true);
    windowState = 'normal';
  }

  mainWindow.webContents.send('app:window-state-changed', windowState);
});

ipcMain.on('ui:window-close', () => {
  mainWindow?.close();
});

ipcMain.on("ui:toggle-fullscreen", () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

/* ===== IPC: Background ===== */

ipcMain.on('ui:toggle-background', () => {
  if (backgroundOpacity === 1) backgroundOpacity = 0.5;
  else if (backgroundOpacity === 0.5) backgroundOpacity = 0;
  else backgroundOpacity = 1;

  writeSettingsSync({ background: { opacity: backgroundOpacity, theme: backgroundTheme } });

  mainWindow?.webContents.send(
    'app:background-changed',
    backgroundOpacity,
    backgroundTheme
  );
});

ipcMain.on('ui:toggle-background-theme', () => {
  backgroundTheme = backgroundTheme === 'dark' ? 'light' : 'dark';
  writeSettingsSync({ background: { opacity: backgroundOpacity, theme: backgroundTheme } });

  mainWindow?.webContents.send(
    'app:background-changed',
    backgroundOpacity,
    backgroundTheme
  );
});

/* ===== IPC: Open file ===== */

const VALID_EXTENSIONS = ['json', 'lottie', 'webm'];

function loadAndSendFile(filePath) {
  if (!mainWindow) return;

  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const name = path.basename(filePath);

  if (!VALID_EXTENSIONS.includes(ext)) {
    console.warn('[FILE] Unsupported extension:', ext);
    return;
  }

  try {
    const stats = fs.statSync(filePath);

    const baseFile = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      extension: ext,
      size: stats.size,
      path: filePath,
    };

    if (ext === 'json') {
      const text = fs.readFileSync(filePath, 'utf-8');
      mainWindow.webContents.send('app:file-changed', { ...baseFile, text });
      return;
    }

    if (ext === 'lottie') {
      const buffer = fs.readFileSync(filePath);
      mainWindow.webContents.send('app:file-changed', {
        ...baseFile,
        buffer: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ),
      });
      return;
    }

    if (ext === 'webm') {
      const buffer = fs.readFileSync(filePath);
      mainWindow.webContents.send('app:file-changed', {
        ...baseFile,
        buffer: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ),
      });
      return;
    }

  } catch (err) {
    console.error('[ERROR] Failed to read file:', err);
  }
}

ipcMain.on('ui:open-file', async () => {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open animation file',
    properties: ['openFile'],
    filters: FILE_FILTERS,
  });

  if (result.canceled || !result.filePaths?.length) return;

  loadAndSendFile(result.filePaths[0]);
});

ipcMain.on('ui:open-file-by-path', (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) return;
  loadAndSendFile(filePath);
});

/* ===== IPC: Directory navigation (async, non-blocking) ===== */

function isSupportedFileName(name) {
  const ext = path.extname(name).toLowerCase();
  return ext === ".webm" || ext === ".json" || ext === ".lottie";
}

ipcMain.handle("get-directory-files", async (_event, dirPath) => {
  if (typeof dirPath !== "string" || !dirPath) return [];
  try {
    const dirents = await fsp.readdir(dirPath, { withFileTypes: true });
    const entries = [];

    for (const d of dirents) {
      if (d.isDirectory()) {
        entries.push({
          kind: "dir",
          name: d.name,
          path: path.join(dirPath, d.name),
        });
        continue;
      }

      if (d.isFile() && isSupportedFileName(d.name)) {
        const ext = path.extname(d.name).toLowerCase().replace(".", "");
        entries.push({
          kind: "file",
          name: d.name,
          extension: ext,
          path: path.join(dirPath, d.name),
        });
      }
    }

    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return entries;
  } catch (err) {
    console.error("[DIR] Failed to read dir:", dirPath, err);
    return [];
  }
});

ipcMain.handle("get-parent-directory", async (_event, dirPath) => {
  if (typeof dirPath !== "string" || !dirPath) return null;
  try {
    const resolved = path.resolve(dirPath);
    const parent = path.dirname(resolved);
    if (parent === resolved) return null;
    return parent;
  } catch {
    return null;
  }
});

/* ===== IPC: Settings (userData/settings.json) ===== */

ipcMain.handle("read-settings", async () => {
  return readSettingsSync();
});

ipcMain.handle("write-settings", async (_event, patch) => {
  if (!patch || typeof patch !== "object") return readSettingsSync();
  return writeSettingsSync(patch);
});

/* ===== IPC: open-file (invoke alias) ===== */

ipcMain.handle("open-file", async (_event, filePath) => {
  if (!mainWindow) return false;
  if (typeof filePath === "string" && filePath) {
    loadAndSendFile(filePath);
    return true;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open animation file',
    properties: ['openFile'],
    filters: FILE_FILTERS,
  });

  if (result.canceled || !result.filePaths?.length) return false;
  loadAndSendFile(result.filePaths[0]);
  return true;
});

/* ===== IPC: open URL in system default browser ===== */

ipcMain.handle("open-external-url", async (_event, url) => {
  if (typeof url !== "string" || !url.startsWith("http")) return;
  shell.openExternal(url);
});
