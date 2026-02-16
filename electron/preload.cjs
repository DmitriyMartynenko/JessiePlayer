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

  /* ===== Subscriptions (поки заглушки) ===== */

  onStageChanged: (callback) => {
    ipcRenderer.on('app:file-changed', (_event, fileInfo) => {
  if (fileInfo?.type === 'lottie') {
    console.log(
      '[LOTTIE][PRELOAD] images keys:',
      Object.keys(fileInfo.images || {})
    );
  }

  callback(fileInfo);
});

  },

  onFileChanged: (callback) => {
    ipcRenderer.on('app:file-changed', (_event, fileInfo) => {
      console.log('[preload] File changed:', fileInfo);
      callback(fileInfo);
    });
  },

  /* ===== Сигнали для максимізації ===== */

  onWindowMaximized: (callback) => {
    ipcRenderer.on('set-maximized', (_event, maximized) => {
      console.log('[preload] Window maximized status received:', maximized);
      callback(maximized);
    });
  },
  onWindowStateChanged: (callback) => {
  ipcRenderer.on('app:window-state-changed', (_event, state) => {
    callback(state);
    });
  },

});
