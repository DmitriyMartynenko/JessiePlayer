import type { LoadedFile } from "./players/PlayerContract";

declare global {
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
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
    };
  }
}

export {};
