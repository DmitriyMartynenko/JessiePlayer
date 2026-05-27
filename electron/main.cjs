const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron');
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { autoUpdater } = require("electron-updater");

/* ===== Constants ===== */

// Legacy (repo-local) paths (fallback only; new settings live in userData)
const legacySizeFilePath = path.join(__dirname, 'window-size.json');
const legacyBackgroundStatePath = path.join(__dirname, 'background-state.json');

const FILE_FILTERS = [
  { name: 'Animations', extensions: ['json', 'lottie', 'webm', 'gif'] },
];

const SETTINGS_FILENAME = "settings.json";

/* ===== Runtime state ===== */

let mainWindow = null;
/** @type {string | null} Pending file path from argv or open-file (macOS) before window is ready */
let pendingOpenFilePath = null;
let windowState = 'normal';
let lastBounds = null;
let backgroundOpacity = 1;
let backgroundColor = '#000000';

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
  background: { opacity: 1, color: '#000000' },
  recentFiles: [],
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
  // Migrate old theme-based setting to hex color
  backgroundColor = settings.background.color
    ?? (settings.background.theme === 'light' ? '#ffffff' : '#000000');

  const iconPath = path.join(__dirname, '../src/images/icon.png');
  mainWindow = new BrowserWindow({
    ...(settings.windowBounds ?? { width: 900, height: 600 }),
    ...(fs.existsSync(iconPath) && { icon: iconPath }),
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
      backgroundColor
    );
    mainWindow.webContents.send('app:full-screen-changed', mainWindow.isFullScreen());
    if (pendingOpenFilePath) {
      loadAndSendFile(pendingOpenFilePath);
      pendingOpenFilePath = null;
    }
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
      background: { opacity: backgroundOpacity, color: backgroundColor },
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

/* ===== Single instance (Open with / file association) ===== */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, cwd) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const filePath = getFilePathFromArgv(argv, cwd);
      if (filePath) loadAndSendFile(filePath);
    } else {
      const filePath = getFilePathFromArgv(argv, cwd);
      if (filePath) pendingOpenFilePath = filePath;
    }
  });

  /* macOS: open-file when user opens file from Finder (or double-clicks associated file) */
  app.on('open-file', (event, pathToOpen) => {
    event.preventDefault();
    if (mainWindow) {
      loadAndSendFile(pathToOpen);
    } else {
      pendingOpenFilePath = pathToOpen;
    }
  });

  app.whenReady().then(() => {
    const pathFromArgv = getFilePathFromArgv(process.argv, process.cwd());
    if (pathFromArgv) pendingOpenFilePath = pathFromArgv;
    createWindow();
    setupAutoUpdater();
  });
}

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

ipcMain.on('ui:set-background', (_event, color, opacity) => {
  if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
    backgroundColor = color;
  }
  if (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) {
    backgroundOpacity = opacity;
  }
  writeSettingsSync({ background: { opacity: backgroundOpacity, color: backgroundColor } });
  mainWindow?.webContents.send('app:background-changed', backgroundOpacity, backgroundColor);
});

/* ===== IPC: Open file ===== */

const VALID_EXTENSIONS = ['json', 'lottie', 'webm', 'gif'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']; // used only for open-image-file IPC

function addRecentFile(filePath) {
  try {
    const settings = readSettingsSync();
    const recent = ((settings.recentFiles) || []).filter(p => p !== filePath);
    recent.unshift(filePath);
    writeSettingsSync({ recentFiles: recent.slice(0, 10) });
  } catch { /* ignore */ }
}

/**
 * From process.argv (or second-instance argv), find the first path that is a supported file.
 * Works for "Open with" on Windows and similar flows.
 * @param {string[]} argv - process.argv or second-instance argv
 * @param {string} [cwd] - Working directory for relative paths
 * @returns {string | null}
 */
function getFilePathFromArgv(argv, cwd) {
  if (!Array.isArray(argv) || argv.length === 0) return null;
  const baseDir = cwd || process.cwd();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    const ext = path.extname(arg).toLowerCase().replace('.', '');
    if (!VALID_EXTENSIONS.includes(ext)) continue;
    const resolved = path.isAbsolute(arg) ? arg : path.resolve(baseDir, arg);
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    } catch {
      // ignore
    }
  }
  return null;
}

