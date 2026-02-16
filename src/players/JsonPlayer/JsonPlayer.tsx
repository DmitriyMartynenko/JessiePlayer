import { useEffect, useRef } from "react";
import lottie from "lottie-web";

import {
  PlayerProps,
  PlayerStatus,
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
}: PlayerProps) {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<any>(null);

  // Зберігаємо розміри анімації після JSON.parse
  const sizeRef = useRef<{ w: number; h: number } | null>(null);



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
