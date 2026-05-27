import { useEffect, useState } from "react";
import { PlayerProps } from "../PlayerContract";

// ─────────────────────────────────────────────
// GifPlayer — .gif files
// ─────────────────────────────────────────────
// GIF animation is handled natively by the browser via <img>.
// No frame-by-frame control is available — playback controls
// in the bottom bar will remain disabled for GIF files.

export function GifPlayer({
  file,
  scaleMode,
  scale,
  background,
  panOffset = { x: 0, y: 0 },
  onStatus,
}: PlayerProps) {
  const [src, setSrc]   = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!file.buffer) {
      onStatus?.({
        type: "error",
        error: { code: "NO_BUFFER", message: "No GIF data received" },
      });
      return;
    }

    onStatus?.({ type: "loading" });

    const blob = new Blob([file.buffer], { type: "image/gif" });
    const url  = URL.createObjectURL(blob);
    setSrc(url);

    return () => {
      URL.revokeObjectURL(url);
      setSrc(null);
    };
  }, [file]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setSize({ w: img.naturalWidth, h: img.naturalHeight });
    onStatus?.({ type: "ready" });
  };

  const handleError = () => {
    onStatus?.({
      type: "error",
      error: { code: "GIF_LOAD_FAILED", message: "Failed to load GIF image" },
    });
  };

  const w  = size?.w ?? 1;
  const h  = size?.h ?? 1;
  const isFit = scaleMode === "fit";
  const ox = panOffset?.x ?? 0;
  const oy = panOffset?.y ?? 0;

  const wrapperStyle = isFit
    ? {
        flexShrink: 0 as const,
        aspectRatio: `${w} / ${h}`,
        width: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
      }
    : {
        flexShrink: 0 as const,
        width: w,
        height: h,
        transform: `translate(${ox}px, ${oy}px) scale(${scale})`,
        transformOrigin: "center center",
      };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: background ?? "transparent",
      }}
    >
      <div style={wrapperStyle}>
        <img
          src={src ?? undefined}
          alt={file.name}
          onLoad={handleLoad}
          onError={handleError}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </div>
    </div>
  );
}