function loadAndSendFile(filePath) {
  if (!mainWindow) return;

  const ext  = path.extname(filePath).toLowerCase().replace('.', '');
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
      addRecentFile(filePath);
      return;
    }

    if (ext === 'lottie') {
      const buffer = fs.readFileSync(filePath);
      mainWindow.webContents.send('app:file-changed', {
        ...baseFile,
        buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      });
      addRecentFile(filePath);
      return;
    }

    if (ext === 'webm' || ext === 'gif') {
      const buffer = fs.readFileSync(filePath);
      mainWindow.webContents.send('app:file-changed', {
        ...baseFile,
        buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      });
      addRecentFile(filePath);
      return;
    }

  } catch (err) {
    console.error('[ERROR] Failed to read file:', err);
  }
}

/* ===== IPC: Recent files ===== */
ipcMain.handle('get-recent-files', async () => {
  const settings = readSettingsSync();
  const recent = (settings.recentFiles || []).filter(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  // Return with metadata
  return recent.map(p => ({
    path: p,
    name: path.basename(p),
    extension: path.extname(p).toLowerCase().replace('.', ''),
  }));
});

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
  return ext === ".webm" || ext === ".json" || ext === ".lottie" || ext === ".gif";
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

/* ===== IPC: Open background image (Compose mode) ===== */

ipcMain.handle('open-image-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select background image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths?.length) return null;
  try {
    const buf  = await fsp.readFile(result.filePaths[0]);
    const ext  = path.extname(result.filePaths[0]).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (err) {
    console.error('[IMAGE] Failed to load:', err);
    return null;
  }
});

/* ===== IPC: Read image files for export (external Lottie images) ===== */

ipcMain.handle('read-image-files', async (_event, dirPath) => {
  if (typeof dirPath !== 'string' || !dirPath) return {};
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const result = {};
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const buf = await fsp.readFile(fullPath);
      const mime =
        ext === '.png'  ? 'image/png'  :
        ext === '.webp' ? 'image/webp' :
        ext === '.gif'  ? 'image/gif'  : 'image/jpeg';
      result[entry.name] = `data:${mime};base64,${buf.toString('base64')}`;
    }
    return result;
  } catch {
    return {};
  }
});

/* ===== IPC: Save exported file (MP4 / WebM / GIF) ===== */

const FORMAT_FILTERS = {
  mp4:  [{ name: 'MP4 Video',  extensions: ['mp4']  }],
  webm: [{ name: 'WebM Video', extensions: ['webm'] }],
  gif:  [{ name: 'GIF Image',  extensions: ['gif']  }],
};

ipcMain.handle('save-mp4', async (_event, buffer, defaultName) => {
  if (!mainWindow) return null;
  const ext = (defaultName || '').split('.').pop()?.toLowerCase() || 'mp4';
  const filters = FORMAT_FILTERS[ext] || FORMAT_FILTERS.mp4;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save file',
    defaultPath: defaultName || 'animation.mp4',
    filters,
  });
  if (result.canceled || !result.filePath) return null;
  await fsp.writeFile(result.filePath, Buffer.from(buffer));
  return result.filePath;
});

ipcMain.handle('reveal-in-explorer', async (_event, filePath) => {
  if (typeof filePath === 'string') shell.showItemInFolder(filePath);
});

/* ===== IPC: open URL in system default browser ===== */

ipcMain.handle("open-external-url", async (_event, url) => {
  if (typeof url !== "string" || !url.startsWith("http")) return;
  shell.openExternal(url);
});

/* ===== Auto-updater ===== */

function setupAutoUpdater() {
  // In dev mode there's nothing to update — skip silently.
  if (process.env.ELECTRON_RENDERER_URL) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, ...args) => mainWindow?.webContents?.send(channel, ...args);

  autoUpdater.on("update-available", (info) => {
    send("update:available", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    send("update:not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    send("update:download-progress", Math.floor(progress.percent));
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("update:downloaded", info.version);
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err.message);
  });

  // Check for updates 5 seconds after launch (non-blocking).
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
}

// IPC: renderer can trigger install-and-restart
ipcMain.on("update:install", () => {
  autoUpdater.quitAndInstall();
});

// IPC: manual check from renderer
ipcMain.handle("update:check", async () => {
  if (process.env.ELECTRON_RENDERER_URL) return null;
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo?.version ?? null;
  } catch {
    return null;
  }
});
