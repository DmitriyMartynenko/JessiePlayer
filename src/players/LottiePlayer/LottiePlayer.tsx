import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import JSZip from "jszip";

import {
  PlayerProps,
  PlayerStatus,
  PlayerWarning,
} from "../PlayerContract";

// ─────────────────────────────────────────────
// LottiePlayer — .lottie (zip container)
// ─────────────────────────────────────────────
//
// • Розпаковує zip, шукає animation.json, images
// • SVG renderer, preserveAspectRatio "xMidYMid meet"
// • FIT через aspect-ratio, original через scale + panOffset
// • Повна відповідність PlayerContract, поведінка як JsonPlayer для Stage
// • CLEANUP: destroy animation + revoke object URLs
// ─────────────────────────────────────────────

export function LottiePlayer({
  file,
  scaleMode,
  scale,
  background,
  panOffset = { x: 0, y: 0 },
  onStatus,
}: PlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<ReturnType<typeof lottie.loadAnimation> | null>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const imageUrlsRef = useRef<string[]>([]);

  // ─────────────────────────────────────────────
  // INIT / LOAD
  // ─────────────────────────────────────────────

  useEffect(() => {
    let destroyed = false;
    imageUrlsRef.current = [];

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

    if (!file.buffer) {
      onStatus?.({
        type: "error",
        error: {
          code: "NO_BUFFER",
          message: ".lottie файл не містить binary buffer",
        },
      });
      return;
    }

    const buffer = file.buffer;
    (async () => {
      const warnings: PlayerWarning[] = [];

      try {
        const zip = await JSZip.loadAsync(buffer);
        if (destroyed) return;

        const allPaths = Object.keys(zip.files);
        const pathExists = (path: string): boolean =>
          zip.file(path.replace(/\\/g, "/")) != null;

        // 1) Try manifest.json (official .lottie / dotlottie format)
        let animationPath: string | null = null;
        const manifestPath = allPaths.find(
          (p) => p === "manifest.json" || p.endsWith("/manifest.json")
        );
        if (manifestPath) {
          const manifestEntry = zip.file(manifestPath);
          if (manifestEntry) {
            try {
              const manifestText = await manifestEntry.async("text");
              const manifest = JSON.parse(manifestText) as Record<string, unknown>;
              const anims = manifest.animations as Array<{ path?: string; id?: string }> | undefined;
              if (Array.isArray(anims) && anims.length > 0) {
                const first = anims[0];
                const rawId = first?.id != null ? String(first.id).trim() : "";
                if (typeof first.path === "string" && first.path) {
                  animationPath = first.path.replace(/^\//, "").replace(/\\/g, "/");
                } else if (rawId) {
                  // dotlottie: animation may be at {id}/animation.json, animations/{id}.json, etc.
                  const withForwardSlash = (s: string) => s.replace(/\\/g, "/");
                  const candidates = [
                    `${rawId}/animation.json`,
                    `${rawId}/data.json`,
                    `animations/${rawId}.json`,
                    `animations/${rawId}/animation.json`,
                    `animations/${rawId}/data.json`,
                    withForwardSlash(`${rawId}\\animation.json`),
                    withForwardSlash(`${rawId}\\data.json`),
                    withForwardSlash(`animations\\${rawId}.json`),
                  ];
                  for (const candidate of candidates) {
                    if (pathExists(candidate)) {
                      animationPath = candidate;
                      break;
                    }
                  }
                  if (!animationPath) {
                    const nested = allPaths.find(
                      (p) => {
                        const n = p.replace(/\\/g, "/");
                        return (
                          n === `${rawId}/animation.json` ||
                          n === `${rawId}/data.json` ||
                          n === `animations/${rawId}.json` ||
                          (n.includes(rawId) &&
                            (n.endsWith("/animation.json") ||
                              n.endsWith("/data.json") ||
                              n.endsWith(`/${rawId}.json`)))
                        );
                      }
                    );
                    if (nested) animationPath = nested.replace(/\\/g, "/");
                  }
                }
              }
              const main = manifest.main as string | undefined;
              if (!animationPath && typeof main === "string" && main) {
                animationPath = main.replace(/^\//, "").replace(/\\/g, "/");
              }
            } catch {
              /* ignore invalid manifest */
            }
          }
        }

        // 2) Resolve animation.json / data.json (root or nested) without manifest
        if (!animationPath) {
          const normalizedPaths = allPaths.map((p) => p.replace(/\\/g, "/"));
          const preferredIdx = normalizedPaths.findIndex(
            (p) =>
              p === "animation.json" ||
              p.endsWith("/animation.json") ||
              p === "data.json" ||
              p.endsWith("/data.json")
          );
          if (preferredIdx >= 0) animationPath = allPaths[preferredIdx].replace(/\\/g, "/");
        }

        const animationEntry = animationPath ? zip.file(animationPath) : null;

        if (!animationEntry) {
          onStatus?.({
            type: "error",
            error: {
              code: "NO_ANIMATION_JSON",
              message: "У .lottie відсутній animation.json або data.json",
            },
          });
          return;
        }

        const animationText = await animationEntry.async("text");
        if (destroyed) return;

        let animationData: Record<string, unknown>;
        try {
          animationData = JSON.parse(animationText) as Record<string, unknown>;
        } catch (err) {
          onStatus?.({
            type: "error",
            error: {
              code: "INVALID_ANIMATION_JSON",
              message: "Помилка парсингу animation JSON",
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
              message: "Некоректна структура animation JSON",
            },
          });
          return;
        }

        const w =
          typeof animationData.w === "number" && animationData.w > 0
            ? animationData.w
            : 1000;
        const h =
          typeof animationData.h === "number" && animationData.h > 0
            ? animationData.h
            : 1000;
        sizeRef.current = { w, h };

        // Animation folder (e.g. "animations/0/" when animation is "animations/0/animation.json")
        const animationBaseDir = animationPath
          ? animationPath.replace(/\\/g, "/").replace(/\/[^/]+$/, "/")
          : "";

        const imagePaths = allPaths.filter(
          (name) => !name.endsWith("/") && /\.(png|jpg|jpeg|webp)$/i.test(name)
        );

        const mimeFromExt = (filename: string): string => {
          const ext = filename.replace(/^.*\./, "").toLowerCase();
          if (ext === "png") return "image/png";
          if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
          if (ext === "webp") return "image/webp";
          return "image/png";
        };

        const imageDataUrls: Record<string, string> = {};
        for (const path of imagePaths) {
          const entry = zip.file(path);
          if (!entry) continue;
          const base64 = await entry.async("base64");
          const baseName = path.replace(/^.*\//, "");
          const mime = mimeFromExt(baseName);
          const dataUrl = `data:${mime};base64,${base64}`;
          imageDataUrls[path] = dataUrl;
          imageDataUrls[baseName] = dataUrl;
          imageDataUrls[`images/${baseName}`] = dataUrl;
          if (animationBaseDir && path.startsWith(animationBaseDir)) {
            const relFromAnim = path.slice(animationBaseDir.length);
            imageDataUrls[relFromAnim] = dataUrl;
          }
        }
        if (destroyed) return;

        const assets = animationData.assets as Array<{
          layers?: unknown[];
          u?: string;
          p?: string;
          e?: number;
          id?: string;
        }> | undefined;
        if (Array.isArray(assets)) {
          for (const asset of assets) {
            if (asset.layers != null || !asset.p) continue;
            const logicalPath = ((asset.u ?? "") + asset.p).replace(/^\//, "");
            const dataUrl =
              imageDataUrls[logicalPath] ??
              imageDataUrls[animationBaseDir + logicalPath] ??
              imageDataUrls[asset.p] ??
              imageDataUrls[`images/${asset.p}`] ??
              imageDataUrls[asset.p?.replace?.(/^.*\//, "") ?? ""];
            if (dataUrl) {
              asset.e = 1;
              asset.p = dataUrl;
            } else {
              warnings.push({
                code: "MISSING_IMAGE",
                message: `Зображення не знайдено: ${logicalPath || asset.p}`,
              });
            }
          }
        }

        animationRef.current = lottie.loadAnimation({
          container: containerRef.current!,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
          },
        });

        const reportReady = (): void => {
          if (destroyed) return;
          const status: PlayerStatus =
            warnings.length > 0
              ? { type: "warning", warnings }
              : { type: "ready" };
          onStatus?.(status);
        };

        animationRef.current.addEventListener("DOMLoaded", () => {
          const svg = containerRef.current?.querySelector("svg");
          if (svg) {
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            svg.style.width = "100%";
            svg.style.height = "100%";
          }
          reportReady();
        });

        animationRef.current.addEventListener("error", () => {
          if (destroyed) return;
          onStatus?.({
            type: "error",
            error: {
              code: "LOTTIE_INIT_ERROR",
              message: "Помилка ініціалізації Lottie",
            },
          });
        });
      } catch (err) {
        if (destroyed) return;
        const message =
          err instanceof Error && err.message?.toLowerCase().includes("zip")
            ? "Неможливо розпакувати .lottie (некоректний zip)"
            : "Помилка завантаження .lottie";
        onStatus?.({
          type: "error",
          error: {
            code: "LOTTIE_LOAD_FAILED",
            message,
            details: String(err),
          },
        });
      }
    })();

    return () => {
      destroyed = true;
      imageUrlsRef.current.forEach(URL.revokeObjectURL);
      imageUrlsRef.current = [];
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, [file]);

  // ─────────────────────────────────────────────
  // SCALE (original mode)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!animationRef.current) return;
    animationRef.current.resize();
  }, [scaleMode, scale]);

  // ─────────────────────────────────────────────
  // RENDER (FIT = aspect-ratio, original = scale + pan)
  // ─────────────────────────────────────────────

  const w = sizeRef.current?.w ?? 1;
  const h = sizeRef.current?.h ?? 1;
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
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
