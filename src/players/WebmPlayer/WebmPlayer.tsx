import { useEffect, useRef, useState } from "react";
import { PlayerProps, AnimationControls, AnimationInfo } from "../PlayerContract";

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
  onControlsReady,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const frameRateRef = useRef<number>(30); // Default 30 fps for WebM
  const frameChangeCallbackRef = useRef<((frame: number) => void) | undefined>();
  const playStateChangeCallbackRef = useRef<((isPlaying: boolean) => void) | undefined>();

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

    // Set up timeupdate listener for frame updates
    const onTimeUpdate = () => {
      const video = videoRef.current;
      if (video && frameChangeCallbackRef.current) {
        const frame = Math.round(video.currentTime * frameRateRef.current);
        frameChangeCallbackRef.current(frame);
      }
    };

    // Set up play/pause state listeners
    const onPlay = () => {
      playStateChangeCallbackRef.current?.(true);
    };

    const onPause = () => {
      playStateChangeCallbackRef.current?.(false);
    };

    const onEnded = () => {
      playStateChangeCallbackRef.current?.(false);
    };

    const onLoadedMetadata = () => {
      const w = video.videoWidth || 1;
      const h = video.videoHeight || 1;
      setVideoSize({ w, h });

      // Create controls after metadata is loaded
      const getInfo = (): AnimationInfo | null => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
          return null;
        }

        const duration = video.duration;
        const fps = frameRateRef.current;
        const totalFrames = Math.round(duration * fps);

        return {
          totalFrames,
          frameRate: fps,
          duration,
        };
      };

      const controls: AnimationControls = {
        play: () => {
          const video = videoRef.current;
          if (video) {
            video.play().catch((err) => {
              console.error("[WebmPlayer] Play error:", err);
              onStatus?.({
                type: "error",
                error: {
                  code: "PLAY_FAILED",
                  message: "Failed to play video",
                  details: String(err),
                },
              });
            });
            playStateChangeCallbackRef.current?.(true);
          }
        },
        pause: () => {
          const video = videoRef.current;
          if (video) {
            video.pause();
            playStateChangeCallbackRef.current?.(false);
          }
        },
        seek: (frame: number) => {
          const video = videoRef.current;
          if (video) {
            const info = getInfo();
            if (info) {
              const clampedFrame = Math.max(0, Math.min(frame, info.totalFrames - 1));
              const timeInSeconds = clampedFrame / info.frameRate;
              video.currentTime = timeInSeconds;
              frameChangeCallbackRef.current?.(clampedFrame);
            }
          }
        },
        setSpeed: (speed: number) => {
          const video = videoRef.current;
          if (video) {
            video.playbackRate = speed;
          }
        },
        getCurrentFrame: () => {
          const video = videoRef.current;
          if (!video || !Number.isFinite(video.currentTime)) {
            return 0;
          }
          return Math.round(video.currentTime * frameRateRef.current);
        },
        getIsPlaying: () => {
          const video = videoRef.current;
          if (!video) return false;
          return !video.paused && !video.ended;
        },
        getInfo,
        get onFrameChange() {
          return frameChangeCallbackRef.current;
        },
        set onFrameChange(callback: ((frame: number) => void) | undefined) {
          frameChangeCallbackRef.current = callback;
        },
        get onPlayStateChange() {
          return playStateChangeCallbackRef.current;
        },
        set onPlayStateChange(callback: ((isPlaying: boolean) => void) | undefined) {
          playStateChangeCallbackRef.current = callback;
        },
      };

      onStatus?.({ type: "ready" });
      onControlsReady?.(controls);
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
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoSrc, onStatus, onControlsReady]);

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
          autoPlay={false}
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
