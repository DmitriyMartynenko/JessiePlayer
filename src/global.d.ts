import type { LoadedFile } from "./players/PlayerContract";

declare global {
  type DirectoryEntry =
    | { kind: "dir"; name: string; path: string }
    | { kind: "file"; name: string; path: string; extension: string };

  type AppSettings = {
    windowBounds?: { width: number; height: number };
    isFullScreen?: boolean;
    sidebarOpen?: boolean;
    background?: { opacity: number; color: string };
  };

  interface Window {
    api: {
      onWindowStateChanged: (
        callback: (state: "normal" | "maximized") => void
      ) => void;
      onFileChanged: (callback: (fileInfo: LoadedFile) => void) => void;
      onBackgroundChanged: (
        callback: (opacity: number, color: string) => void
      ) => void;
      setBackground: (color: string, opacity: number) => void;
      openFile: () => void;
      openFileByPath: (filePath: string) => void;
      toggleFullScreen: () => void;
      onFullScreenChanged: (callback: (isFullScreen: boolean) => void) => void;
      getDirectoryFiles: (dirPath: string) => Promise<DirectoryEntry[]>;
      getParentDirectory: (dirPath: string) => Promise<string | null>;
      readSettings: () => Promise<AppSettings>;
      writeSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      openFileIPC?: (filePath?: string) => Promise<boolean>;
      openExternalUrl: (url: string) => Promise<void>;
      openImageFile: () => Promise<{ dataUrl: string } | null>;
      getRecentFiles: () => Promise<Array<{ path: string; name: string; extension: string }>>;
      readImageFiles: (dirPath: string) => Promise<Record<string, string>>;
      saveMp4: (buffer: ArrayBuffer, defaultName?: string) => Promise<string | null>;
      revealInExplorer: (filePath: string) => Promise<void>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      onUpdateProgress: (callback: (percent: number) => void) => void;
      installUpdate: () => void;
      checkForUpdates: () => Promise<string | null>;
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}

export {};
