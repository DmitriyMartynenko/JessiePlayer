// StageLogic.ts
// ==================================================
// Stage business logic extracted for maintainability
// ==================================================

import { useState, useRef, useEffect, useMemo } from "react";
import {
  LoadedFile,
  PlayerStatus,
  PlayerProps,
} from "../players/PlayerContract";
import {
  analyzeAnimation,
  AnimationDiagnostics,
} from "../core/analyzers/animationAnalyzer";
import { JsonPlayer } from "../players/JsonPlayer/JsonPlayer";
import { LottiePlayer } from "../players/LottiePlayer/LottiePlayer";
import { WebmPlayer } from "../players/WebmPlayer/WebmPlayer";
import { FallbackPlayer } from "../players/FallbackPlayer/FallbackPlayer";

const VALID_EXTENSIONS = ["json", "lottie", "webm"];

export interface StageLogicState {
  status: PlayerStatus;
  diagnostics: AnimationDiagnostics | null;
  scaleMode: PlayerProps["scaleMode"];
  scale: number;
  showZoomIndicator: boolean;
  offset: { x: number; y: number };
  contextMenu: { x: number; y: number } | null;
  isDragOver: boolean;
  background: PlayerProps["background"];
  PlayerComponent: typeof JsonPlayer | typeof LottiePlayer | typeof WebmPlayer | typeof FallbackPlayer | null;
}

export interface StageLogicActions {
  setStatus: (status: PlayerStatus) => void;
  setScaleMode: (mode: PlayerProps["scaleMode"]) => void;
  zoomBy: (delta: number) => void;
  resetZoom: () => void;
  setOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  setContextMenu: (menu: { x: number; y: number } | null) => void;
  setIsDragOver: (over: boolean) => void;
  handleStatus: (status: PlayerStatus) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, onFileDrop?: (filePath: string) => void) => void;
}

export function useStageLogic(
  file: LoadedFile | null,
  onFileDrop?: (filePath: string) => void
): { state: StageLogicState; actions: StageLogicActions } {
  // ─────────────────────────────────────────────
  // PLAYER STATUS
  // ─────────────────────────────────────────────

  const [status, setStatus] = useState<PlayerStatus>({
    type: "idle",
  });

  // ─────────────────────────────────────────────
  // ANIMATION DIAGNOSTICS (Stage-level state)
  // ─────────────────────────────────────────────

  const [diagnostics, setDiagnostics] =
    useState<AnimationDiagnostics | null>(null);

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

  const handleDrop = (e: React.DragEvent, onFileDrop?: (filePath: string) => void) => {
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
  // ANIMATION ANALYSIS (Stage orchestrates, Player stays pure render)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!file) {
      setDiagnostics(null);
      return;
    }

    // Analyze all supported formats: json, lottie, webm
    analyzeAnimation(file).then((diag) => {
      setDiagnostics(diag);
    }).catch((err) => {
      console.error("[Stage] Analysis error:", err);
      setDiagnostics(null);
    });
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

  // Expose state and actions
  return {
    state: {
      status,
      diagnostics,
      scaleMode,
      scale,
      showZoomIndicator,
      offset,
      contextMenu,
      isDragOver,
      background,
      PlayerComponent,
    },
    actions: {
      setStatus,
      setScaleMode,
      zoomBy,
      resetZoom,
      setOffset,
      setContextMenu,
      setIsDragOver,
      handleStatus,
      handleDragOver,
      handleDragLeave,
      handleDrop: (e) => handleDrop(e, onFileDrop),
    },
  };
}
