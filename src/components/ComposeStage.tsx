import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { LoadedFile, AnimationControls, PlayerStatus } from "../players/PlayerContract";
import { useUiStore, ComposeImage, ComposeCanvasSize } from "../store/uiStore";
import { EmptyState } from "./ui/EmptyState";
import { JsonPlayer }     from "../players/JsonPlayer/JsonPlayer";
import { LottiePlayer }   from "../players/LottiePlayer/LottiePlayer";
import { WebmPlayer }     from "../players/WebmPlayer/WebmPlayer";
import { GifPlayer }      from "../players/GifPlayer/GifPlayer";
import { FallbackPlayer } from "../players/FallbackPlayer/FallbackPlayer";

interface Props {
  file: LoadedFile | null;
  animDimensions: { w: number; h: number } | null;
  onStatus: (status: PlayerStatus) => void;
  onControlsReady?: (controls: AnimationControls) => void;
}

function getPlayer(ext: string) {
  if (ext === "json")   return JsonPlayer;
  if (ext === "lottie") return LottiePlayer;
  if (ext === "webm")   return WebmPlayer;
  if (ext === "gif")    return GifPlayer;
  return FallbackPlayer;
}

// ── Letterbox math ────────────────────────────────────────
function computeImgBounds(
  containerW: number, containerH: number,
  imgW: number, imgH: number,
) {
  const imgRatio       = imgW / imgH;
  const containerRatio = containerW / containerH;
  let dw: number, dh: number, ox: number, oy: number;
  if (imgRatio > containerRatio) {
    dw = containerW; dh = containerW / imgRatio;
    ox = 0;          oy = (containerH - dh) / 2;
  } else {
    dh = containerH; dw = containerH * imgRatio;
    ox = (containerW - dw) / 2; oy = 0;
  }
  return { dw, dh, ox, oy, scale: dw / imgW }; // scale: display / natural
}

