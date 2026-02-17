import { useRef } from "react";
import { LoadedFile, AnimationControls } from "../players/PlayerContract";
import { PlayerWarnings } from "../components/PlayerWarnings";
import StageContextMenu from "../components/StageContextMenu";
import { AnimationInfoPanel } from "./ui/AnimationInfoPanel";
import { useStageLogic } from "./StageLogic";
import iconImage from "../images/icon.png";

// ─────────────────────────────────────────────
// STAGE = UI COMPONENT (Logic extracted to StageLogic)
// ─────────────────────────────────────────────

type LogLanguage = "en" | "ua";

type Props = {
  file: LoadedFile | null;
  onFileDrop?: (filePath: string) => void;
  showInfo: boolean;
  logLanguage: LogLanguage;
  onControlsReady?: (controls: AnimationControls) => void;
};

export function Stage({ file, onFileDrop, showInfo, logLanguage, onControlsReady }: Props) {
  // Use extracted logic hook
  const { state, actions } = useStageLogic(file, onFileDrop);

  // Local refs for mouse drag handling (UI-specific)
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // ─────────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────────

  if (!file || !state.PlayerComponent) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-4 text-center text-[1.20rem] text-neutral-500 select-none transition-colors cursor-pointer ${
          state.isDragOver ? "bg-slate-700/30 ring-2 ring-inset ring-slate-500 rounded" : ""
        }`}
        onDragOver={actions.handleDragOver}
        onDragLeave={actions.handleDragLeave}
        onDrop={actions.handleDrop}
        onClick={() => {
          if (window.api?.openFile) {
            window.api.openFile();
          }
        }}
      >
        <img 
          src={iconImage} 
          alt="Jessie Player" 
          className="w-24 h-24 opacity-80 hover:opacity-100 transition-opacity"
        />
        <div className="flex flex-col gap-2">
          <span>🎬 Drag your <strong>json</strong>, <strong>lottie</strong>, or <strong>webm</strong> file here</span>
          <span className="text-base">Or click anywhere to select a file</span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div
      className={`relative flex-1 min-h-0 w-full overflow-hidden transition-colors ${
        state.isDragOver ? "ring-2 ring-inset ring-slate-500 bg-slate-700/20" : ""
      }`}
      onDragOver={actions.handleDragOver}
      onDragLeave={actions.handleDragLeave}
      onDrop={actions.handleDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        actions.setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onWheel={(e) => {
        if (state.scaleMode !== "original") return;

        if (e.deltaY < 0) actions.zoomBy(0.1);
        else actions.zoomBy(-0.1);
      }}
      onMouseDown={(e) => {
        if (state.scaleMode !== "original") return;

        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!isDragging.current) return;

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;

        actions.setOffset((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));

        lastMouse.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={() => {
        isDragging.current = false;
      }}
      onMouseLeave={() => {
        isDragging.current = false;
      }}
    >
      {/* VIEWPORT — fixed size; pan/scale applied inside player so clipping is at Stage edge only */}
      <div
        className="absolute inset-0 min-h-0 min-w-0"
        style={{
          cursor:
            state.scaleMode === "original"
              ? isDragging.current
                ? "grabbing"
                : "grab"
              : "default",
        }}
      >
        <state.PlayerComponent
          file={file}
          scaleMode={state.scaleMode}
          scale={state.scale}
          background={state.background}
          panOffset={state.scaleMode === "original" ? state.offset : undefined}
          onStatus={actions.handleStatus}
          onControlsReady={onControlsReady}
        />
      </div>

      {/* Animation technical diagnostics panel */}
      <AnimationInfoPanel
        diagnostics={state.diagnostics}
        visible={showInfo}
        language={logLanguage}
      />

      {/* ZOOM INDICATOR */}
      {state.scaleMode === "original" && state.showZoomIndicator && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2
                     px-3 py-1 rounded bg-black/70 text-xs text-white
                     cursor-pointer select-none"
          onClick={() => {
            actions.resetZoom();
            // Note: showZoomIndicator is managed internally by zoomBy
          }}
        >
          {Math.round(state.scale * 100)}%
        </div>
      )}

      {/* WARNINGS */}
      {state.status.type === "warning" && (
        <PlayerWarnings warnings={state.status.warnings} />
      )}

      {/* ERROR */}
      {state.status.type === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="max-w-md rounded bg-red-900/90 p-4 text-xs text-red-200 shadow-lg">
            <div className="mb-2 font-semibold text-red-100">
              Playback error
            </div>

            <div>{state.status.error.message}</div>

            {state.status.error.details && (
              <div className="mt-2 text-[11px] opacity-70">
                {state.status.error.details}
              </div>
            )}

            <div className="mt-2 text-[10px] opacity-50">
              code: {state.status.error.code}
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {state.contextMenu && (
        <StageContextMenu
          x={state.contextMenu.x}
          y={state.contextMenu.y}
          scaleMode={state.scaleMode}
          onSelect={(mode) => {
            actions.setScaleMode(mode);

            if (mode === "original") {
              actions.resetZoom();
            }

            actions.setContextMenu(null);
          }}
          onClose={() => actions.setContextMenu(null)}
        />
      )}
    </div>
  );
}
