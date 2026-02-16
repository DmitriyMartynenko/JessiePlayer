import { useMemo, useState, useRef, useEffect } from "react";

import {
  LoadedFile,
  PlayerStatus,
  PlayerProps,
} from "../players/PlayerContract";

import { JsonPlayer } from "../players/JsonPlayer/JsonPlayer";
import { LottiePlayer } from "../players/LottiePlayer/LottiePlayer";
import { WebmPlayer } from "../players/WebmPlayer/WebmPlayer";
import { FallbackPlayer } from "../players/FallbackPlayer/FallbackPlayer";

import { PlayerWarnings } from "../components/PlayerWarnings";
import StageContextMenu from "../components/StageContextMenu";

// ─────────────────────────────────────────────
// STAGE = ЄДИНИЙ ЦЕНТР КЕРУВАННЯ PLAYER STATE
// ─────────────────────────────────────────────

const VALID_EXTENSIONS = ["json", "lottie", "webm"];

type Props = {
  file: LoadedFile | null;
  onFileDrop?: (filePath: string) => void;
};

export function Stage({ file, onFileDrop }: Props) {
  // ─────────────────────────────────────────────
  // PLAYER STATUS
  // ─────────────────────────────────────────────

  const [status, setStatus] = useState<PlayerStatus>({
    type: "idle",
  });

  // ─────────────────────────────────────────────
  // SCALE SYSTEM
  // ─────────────────────────────────────────────

  const [scaleMode, setScaleMode] =
    useState<PlayerProps["scaleMode"]>("fit");

  const [scale, setScale] = useState<number>(1);

  const zoomIndicatorTimer = useRef<number | null>(null);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const zoomBy = (delta: number) => {
    setScale((prev) => {
      const next = prev + delta;
      return Math.min(5, Math.max(0.1, next));
    });

    setShowZoomIndicator(true);

    if (zoomIndicatorTimer.current) {
      clearTimeout(zoomIndicatorTimer.current);
    }

    zoomIndicatorTimer.current = window.setTimeout(() => {
      setShowZoomIndicator(false);
      zoomIndicatorTimer.current = null;
    }, 2000);
  };

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // ─────────────────────────────────────────────
  // PAN SYSTEM (drag-to-pan)
  // ─────────────────────────────────────────────

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // ─────────────────────────────────────────────
  // CONTEXT MENU
  // ─────────────────────────────────────────────

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!onFileDrop) return;

    const dropped = e.dataTransfer.files;
    if (!dropped?.length) return;

    const file = dropped[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !VALID_EXTENSIONS.includes(ext)) return;

    // Electron exposes file.path for dropped files from filesystem
    const filePath = (file as File & { path?: string }).path;
    if (filePath) {
      onFileDrop(filePath);
    }
  };

  // ─────────────────────────────────────────────
  // BACKGROUND FOR PLAYER
  // ─────────────────────────────────────────────

  const [background] =
    useState<PlayerProps["background"]>("transparent");

  // ─────────────────────────────────────────────
  // PLAYER ROUTER
  // ─────────────────────────────────────────────

  const PlayerComponent = useMemo(() => {
    if (!file) return null;

    switch (file.extension) {
      case "json":
        return JsonPlayer;
      case "lottie":
        return LottiePlayer;
      case "webm":
        return WebmPlayer;
      default:
        return FallbackPlayer;
    }
  }, [file]);

  // ─────────────────────────────────────────────
  // STATUS HANDLER
  // ─────────────────────────────────────────────

  const handleStatus = (next: PlayerStatus) => {
    setStatus(next);

    if (next.type === "error") {
      console.error("[Player error]", next.error);
    }

    if (next.type === "warning") {
      console.warn("[Player warnings]", next.warnings);
    }
  };

  // ─────────────────────────────────────────────
  // KEYBOARD SHORTCUTS
  // ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!file) return;
      if (!e.ctrlKey) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setScaleMode("original");
        zoomBy(0.1);
      }

      if (e.key === "-") {
        e.preventDefault();
        setScaleMode("original");
        zoomBy(-0.1);
      }

      if (e.key === "0") {
        e.preventDefault();
        setScaleMode("original");
        resetZoom();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [file]);

  // ─────────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────────

  if (!file || !PlayerComponent) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 text-center text-[1.20rem] text-neutral-500 select-none transition-colors ${
          isDragOver ? "bg-slate-700/30 ring-2 ring-inset ring-slate-500 rounded" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span>🎬 Drag your <strong>json</strong>, <strong>lottie</strong>, or <strong>webm</strong> file here</span>
        <span>📁 Or click the folder icon above to start</span>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div
      className={`relative flex-1 min-h-0 w-full overflow-hidden transition-colors ${
        isDragOver ? "ring-2 ring-inset ring-slate-500 bg-slate-700/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onWheel={(e) => {
        if (scaleMode !== "original") return;

        if (e.deltaY < 0) zoomBy(0.1);
        else zoomBy(-0.1);
      }}
      onMouseDown={(e) => {
        if (scaleMode !== "original") return;

        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!isDragging.current) return;

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;

        setOffset((prev) => ({
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
            scaleMode === "original"
              ? isDragging.current
                ? "grabbing"
                : "grab"
              : "default",
        }}
      >
        <PlayerComponent
          file={file}
          scaleMode={scaleMode}
          scale={scale}
          background={background}
          panOffset={scaleMode === "original" ? offset : undefined}
          onStatus={handleStatus}
        />
      </div>

      {/* ZOOM INDICATOR */}
      {scaleMode === "original" && showZoomIndicator && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2
                     px-3 py-1 rounded bg-black/70 text-xs text-white
                     cursor-pointer select-none"
          onClick={() => {
            resetZoom();
            setShowZoomIndicator(false);
          }}
        >
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* WARNINGS */}
      {status.type === "warning" && (
        <PlayerWarnings warnings={status.warnings} />
      )}

      {/* ERROR */}
      {status.type === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="max-w-md rounded bg-red-900/90 p-4 text-xs text-red-200 shadow-lg">
            <div className="mb-2 font-semibold text-red-100">
              Playback error
            </div>

            <div>{status.error.message}</div>

            {status.error.details && (
              <div className="mt-2 text-[11px] opacity-70">
                {status.error.details}
              </div>
            )}

            <div className="mt-2 text-[10px] opacity-50">
              code: {status.error.code}
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <StageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          scaleMode={scaleMode}
          onSelect={(mode) => {
            setScaleMode(mode);

            if (mode === "original") {
              resetZoom();
            }

            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
