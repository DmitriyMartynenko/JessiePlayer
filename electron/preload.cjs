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

  /* ===== Stage / background ===== */

  toggleBackground: () => {
    console.log('[preload] Toggle background clicked');
    ipcRenderer.send('ui:toggle-background');
  },

  toggleBackgroundTheme: () => {
    console.log('[preload] Toggle background theme (right-click)');
    ipcRenderer.send('ui:toggle-background-theme');
  },

  /* ===== Background ===== */

  onBackgroundChanged: (callback) => {
    ipcRenderer.on('app:background-changed', (_event, opacity, theme) => {
      console.log('[preload] Background changed:', opacity, theme);
      callback(opacity, theme ?? 'dark');
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

  onFileChanged: (callback) => {
    ipcRenderer.on('app:file-changed', (_event, fileInfo) => {
      callback(fileInfo);
    });
  },

  onWindowStateChanged: (callback) => {
    ipcRenderer.on('app:window-state-changed', (_event, state) => {
      callback(state);
    });
  },

});
