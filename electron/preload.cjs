const { contextBridge, ipcRenderer } = require('electron');

/**
 * Єдиний публічний API для Renderer (React)
 * UI НЕ має прямого доступу до ipcRenderer
 */
contextBridge.exposeInMainWorld('api', {
  /* ===== Window controls ===== */

  window: {
    minimize: () => {
      console.log('[preload] Minimize clicked');
      ipcRenderer.send('ui:window-minimize');
    },

    maximize: () => {
      console.log('[preload] Maximize clicked');
      ipcRenderer.send('ui:window-maximize');
    },

    close: () => {
      console.log('[preload] Close clicked');
      ipcRenderer.send('ui:window-close');
    },
  },

  /* ===== Fullscreen ===== */

  toggleFullScreen: () => {
    ipcRenderer.send("ui:toggle-fullscreen");
  },

  onFullScreenChanged: (callback) => {
    ipcRenderer.on("app:full-screen-changed", (_event, isFullScreen) => {
      callback(!!isFullScreen);
    });
  },

  /* ===== Background ===== */

  setBackground: (color, opacity) => {
    ipcRenderer.send('ui:set-background', color, opacity);
  },

  onBackgroundChanged: (callback) => {
    ipcRenderer.on('app:background-changed', (_event, opacity, color) => {
      callback(opacity, color ?? '#000000');
    });
  },


  /* ===== Files ===== */

  openFile: () => {
    console.log('[preload] Open file clicked');
    ipcRenderer.send('ui:open-file');
  },

  openFileByPath: (filePath) => {
    ipcRenderer.send('ui:open-file-by-path', filePath);
  },

  getDirectoryFiles: (dirPath) => {
    return ipcRenderer.invoke("get-directory-files", dirPath);
  },

  getParentDirectory: (dirPath) => {
    return ipcRenderer.invoke("get-parent-directory", dirPath);
  },

  readSettings: () => {
    return ipcRenderer.invoke("read-settings");
  },

  writeSettings: (patch) => {
    return ipcRenderer.invoke("write-settings", patch);
  },

  openFileIPC: (filePath) => {
    return ipcRenderer.invoke("open-file", filePath);
  },

  openExternalUrl: (url) => {
    return ipcRenderer.invoke("open-external-url", url);
  },

  openImageFile: () => {
    return ipcRenderer.invoke('open-image-file');
  },

  readImageFiles: (dirPath) => {
    return ipcRenderer.invoke('read-image-files', dirPath);
  },

  saveMp4: (buffer, defaultName) => {
    return ipcRenderer.invoke('save-mp4', buffer, defaultName);
  },

  revealInExplorer: (filePath) => {
    return ipcRenderer.invoke('reveal-in-explorer', filePath);
  },

  onFileChanged: (callback) => {
    ipcRenderer.on('app:file-changed', (_event, fileInfo) => {
      callback(fileInfo);
    });
  },

  getRecentFiles: () => {
    return ipcRenderer.invoke('get-recent-files');
  },

  onWindowStateChanged: (callback) => {
    ipcRenderer.on('app:window-state-changed', (_event, state) => {
      callback(state);
    });
  },

  /* ===== Auto-updater ===== */

  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_event, version) => callback(version));
  },

  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update:downloaded', (_event, version) => callback(version));
  },

  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:download-progress', (_event, percent) => callback(percent));
  },

  installUpdate: () => {
    ipcRenderer.send('update:install');
  },

  checkForUpdates: () => {
    return ipcRenderer.invoke('update:check');
  },

});
