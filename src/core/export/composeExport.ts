import { ComposeImage, ComposeTransform, ComposeCanvasSize } from "../../store/uiStore";
import { LoadedFile } from "../../players/PlayerContract";
import { loadAnimationData, createLottieCanvasRenderer } from "./lottieRenderer";
import { encodeAnimation } from "./ffmpegEncoder";

const BITRATE = 6_000_000;

export interface ComposeExportOptions {
  onProgress: (label: string, progress: number) => void;
}

// Helper: parse hex color to css rgba string
function hexToRgba(hex: string, alpha = 1): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

export async function exportComposition(
  file: LoadedFile,
  bgImage: ComposeImage | null,       // null = no background image
  transform: ComposeTransform,
  canvasSize: ComposeCanvasSize,      // output dimensions
  backgroundColor: string,            // hex — used when no bg image
  backgroundOpacity: number,          // 0-1
  opts: ComposeExportOptions,
): Promise<Uint8Array> {
  const { onProgress } = opts;

  // ── 1. Optionally load background image element ────────
  onProgress("Loading assets…", 0);
  let bgImgEl: HTMLImageElement | null = null;
  if (bgImage) {
    bgImgEl = new Image();
    await new Promise<void>((resolve, reject) => {
      bgImgEl!.onload  = () => resolve();
      bgImgEl!.onerror = () => reject(new Error("Failed to load background image"));
      bgImgEl!.src = bgImage.dataUrl;
    });
  }

  // ── 2. Animation metadata ──────────────────────────────
  onProgress("Reading animation…", 0.02);
  const meta = await loadAnimationData(file.extension, file.text, file.buffer, file.path);
  const { animationData, fps, totalFrames, width: animNatW, height: animNatH } = meta;

  const animRenderW = Math.max(1, Math.round(animNatW * transform.scale));
  const animRenderH = Math.max(1, Math.round(animNatH * transform.scale));

  // ── 3. Offscreen lottie renderer (transparent bg) ──────
  onProgress("Initialising renderer…", 0.05);
  const { canvas: lottieCanvas, renderFrame, destroy } =
    await createLottieCanvasRenderer(animationData, animRenderW, animRenderH, "transparent");

  // ── 4. Output canvas at composition size ───────────────
  const outW = bgImage ? bgImage.naturalWidth  : canvasSize.w;
  const outH = bgImage ? bgImage.naturalHeight : canvasSize.h;

  const outCanvas = document.createElement("canvas");
  outCanvas.width  = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d")!;

  // Animation paste position: transform (x, y) = center in canvas pixels
  const pasteX = transform.x - animRenderW / 2;
  const pasteY = transform.y - animRenderH / 2;

  // Background fill color (solid — MP4 has no alpha)
  const bgFill = hexToRgba(backgroundColor, Math.max(backgroundOpacity, 0.01));

  // ── 5. Render + encode ─────────────────────────────────
  try {
    return await encodeAnimation(
      outCanvas,
      totalFrames,
      async (i) => {
        await renderFrame(i);

        if (bgImgEl) {
          // With bg image: draw image first
          outCtx.drawImage(bgImgEl, 0, 0, outW, outH);
        } else {
          // Without bg image: fill with background color
          outCtx.fillStyle = bgFill;
          outCtx.fillRect(0, 0, outW, outH);
        }

        // Animation on top (with opacity from compose transform)
        outCtx.globalAlpha = transform.opacity ?? 1;
        outCtx.drawImage(lottieCanvas, pasteX, pasteY, animRenderW, animRenderH);
        outCtx.globalAlpha = 1;

        onProgress(
          `Rendering frame ${i + 1} / ${totalFrames}…`,
          0.1 + (i + 1) / totalFrames * 0.9,
        );
      },
      { width: outW, height: outH, fps, bitrate: BITRATE },
    );
  } finally {
    destroy();
  }
}
