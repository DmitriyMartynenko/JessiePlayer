// Transparent WebM (VP9 + alpha) export using webm-muxer
// Preserves the animation's alpha channel — no background fill.

import { Muxer, ArrayBufferTarget } from "webm-muxer";
import { LoadedFile } from "../../players/PlayerContract";
import { ComposeTransform, ComposeCanvasSize, ComposeImage } from "../../store/uiStore";
import { loadAnimationData, createLottieCanvasRenderer } from "./lottieRenderer";

const BITRATE = 4_000_000;

export interface WebmExportOptions {
  onProgress: (label: string, progress: number) => void;
}

export async function exportTransparentWebm(
  file: LoadedFile,
  canvasSize: ComposeCanvasSize,
  transform: ComposeTransform,
  bgImage: ComposeImage | null,
  opts: WebmExportOptions,
): Promise<Uint8Array> {
  const { onProgress } = opts;

  onProgress("Reading animation…", 0.02);
  const meta = await loadAnimationData(file.extension, file.text, file.buffer, file.path);
  const { animationData, fps, totalFrames, width: animNatW, height: animNatH } = meta;

  const outW = bgImage ? bgImage.naturalWidth  : canvasSize.w;
  const outH = bgImage ? bgImage.naturalHeight : canvasSize.h;
  const animRenderW = Math.max(1, Math.round(animNatW * transform.scale));
  const animRenderH = Math.max(1, Math.round(animNatH * transform.scale));

  onProgress("Initialising renderer…", 0.05);
  // Transparent background — alpha preserved
  const { canvas: lottieCanvas, renderFrame, destroy } =
    await createLottieCanvasRenderer(animationData, animRenderW, animRenderH, "transparent");

  const outCanvas = document.createElement("canvas");
  outCanvas.width  = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d")!;

  const pasteX = transform.x - animRenderW / 2;
  const pasteY = transform.y - animRenderH / 2;

  // Load bg image if present
  let bgImgEl: HTMLImageElement | null = null;
  if (bgImage) {
    bgImgEl = new Image();
    await new Promise<void>((res, rej) => {
      bgImgEl!.onload  = () => res();
      bgImgEl!.onerror = () => rej();
      bgImgEl!.src = bgImage.dataUrl;
    });
  }

  // VP9 codec with alpha support
  const VP9_ALPHA = "vp09.00.10.08";

  const supported = typeof VideoEncoder !== "undefined" && (
    await VideoEncoder.isConfigSupported({ codec: VP9_ALPHA, width: outW, height: outH, bitrate: BITRATE, framerate: fps }).catch(() => ({ supported: false }))
  );
  if (!supported || !(supported as any).supported) {
    throw new Error("VP9 with alpha is not supported on this system.");
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "V_VP9", width: outW, height: outH, alpha: true },
    firstTimestampBehavior: "offset",
  } as any);

  let encodeError: Error | null = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => (muxer as any).addVideoChunk(chunk, meta),
    error:  (e) => { encodeError = e; },
  });

  encoder.configure({
    codec: VP9_ALPHA,
    width: outW, height: outH,
    bitrate: BITRATE, framerate: fps,
    alpha: "keep",
  } as any);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encodeError) throw encodeError;
      await renderFrame(i);

      outCtx.clearRect(0, 0, outW, outH); // WebM supports alpha → clear to transparent
      if (bgImgEl) {
        outCtx.drawImage(bgImgEl, 0, 0, outW, outH);
      }
      // No background fill for WebM — transparency is preserved in VP9 alpha channel
      outCtx.globalAlpha = transform.opacity ?? 1;
      outCtx.drawImage(lottieCanvas, pasteX, pasteY, animRenderW, animRenderH);
      outCtx.globalAlpha = 1;

      const timestampUs = Math.round((i / fps) * 1_000_000);
      const frame = new VideoFrame(outCanvas, { timestamp: timestampUs, alpha: "keep" } as any);
      encoder.encode(frame, { keyFrame: i % Math.round(fps * 2) === 0 });
      frame.close();

      onProgress(`Rendering frame ${i + 1} / ${totalFrames}…`, 0.1 + (i + 1) / totalFrames * 0.9);
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
    (muxer as any).finalize();
    return new Uint8Array(target.buffer);
  } finally {
    destroy();
  }
}
