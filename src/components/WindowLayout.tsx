import { useEffect, useState } from "react";

import TopBar from "./TopBar";
import { Stage } from "./Stage";
import BottomControls from "./BottomControls";
import SidebarDrawer, { SIDEBAR_DRAWER_WIDTH } from "./SidebarDrawer";
import { LoadedFile } from "../players/PlayerContract";
import { useAnimationControls } from "../hooks/useAnimationControls";
import { useUiStore } from "../store/uiStore";

type LogLanguage = "en" | "ua";

export default function WindowLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const isFullScreen = useUiStore((s) => s.isFullScreen);
  const hydrated = useUiStore((s) => s.hydrated);
  const uiActions = useUiStore((s) => s.actions);

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

  // ===== Animation Controls =====
  const animationControls = useAnimationControls();

  // Reset controls when file changes
  useEffect(() => {
    animationControls.actions.registerControls(null);
  }, [file]);

  // ─────────────────────────────────────────────
  // Global Spacebar Hotkey (Play/Pause)
  // ─────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Spacebar
      if (e.key !== " " && e.code !== "Space") return;

      // Don't interfere if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);

      if (isInputFocused) return;

      // Only work if we have a file loaded and controls available
      if (!file || !animationControls.state.info) return;

      // Prevent default scrolling behavior
      e.preventDefault();

      // Toggle play/pause
      animationControls.actions.togglePlayPause();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [file, animationControls.state.info, animationControls.actions]);

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

  // ===== Restore settings (sidebar + fullscreen) =====
  useEffect(() => {
    if (!window.api?.readSettings) return;

    window.api
      .readSettings()
      .then((settings) => {
        uiActions.hydrate({
          sidebarOpen: !!settings?.sidebarOpen,
          isFullScreen: !!settings?.isFullScreen,
        });
      })
      .catch(() => {
        uiActions.hydrate({ sidebarOpen: false, isFullScreen: false });
      });

    window.api?.onFullScreenChanged?.((fs) => {
      uiActions.setIsFullScreen(fs);
    });
  }, []);

  // ===== Persist sidebar open state =====
  useEffect(() => {
    if (!hydrated) return;
    window.api?.writeSettings?.({ sidebarOpen });
  }, [hydrated, sidebarOpen]);

  // Curtain now compresses ONLY the animation area; top/bottom bars remain full width.
  const stageRightInsetPx = sidebarOpen ? SIDEBAR_DRAWER_WIDTH : 0;

  return (
    <div
      className="relative h-screen w-screen text-slate-300 overflow-hidden"
      style={{
        backgroundColor:
          backgroundTheme === "light"
            ? `rgba(255, 255, 255, ${backgroundOpacity})`
            : `rgba(0, 0, 0, ${backgroundOpacity})`,
      }}
    >
      <div className="flex flex-col h-full w-full">
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
        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{
            marginRight: stageRightInsetPx,
            transition: "margin-right 200ms ease-out",
          }}
        >
          <Stage
            file={file}
            showInfo={showInfo}
            logLanguage={logLanguage}
            onFileDrop={(path) => window.api?.openFileByPath?.(path)}
            onControlsReady={animationControls.actions.registerControls}
          />
        </div>










        <BottomControls
          state={animationControls.state}
          actions={animationControls.actions}
          speedOptions={animationControls.constants.SPEED_OPTIONS}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => uiActions.toggleSidebar()}
        />
      </div>

      <SidebarDrawer file={file} />
    </div>
  );
}
