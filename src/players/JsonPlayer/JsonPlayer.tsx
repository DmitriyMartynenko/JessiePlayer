import { useEffect, useRef } from "react";
import lottie from "lottie-web";

import {
  PlayerProps,
  PlayerStatus,
  AnimationControls,
  AnimationInfo,
} from "../PlayerContract";


// ─────────────────────────────────────────────
// JsonPlayer (оновлена фінальна версія)
// ─────────────────────────────────────────────
//
// • Працює ТІЛЬКИ з JSON (text)
// • Повністю правильний FIT через aspect-ratio
// • Коректна ініціалізація та cleanup
// • Контейнер не спотворює пропорції
// • Reference-імплементація PlayerContract
// ─────────────────────────────────────────────

export function JsonPlayer({
  file,
  scaleMode,
  scale,
  background,
  panOffset = { x: 0, y: 0 },
  onStatus,
  onControlsReady,
}: PlayerProps) {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<any>(null);

  // Зберігаємо розміри анімації після JSON.parse
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const animationDataRef = useRef<any>(null);
  const frameChangeCallbackRef = useRef<((frame: number) => void) | undefined>();
  const playStateChangeCallbackRef = useRef<((isPlaying: boolean) => void) | undefined>();



  // ─────────────────────────────────────────────
  // INIT / LOAD
  // ─────────────────────────────────────────────

  useEffect(() => {
    onStatus?.({ type: "loading" });

    if (!containerRef.current) {
      onStatus?.({
        type: "error",
        error: {
          code: "NO_CONTAINER",
          message: "Відсутній DOM контейнер для рендерингу",
        },
      });
      return;
    }

    if (!file.text) {
      onStatus?.({
        type: "error",
        error: {
          code: "NO_JSON_TEXT",
          message: "Файл не містить JSON-тексту",
        },
      });
      return;
    }

    let animationData: any;

    try {
      animationData = JSON.parse(file.text);
    } catch (err) {
      onStatus?.({
        type: "error",
        error: {
          code: "INVALID_JSON",
          message: "Помилка парсингу JSON",
          details: String(err),
        },
      });
      return;
    }

    if (!animationData || typeof animationData !== "object") {
      onStatus?.({
        type: "error",
        error: {
          code: "INVALID_ANIMATION_DATA",
          message: "Некоректна структура JSON анімації",
        },
      });
      return;
    }

    // ─────────────────────────────────────────────
    // Зберігаємо розміри анімації для FIT
    // ─────────────────────────────────────────────
    if (typeof animationData.w === "number" && typeof animationData.h === "number") {
      sizeRef.current = { w: animationData.w, h: animationData.h };
    } else {
      // Lottie JSON завжди має w/h, але перестрахуємось
      sizeRef.current = { w: 1000, h: 1000 };
    }

    // Store animation data for controls
    animationDataRef.current = animationData;

    // ─────────────────────────────────────────────
    // Lottie init
    // ─────────────────────────────────────────────

    animationRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData,
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
    });

    // ─────────────────────────────────────────────
    // Animation Controls Setup
    // ─────────────────────────────────────────────

    const getInfo = (): AnimationInfo | null => {
      const data = animationDataRef.current;
      if (!data) return null;

      const frameRate = typeof data.fr === "number" && data.fr > 0 ? data.fr : 30;
      const ip = typeof data.ip === "number" ? data.ip : 0;
      const op = typeof data.op === "number" ? data.op : 0;
      const totalFrames = Math.max(0, op - ip);
      const duration = frameRate > 0 ? totalFrames / frameRate : 0;

      return {
        totalFrames,
        frameRate,
        duration,
      };
    };

    const controls: AnimationControls = {
      play: () => {
        if (animationRef.current) {
          animationRef.current.play();
          playStateChangeCallbackRef.current?.(true);
        }
      },
      pause: () => {
        if (animationRef.current) {
          animationRef.current.pause();
          playStateChangeCallbackRef.current?.(false);
        }
      },
      seek: (frame: number) => {
        if (animationRef.current) {
          const info = getInfo();
          if (info) {
            const clampedFrame = Math.max(0, Math.min(frame, info.totalFrames - 1));
            animationRef.current.goToAndStop(clampedFrame, true);
            frameChangeCallbackRef.current?.(clampedFrame);
          }
        }
      },
      setSpeed: (speed: number) => {
        if (animationRef.current) {
          animationRef.current.setSpeed(speed);
        }
      },
      getCurrentFrame: () => {
        if (animationRef.current) {
          return Math.round(animationRef.current.currentFrame);
        }
        return 0;
      },
      getIsPlaying: () => {
        if (animationRef.current) {
          return animationRef.current.isPaused === false;
        }
        return false;
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

    // Set up frame update listener
    animationRef.current.addEventListener("enterFrame", () => {
      if (animationRef.current && frameChangeCallbackRef.current) {
        const frame = Math.round(animationRef.current.currentFrame);
        frameChangeCallbackRef.current(frame);
      }
    });

    // Виправлена помилка — використовуємо animationRef.current
    animationRef.current.addEventListener("DOMLoaded", () => {
      const svg = containerRef.current?.querySelector("svg");

      if (svg) {
        // Знімаємо width/height щоб SVG вписувався в контейнер
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.width = "100%";
        svg.style.height = "100%";
      }

      onStatus?.({ type: "ready" });
      onControlsReady?.(controls);
    });


    return () => {
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, [file]);



  // ─────────────────────────────────────────────
  // SCALE (тільки original, FIT не потребує)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!animationRef.current) return;

    animationRef.current.resize();
  }, [scaleMode, scale]);



  // ─────────────────────────────────────────────
  // RENDER (новий, правильний FIT)
  // ─────────────────────────────────────────────

  const w = sizeRef.current?.w ?? 1;
  const h = sizeRef.current?.h ?? 1;

  const isFit = scaleMode === "fit";
  const ox = panOffset?.x ?? 0;
  const oy = panOffset?.y ?? 0;

  // Single wrapper so containerRef (Lottie) is never remounted when switching Fit/Original.
  // In Original: viewport clips at Stage edge; content is scaled from center and panned inside.
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
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
