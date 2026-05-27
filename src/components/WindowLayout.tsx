import { useEffect, useRef, useState } from "react";

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${opacity})`;
}

import TopBar from "./TopBar";
import { Stage } from "./Stage";
import BottomControls from "./BottomControls";
import SidebarDrawer, { SIDEBAR_DRAWER_WIDTH } from "./SidebarDrawer";
import ExportModal, { ComposeExportInfo } from "./ExportModal";
import { LoadedFile } from "../players/PlayerContract";
import { useAnimationControls } from "../hooks/useAnimationControls";
import { useUiStore } from "../store/uiStore";

type LogLanguage = "en" | "ua";

export default function WindowLayout() {
  const sidebarOpen      = useUiStore((s) => s.sidebarOpen);
  const isFullScreen     = useUiStore((s) => s.isFullScreen);
  const hydrated         = useUiStore((s) => s.hydrated);
  const scaleMode         = useUiStore((s) => s.scaleMode);
  const composeImage      = useUiStore((s) => s.composeImage);
  const composeTransform  = useUiStore((s) => s.composeTransform);
  const composeCanvasSize = useUiStore((s) => s.composeCanvasSize);
  const uiActions         = useUiStore((s) => s.actions);

  // ===== Window state =====
  const [windowState, setWindowState] = useState<"normal" | "maximized">(
    "normal"
  );

  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(1);
  const [backgroundColor, setBackgroundColor] = useState<string>("#000000");
  // Hover preview — applied visually only, not persisted
  const [bgPreview, setBgPreview] = useState<{ color?: string; opacity?: number } | null>(null);

  // ===== Current file (SINGLE SOURCE OF TRUTH) =====
  const [file, setFile] = useState<LoadedFile | null>(null);

  // Animation info panel visibility (pure React state, no IPC)
  const [showInfo, setShowInfo]     = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Language for Log diagnostics (EN / UA)
  const [logLanguage, setLogLanguage] = useState<LogLanguage>("en");

  // ===== Auto-update =====
  const [updateVersion, setUpdateVersion]     = useState<string | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updatePercent, setUpdatePercent]     = useState<number | null>(null);

  // ===== Animation Controls =====
  const animationControls = useAnimationControls();

  // Reset controls when file changes
  useEffect(() => {
    animationControls.actions.registerControls(null);
  }, [file, animationControls.actions.registerControls]);

  // ─────────────────────────────────────────────
  // Global Spacebar Hotkey (Play/Pause)
  // ─────────────────────────────────────────────

  const togglePlayPauseRef = useRef(animationControls.actions.togglePlayPause);
  togglePlayPauseRef.current = animationControls.actions.togglePlayPause;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;

      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable);

      if (isInputFocused) return;
      if (!file || !animationControls.state.info) return;

      e.preventDefault();
      togglePlayPauseRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, animationControls.state.info]);

  useEffect(() => {
    if (!window.api) return;

    window.api.onWindowStateChanged(setWindowState);
    window.api.onFileChanged(setFile);

    window.api.onBackgroundChanged((opacity: number, color: string) => {
      setBackgroundOpacity(opacity);
      setBackgroundColor(color ?? "#000000");
    });

    window.api.onUpdateAvailable?.((version) => {
      setUpdateVersion(version);
      setUpdateDownloaded(false);
      setUpdatePercent(0);
    });

    window.api.onUpdateProgress?.((percent) => {
      setUpdatePercent(percent);
    });

    window.api.onUpdateDownloaded?.((version) => {
      setUpdateVersion(version);
      setUpdateDownloaded(true);
      setUpdatePercent(null);
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
        backgroundColor: hexToRgba(
          bgPreview?.color ?? backgroundColor,
          bgPreview?.opacity ?? backgroundOpacity,
        ),
      }}
    >
      <div className="flex flex-col h-full w-full">
        <TopBar
          windowState={windowState}
          file={file}
          showInfo={showInfo}
          logLanguage={logLanguage}
          backgroundColor={backgroundColor}
          backgroundOpacity={backgroundOpacity}
          onBgChange={(color, opacity) => {
            setBackgroundColor(color);
            setBackgroundOpacity(opacity);
            setBgPreview(null);
            window.api?.setBackground?.(color, opacity);
          }}
          onBgPreview={setBgPreview}
          onToggleInfo={() => setShowInfo((v) => !v)}
          onToggleInfoLanguage={() =>
            setLogLanguage((prev) => (prev === "en" ? "ua" : "en"))
          }
        />

      {/* Update banner */}
      {updateVersion && (
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 text-xs select-none"
             style={{ background: "#1a2e1a", borderBottom: "1px solid #2d4a2d" }}>
          <span style={{ color: "#6ee7b7" }}>
            {updateDownloaded
              ? `Jessie Player ${updateVersion} завантажено — готово до встановлення`
              : updatePercent !== null
                ? `Завантаження оновлення ${updateVersion}… ${updatePercent}%`
                : `Доступне оновлення ${updateVersion}`}
          </span>
          <div className="flex items-center gap-2">
            {updateDownloaded && (
              <button
                onClick={() => window.api?.installUpdate?.()}
                className="px-2.5 py-0.5 rounded text-xs font-medium transition-colors"
                style={{ background: "#34d399", color: "#000" }}
              >
                Встановити і перезапустити
              </button>
            )}
            <button
              onClick={() => setUpdateVersion(null)}
              className="text-neutral-600 hover:text-neutral-400 transition-colors"
            >✕</button>
          </div>
        </div>
      )}

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
          hasFile={!!file}
          onToggleSidebar={() => uiActions.toggleSidebar()}
          onExport={() => setShowExport(true)}
        />
      </div>

      <SidebarDrawer file={file} />

      {showExport && file && (
        <ExportModal
          file={file}
          backgroundColor={backgroundColor}
          backgroundOpacity={backgroundOpacity}
          composeInfo={
            scaleMode === "compose"
              ? {
                  bgImage:           composeImage,
                  transform:         composeTransform,
                  canvasSize:        composeCanvasSize,
                  backgroundColor:   backgroundColor,
                  backgroundOpacity: backgroundOpacity,
                }
              : undefined
          }
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
