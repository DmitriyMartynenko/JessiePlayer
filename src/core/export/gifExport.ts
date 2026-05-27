// GIF export using gifenc (pure JS, no external binary)
// Quality: Floyd-Steinberg dithering for significantly better colour reproduction.

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { LoadedFile } from "../../players/PlayerContract";
import { ComposeTransform, ComposeCanvasSize, ComposeImage } from "../../store/uiStore";
import { loadAnimationData, createLottieCanvasRenderer } from "./lottieRenderer";

export interface GifExportOptions {
  fps?: number;
  onProgress: (label: string, progress: number) => void;
}

// ── Floyd-Steinberg dithering ─────────────────────────────
// Distributes quantisation error to right/bottom neighbours,
// giving the perception of far more than 256 colours.
function ditherFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Uint8Array[],
  /** Indices that must never be picked (e.g. reserved transparent slot) */
  skipIndices: Set<number> = new Set(),
): Uint8Array {
  const out  = new Uint8Array(width * height);
  const eR   = new Float32Array(width * height);
  const eG   = new Float32Array(width * height);
  const eB   = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const ri = pi * 4;

      const r = Math.max(0, Math.min(255, rgba[ri]     + eR[pi]));
      const g = Math.max(0, Math.min(255, rgba[ri + 1] + eG[pi]));
      const b = Math.max(0, Math.min(255, rgba[ri + 2] + eB[pi]));

      // Nearest palette colour (skip reserved indices)
      let best = 0, bestD = Infinity;
      for (let ci = 0; ci < palette.length; ci++) {
        if (skipIndices.has(ci)) continue;
        const [pr, pg, pb] = palette[ci];
        const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (d < bestD) { bestD = d; best = ci; }
      }
      out[pi] = best;

      // Error
      const er = r - palette[best][0];
      const eg = g - palette[best][1];
      const eb = b - palette[best][2];

      // Distribute to neighbours (Floyd-Steinberg weights)
      const push = (nx: number, ny: number, f: number) => {
        if (nx < 0 || nx >= width || ny >= height) return;
        const ni = ny * width + nx;
        eR[ni] += er * f; eG[ni] += eg * f; eB[ni] += eb * f;
      };
      push(x + 1, y,     7 / 16);
      push(x - 1, y + 1, 3 / 16);
      push(x,     y + 1, 5 / 16);
      push(x + 1, y + 1, 1 / 16);
    }
  }
  return out;
}

// ── Main export ───────────────────────────────────────────
export async function exportGif(
  file: LoadedFile,
  canvasSize: ComposeCanvasSize,
  transform: ComposeTransform,
  bgImage: ComposeImage | null,
  backgroundColor: string,
  backgroundOpacity: number,
  opts: GifExportOptions,
): Promise<Uint8Array> {
  const { onProgress } = opts;

  onProgress("Reading animation…", 0.02);
  const meta = await loadAnimationData(file.extension, file.text, file.buffer, file.path);
  const { animationData, fps: originalFps, totalFrames: originalFrames, width: animNatW, height: animNatH } = meta;

  // Cap at 24 fps to keep file size manageable
  const gifFps    = Math.min(opts.fps ?? originalFps, 24);
  const frameStep = Math.max(1, Math.round(originalFps / gifFps));
  const delay     = Math.round(1000 / gifFps);

  const outW = bgImage ? bgImage.naturalWidth  : canvasSize.w;
  const outH = bgImage ? bgImage.naturalHeight : canvasSize.h;
  const animRenderW = Math.max(1, Math.round(animNatW * transform.scale));
  const animRenderH = Math.max(1, Math.round(animNatH * transform.scale));

  onProgress("Initialising renderer…", 0.05);

  const bgFill = hexToRgba(backgroundColor, Math.max(backgroundOpacity, 0.01));
  const { canvas: lottieCanvas, renderFrame, destroy } =
    await createLottieCanvasRenderer(animationData, animRenderW, animRenderH, "transparent");

  const outCanvas = document.createElement("canvas");
  outCanvas.width  = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d")!;

  let bgImgEl: HTMLImageElement | null = null;
  if (bgImage) {
    bgImgEl = new Image();
    await new Promise<void>((res, rej) => {
      bgImgEl!.onload = () => res(); bgImgEl!.onerror = () => rej(); bgImgEl!.src = bgImage.dataUrl;
    });
  }

  const gif    = GIFEncoder();
  const frames = Array.from({ length: originalFrames }, (_, i) => i).filter(i => i % frameStep === 0);
  const needsTransparency = !bgImgEl && backgroundOpacity === 0;

  try {
    for (let fi = 0; fi < frames.length; fi++) {
      const i = frames[fi];
      await renderFrame(i);

      // ── Composite frame ─────────────────────────────
      outCtx.clearRect(0, 0, outW, outH);
      if (bgImgEl) {
        outCtx.drawImage(bgImgEl, 0, 0, outW, outH);
      } else if (backgroundOpacity > 0) {
        outCtx.fillStyle = bgFill;
        outCtx.fillRect(0, 0, outW, outH);
      }
      outCtx.globalAlpha = transform.opacity ?? 1;
      outCtx.drawImage(lottieCanvas, transform.x - animRenderW / 2, transform.y - animRenderH / 2, animRenderW, animRenderH);
      outCtx.globalAlpha = 1;

      const { data } = outCtx.getImageData(0, 0, outW, outH);

      if (needsTransparency) {
        // ── Transparent frame ─────────────────────────
        // Separate transparent pixels, quantise opaque ones,
        // then dither with Floyd-Steinberg (skipping transparent slot).

        const opaqueData   = new Uint8ClampedArray(data.length);
        const isTransparent = new Uint8Array(outW * outH);

        for (let p = 0; p < outW * outH; p++) {
          isTransparent[p]      = data[p * 4 + 3] < 128 ? 1 : 0;
          opaqueData[p * 4]     = data[p * 4];
          opaqueData[p * 4 + 1] = data[p * 4 + 1];
          opaqueData[p * 4 + 2] = data[p * 4 + 2];
          opaqueData[p * 4 + 3] = 255;
        }

        // Reserve one slot for the transparent colour
        const palette        = quantize(opaqueData, 255);
        const transparentIdx = palette.length;
        palette.push(new Uint8Array([0, 0, 0]));

        const skip  = new Set([transparentIdx]);
        const index = ditherFrame(opaqueData, outW, outH, palette, skip);

        // Restore transparent pixels
        for (let p = 0; p < outW * outH; p++) {
          if (isTransparent[p]) index[p] = transparentIdx;
        }

        gif.writeFrame(index, outW, outH, {
          palette, delay, repeat: 0,
          transparent: true,
          transparentIndex: transparentIdx,
        });
      } else {
        // ── Opaque frame with dithering ───────────────
        const palette = quantize(data, 256);
        const index   = ditherFrame(data, outW, outH, palette);
        gif.writeFrame(index, outW, outH, { palette, delay, repeat: 0 });
      }

      onProgress(`Encoding frame ${fi + 1} / ${frames.length}…`, 0.1 + (fi + 1) / frames.length * 0.9);
      if (fi % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }

    gif.finish();
    return gif.bytes();
  } finally {
    destroy();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2),16)||0, g = parseInt(h.slice(2,4),16)||0, b = parseInt(h.slice(4,6),16)||0;
  return `rgba(${r},${g},${b},${alpha})`;
}
