import { useEffect, useState, useRef } from "react";

import TopBar from "./TopBar";
import { Stage } from "./Stage";
import BottomControls from "./BottomControls";
import { LoadedFile } from "../players/PlayerContract";

type LogLanguage = "en" | "ua";

export default function WindowLayout() {
  // ===== Window state =====
  const [windowState, setWindowState] = useState<"normal" | "maximized">(
    "normal"
  );

	
  const [backgroundOpacity, setBackgroundOpacity] = useState<1 | 0.5 | 0>(1);
  const [backgroundTheme, setBackgroundTheme] = useState<"dark" | "light">("dark");
  





  


  // ===== Current file (SINGLE SOURCE OF TRUTH) =====
  const [file, setFile] = useState<LoadedFile | null>(null);

  // Animation info panel visibility (pure React state, no IPC)
  const [showInfo, setShowInfo] = useState(false);

  // Language for Log diagnostics (EN / UA)
  const [logLanguage, setLogLanguage] = useState<LogLanguage>("en");


  useEffect(() => {
    if (!window.api) {
      console.error("[UI] window.api is NOT available");
      return;
    }

    console.log("[UI] window.api available");

    // ===== Window state changes =====
    window.api.onWindowStateChanged((state) => {
      console.log("[UI] window state changed:", state);
      setWindowState(state);
    });

    // ===== File selected =====
    window.api.onFileChanged((fileInfo) => {
      console.log("[UI] app:file-changed received:", fileInfo);
      setFile(fileInfo);
    });


    // ===== Background opacity & theme =====
    window.api.onBackgroundChanged((opacity: 1 | 0.5 | 0, theme?: "dark" | "light") => {
      console.log("[UI] background changed:", opacity, theme);
      setBackgroundOpacity(opacity);
      setBackgroundTheme(theme ?? "dark");
    });

  }, []);

  return (
    <div
	className="flex flex-col h-screen w-screen text-slate-300 overflow-hidden"
  	style={{
    	  backgroundColor: backgroundTheme === "light"
    	    ? `rgba(255, 255, 255, ${backgroundOpacity})`
    	    : `rgba(0, 0, 0, ${backgroundOpacity})`,
  	}}
    >



      <TopBar
        windowState={windowState}
        file={file}
        showInfo={showInfo}
        logLanguage={logLanguage}
        onToggleInfo={() => setShowInfo((v) => !v)}
        onToggleInfoLanguage={() =>
          setLogLanguage((prev) => (prev === "en" ? "ua" : "en"))
        }
      />

      {/* Stage — flex-1 + min-h-0 щоб приймав залишок простору і міг стискатися */}
      <div className="flex-1 min-h-0 flex flex-col">
        <Stage
          file={file}
          showInfo={showInfo}
          logLanguage={logLanguage}
          onFileDrop={(path) => window.api?.openFileByPath?.(path)}
        />
      </div>










      <BottomControls />
    </div>
  );
}
