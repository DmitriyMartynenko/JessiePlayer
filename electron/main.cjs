const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const fs = require("fs");
const path = require("path");

console.log('[DEBUG] dialog available:', typeof dialog.showOpenDialog);

/* ===== Constants ===== */

const sizeFilePath = path.join(__dirname, 'window-size.json');
const backgroundStatePath = path.join(__dirname, 'background-state.json');

const FILE_FILTERS = [
  { name: 'Animations', extensions: ['json', 'lottie', 'webm'] },
];

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

/* ===== Create window ===== */

function createWindow() {
  const savedBounds = loadJSON(sizeFilePath, null);
  const savedBackground = loadJSON(backgroundStatePath, { opacity: 1, theme: 'dark' });

  backgroundOpacity = savedBackground.opacity ?? 1;
  backgroundTheme = savedBackground.theme ?? 'dark';

  mainWindow = new BrowserWindow({
    ...(savedBounds ?? { width: 900, height: 600 }),
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

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
  });

  /* Persist size and background on close */
  mainWindow.on('close', () => {
    if (windowState === 'normal') {
      saveJSON(sizeFilePath, mainWindow.getBounds());
    }
    saveJSON(backgroundStatePath, { opacity: backgroundOpacity, theme: backgroundTheme });
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

/* ===== IPC: Background ===== */

ipcMain.on('ui:toggle-background', () => {
  if (backgroundOpacity === 1) backgroundOpacity = 0.5;
  else if (backgroundOpacity === 0.5) backgroundOpacity = 0;
  else backgroundOpacity = 1;

  saveJSON(backgroundStatePath, { opacity: backgroundOpacity, theme: backgroundTheme });

  mainWindow?.webContents.send(
    'app:background-changed',
    backgroundOpacity,
    backgroundTheme
  );
});

ipcMain.on('ui:toggle-background-theme', () => {
  backgroundTheme = backgroundTheme === 'dark' ? 'light' : 'dark';
  saveJSON(backgroundStatePath, { opacity: backgroundOpacity, theme: backgroundTheme });

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