export function ComposeStage({ file, animDimensions, onStatus, onControlsReady }: Props) {
  const composeImage      = useUiStore((s) => s.composeImage);
  const composeTransform  = useUiStore((s) => s.composeTransform);
  const composeCanvasSize = useUiStore((s) => s.composeCanvasSize);
  const { setComposeTransform, initComposeForImage, setComposeImage } =
    useUiStore((s) => s.actions);

  // ── Container size (ResizeObserver) ───────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Auto-init transform when image + anim dims are both known ─
  const transformInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!composeImage || !animDimensions) return;
    const key = `${composeImage.naturalWidth}x${composeImage.naturalHeight}`;
    if (transformInitRef.current === key) return;
    transformInitRef.current = key;
    initComposeForImage(composeImage, animDimensions.w, animDimensions.h);
  }, [composeImage, animDimensions]);

  // ── Undo / Redo history ───────────────────────────────
  const historyPast   = useRef<typeof composeTransform[]>([]);
  const historyFuture = useRef<typeof composeTransform[]>([]);

  const pushHistory = useCallback(() => {
    historyPast.current = [...historyPast.current, { ...composeTransform }].slice(-30);
    historyFuture.current = [];
  }, [composeTransform]);

  const undo = useCallback(() => {
    const past = historyPast.current;
    if (!past.length) return;
    historyFuture.current = [{ ...composeTransform }, ...historyFuture.current].slice(0, 30);
    const prev = past[past.length - 1];
    historyPast.current = past.slice(0, -1);
    setComposeTransform(prev);
  }, [composeTransform, setComposeTransform]);

  const redo = useCallback(() => {
    const future = historyFuture.current;
    if (!future.length) return;
    historyPast.current = [...historyPast.current, { ...composeTransform }].slice(-30);
    const next = future[0];
    historyFuture.current = future.slice(1);
    setComposeTransform(next);
  }, [composeTransform, setComposeTransform]);

  // Snap animation to canvas center
  const snapToCenter = useCallback(() => {
    pushHistory();
    const cx = composeImage ? composeImage.naturalWidth  / 2 : composeCanvasSize.w / 2;
    const cy = composeImage ? composeImage.naturalHeight / 2 : composeCanvasSize.h / 2;
    setComposeTransform(prev => ({ ...prev, x: cx, y: cy }));
  }, [composeImage, composeCanvasSize, pushHistory, setComposeTransform]);

  // Keyboard: Ctrl+Z, Ctrl+Y, C (snap to center)
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault(); undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault(); redo();
      }
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
        snapToCenter();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo, snapToCenter]);

  // ── Drag state ────────────────────────────────────────
  const isDragging  = useRef(false);
  const lastMouse   = useRef({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState(false);

  // (stageOffset removed — composeTransform.x/y are now unified canvas-space coords)

  // ── Computed bounds ───────────────────────────────────
  const imgBounds = useMemo(() => {
    if (!composeImage) return null;
    return computeImgBounds(
      containerSize.w, containerSize.h,
      composeImage.naturalWidth, composeImage.naturalHeight,
    );
  }, [composeImage, containerSize]);

  const animW = animDimensions?.w ?? 512;
  const animH = animDimensions?.h ?? 512;

  // Bounds for CASE 3 (with bg image)
  const animBounds = useMemo(() => {
    if (!imgBounds) return null;
    const { scale, ox, oy } = imgBounds;
    const screenW = animW * composeTransform.scale * scale;
    const screenH = animH * composeTransform.scale * scale;
    const left    = ox + composeTransform.x * scale - screenW / 2;
    const top     = oy + composeTransform.y * scale - screenH / 2;
    return { left, top, width: screenW, height: screenH };
  }, [imgBounds, composeTransform, animW, animH]);

  // Display scale for CASE 2: letterbox composeCanvasSize into stage
  const noImgDisplay = useMemo(() => {
    const { w: cw, h: ch } = composeCanvasSize;
    const ds = Math.min(containerSize.w / cw, containerSize.h / ch);
    const ox = (containerSize.w - cw * ds) / 2;
    const oy = (containerSize.h - ch * ds) / 2;
    return { displayScale: ds, ox, oy, cw, ch };
  }, [composeCanvasSize, containerSize]);

  // Bounds for CASE 2: animation positioned in canvas-space coords (same as CASE 3)
  const noImgAnimBounds = useMemo(() => {
    const { displayScale: ds, ox, oy } = noImgDisplay;
    const renderW = animW * composeTransform.scale * ds;
    const renderH = animH * composeTransform.scale * ds;
    const left = ox + composeTransform.x * ds - renderW / 2;
    const top  = oy + composeTransform.y * ds - renderH / 2;
    return { left, top, width: renderW, height: renderH };
  }, [noImgDisplay, composeTransform, animW, animH]);

  // ── Load image from disk ──────────────────────────────
  const loadImage = useCallback(async (dataUrl: string) => {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload  = () => res();
      img.onerror = () => rej();
      img.src = dataUrl;
    });
    const ci: ComposeImage = {
      dataUrl,
      naturalWidth:  img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
    transformInitRef.current = null; // force re-init for new image
    if (animDimensions) {
      initComposeForImage(ci, animDimensions.w, animDimensions.h);
    } else {
      setComposeImage(ci);
    }
  }, [animDimensions, initComposeForImage, setComposeImage]);

  const handleOpenImage = useCallback(async () => {
    const result = await window.api.openImageFile?.();
    if (result?.dataUrl) loadImage(result.dataUrl);
  }, [loadImage]);

  // ── Drag-and-drop (image files onto compose stage) ────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node))
      setDragOver(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;
    const ext = droppedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (["json", "lottie", "webm", "gif"].includes(ext)) {
      const filePath = (droppedFile as any).path;
      if (filePath) window.api?.openFileByPath?.(filePath);
      return;
    }
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (url) loadImage(url);
      };
      reader.readAsDataURL(droppedFile);
    }
  }, [loadImage]);

  // ── Scroll → scale animation (both cases) ────────────
  const handleWheel = (e: React.WheelEvent) => {
    if (!file) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    setComposeTransform((prev) => ({
      ...prev,
      scale: Math.max(0.05, Math.min(20, prev.scale * factor)),
    }));
  };

  // ── Mouse drag on animation overlay ──────────────────
  const handleAnimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    pushHistory();
    isDragging.current = true;
    lastMouse.current  = { x: e.clientX, y: e.clientY };
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    // Convert screen delta → canvas-space pixels (same formula for both cases)
    const ds = composeImage ? (imgBounds?.scale ?? 1) : noImgDisplay.displayScale;
    setComposeTransform((prev) => ({
      ...prev,
      x: prev.x + dx / ds,
      y: prev.y + dy / ds,
    }));
  };

  const handleContainerMouseUp = () => { isDragging.current = false; };

  const PlayerComponent = file ? getPlayer(file.extension) : null;

  // ── Render ────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`relative flex-1 min-h-0 w-full overflow-hidden select-none
                  ${dragOver ? "ring-2 ring-inset ring-emerald-500" : ""}`}
      style={{ cursor: isDragging.current ? "grabbing" : "default" }}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── CASE 1: No animation file → standard empty state ── */}
      {(!file || !PlayerComponent) && (
        <div className="absolute inset-0">
          <EmptyState
            isDragOver={dragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        </div>
      )}

      {/* ── CASE 2: No background → canvas box + draggable animation ── */}
      {file && PlayerComponent && !composeImage && (() => {
        const { ox, oy, cw, ch, displayScale: ds } = noImgDisplay;
        return (
          <>
            {/* Canvas boundary — dims surrounding area, dashed border marks edge */}
            <div
              style={{
                position: "absolute",
                left: ox, top: oy,
                width: cw * ds, height: ch * ds,
                outline: "1px dashed rgba(255,255,255,0.35)",
                outlineOffset: 0,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                pointerEvents: "none",
              }}
            />
            {/* Animation overlay */}
            <div
              style={{
                position: "absolute",
                left:   noImgAnimBounds.left,
                top:    noImgAnimBounds.top,
                width:  noImgAnimBounds.width,
                height: noImgAnimBounds.height,
                cursor: isDragging.current ? "grabbing" : "grab",
                outline: "1px dashed rgba(255,255,255,0.2)",
                outlineOffset: -1,
                opacity: composeTransform.opacity ?? 1,
              }}
              onMouseDown={handleAnimMouseDown}
              onDoubleClick={snapToCenter}
              title="Drag · Scroll=scale · Double-click=center · C=center · Ctrl+Z=undo"
            >
              <PlayerComponent
                file={file}
                scaleMode="fit"
                scale={1}
                background="transparent"
                onStatus={onStatus}
                onControlsReady={onControlsReady}
              />
            </div>
          </>
        );
      })()}

      {/* ── CASE 3: Background image + animation overlay ─────── */}
      {composeImage && imgBounds && (
        <img
          src={composeImage.dataUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: imgBounds.ox, top: imgBounds.oy,
            width: imgBounds.dw, height: imgBounds.dh,
            userSelect: "none",
          }}
        />
      )}

      {composeImage && file && animBounds && PlayerComponent && (
        <div
          style={{
            position: "absolute",
            left: animBounds.left, top: animBounds.top,
            width: animBounds.width, height: animBounds.height,
            cursor: isDragging.current ? "grabbing" : "grab",
            outline: "1px dashed rgba(255,255,255,0.25)",
            outlineOffset: -1,
            opacity: composeTransform.opacity ?? 1,
          }}
          onMouseDown={handleAnimMouseDown}
          onDoubleClick={snapToCenter}
          title="Drag · Scroll=scale · Double-click=center · C=center · Ctrl+Z=undo"
        >
          <PlayerComponent
            file={file}
            scaleMode="fit"
            scale={1}
            background="transparent"
            onStatus={onStatus}
            onControlsReady={onControlsReady}
          />
        </div>
      )}

      {/* ── Status bar (when bg image is set) ──────────── */}
      {composeImage && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1
                     rounded-full text-[10px] font-mono pointer-events-none select-none"
          style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.4)" }}
        >
          anim {Math.round(composeTransform.scale * 100)}% ·{" "}
          bg {composeImage.naturalWidth}×{composeImage.naturalHeight}
        </div>
      )}
    </div>
  );
}
