import type { LoadedFile } from "./players/PlayerContract";

declare global {
  type DirectoryEntry =
    | { kind: "dir"; name: string; path: string }
    | { kind: "file"; name: string; path: string; extension: string };

  type AppSettings = {
    windowBounds?: { width: number; height: number };
    isFullScreen?: boolean;
    sidebarOpen?: boolean;
    background?: { opacity: 1 | 0.5 | 0; theme: "dark" | "light" };
  };

  interface Window {
    api: {
      onWindowStateChanged: (
        callback: (state: "normal" | "maximized") => void
      ) => void;
      onFileChanged: (callback: (fileInfo: LoadedFile) => void) => void;
      onBackgroundChanged: (
        callback: (opacity: 1 | 0.5 | 0, theme?: "dark" | "light") => void
      ) => void;
      toggleBackground: () => void;
      toggleBackgroundTheme: () => void;
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
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}

export {};
