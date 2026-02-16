import { useEffect, useRef, useState } from "react";
import { PlayerProps } from "../PlayerContract";

// ─────────────────────────────────────────────
// WebmPlayer — .webm only
// ─────────────────────────────────────────────
//
// • Works ONLY with .webm files (validates file.extension and file.buffer)
// • Uses blob URL from buffer (Electron sends buffer; path fails in renderer)
// • Full PlayerContract support: scaleMode, scale, background, panOffset, onStatus
// • fit: video fits inside Stage, aspect ratio preserved (no distortion)
// • original: natural video size, scale + pan applied
// ─────────────────────────────────────────────

export function WebmPlayer({
  file,
  scaleMode,
  scale,
  background,
  panOffset = { x: 0, y: 0 },
  onStatus,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // INIT / LOAD (blob URL from buffer, cleanup on unmount or file change)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (file.extension !== "webm") {
      onStatus?.({
        type: "error",
        error: {
          code: "NOT_WEBM",
          message: "WebmPlayer supports only .webm files",
        },
      });
      return;
    }

    if (!file.buffer) {
      onStatus?.({
        type: "error",
        error: {
          code: "NO_VIDEO_DATA",
          message: "No video data (buffer) received",
        },
      });
      return;
    }

    onStatus?.({ type: "loading" });
    setVideoSize(null);

    const blob = new Blob([file.buffer], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    setVideoSrc(url);

    return () => {
      URL.revokeObjectURL(url);
      setVideoSrc(null);
    };
  }, [file]);

  // ─────────────────────────────────────────────
  // Video element ref: attach listeners when we have src
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!videoSrc) return;

    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      const w = video.videoWidth || 1;
      const h = video.videoHeight || 1;
      setVideoSize({ w, h });
      onStatus?.({ type: "ready" });
    };

    const onError = () => {
      onStatus?.({
        type: "error",
        error: {
          code: "VIDEO_LOAD_FAILED",
          message: "Failed to load WebM video",
        },
      });
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
    };
  }, [videoSrc]);

  // ─────────────────────────────────────────────
  // RENDER (fit = aspect-ratio contain, original = natural size + scale + pan)
  // ─────────────────────────────────────────────

  const w = videoSize?.w ?? 1;
  const h = videoSize?.h ?? 1;
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

  const backgroundStyle =
    background === "black"
      ? "#000"
      : background === "checker"
        ? "repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 50% / 20px 20px"
        : "transparent";

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
        background: backgroundStyle,
      }}
    >
      <div style={wrapperStyle}>
        <video
          ref={videoRef}
          src={videoSrc ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}
