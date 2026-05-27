// WebCodecs + mp4-muxer encoder
// Primary: H.264 (GPU-accelerated when available)
// Fallback: VP9  (software, always available in Chromium/Electron)
// Both produce a valid .mp4 file via mp4-muxer.

import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export const QUALITY_PRESETS = {
  high:   6_000_000,
  medium: 3_000_000,
  low:    1_500_000,
} as const;

export type QualityPreset = keyof typeof QUALITY_PRESETS;

// Codec candidates tried in order
const CODEC_CANDIDATES = [
  { videoCodec: "avc1.42001F",   muxerCodec: "avc" as const, label: "H.264 Baseline" },
  { videoCodec: "avc1.4D0028",   muxerCodec: "avc" as const, label: "H.264 Main"     },
  { videoCodec: "vp09.00.10.08", muxerCodec: "vp9" as const, label: "VP9"            },
  { videoCodec: "av01.0.04M.08", muxerCodec: "av1" as const, label: "AV1"            },
];

type MuxerCodec = "avc" | "hevc" | "vp9" | "av1";

type CodecChoice = {
  videoCodec: string;
  muxerCodec: MuxerCodec;
  label: string;
};

async function selectCodec(w: number, h: number, fps: number): Promise<CodecChoice> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("VideoEncoder API is not available in this context.");
  }
  for (const candidate of CODEC_CANDIDATES) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec:     candidate.videoCodec,
        width:     w,
        height:    h,
        bitrate:   4_000_000,
        framerate: fps,
      });
      if (supported) return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    "No supported video codec found.\n" +
    "Tried H.264 and VP9 — neither is available on this system."
  );
}

export interface EncodeOptions {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  onProgress?: (progress: number) => void;
}

export async function encodeAnimation(
  canvas: HTMLCanvasElement,
  totalFrames: number,
  renderFrame: (index: number) => Promise<void>,
  opts: EncodeOptions,
): Promise<Uint8Array> {
  const { width, height, fps, bitrate } = opts;

  // Even dimensions required by most codecs
  const w = Math.round(width  / 2) * 2;
  const h = Math.round(height / 2) * 2;

  const codec = await selectCodec(w, h, fps);

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: codec.muxerCodec, width: w, height: h },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encodeError: Error | null = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error:  (e) => { encodeError = e; },
  });

  encoder.configure({
    codec:       codec.videoCodec,
    width:       w,
    height:      h,
    bitrate,
    framerate:   fps,
    latencyMode: "quality",
  });

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError;

    await renderFrame(i);

    const timestampUs = Math.round((i / fps) * 1_000_000);
    const videoFrame  = new VideoFrame(canvas, { timestamp: timestampUs });
    encoder.encode(videoFrame, { keyFrame: i % Math.round(fps * 2) === 0 });
    videoFrame.close();

    opts.onProgress?.((i + 1) / totalFrames);

    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  if (encodeError) throw encodeError;

  muxer.finalize();
  return new Uint8Array(target.buffer);
}

export async function reencodeWebm(
  buffer: ArrayBuffer,
  opts: Omit<EncodeOptions, "width" | "height" | "fps">,
): Promise<Uint8Array> {
  const video = document.createElement("video");
  video.muted   = true;
  video.preload = "auto";

  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: "video/webm" }));
  video.src = blobUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror          = () => reject(new Error("Failed to load WebM file"));
    setTimeout(() => reject(new Error("Video metadata load timeout")), 15_000);
  });

  const { videoWidth: width, videoHeight: height, duration } = video;
  const fps         = 30;
  const totalFrames = Math.round(duration * fps);
  const w = Math.round(width  / 2) * 2;
  const h = Math.round(height / 2) * 2;

  const codec = await selectCodec(w, h, fps);

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: codec.muxerCodec, width: w, height: h },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encodeError: Error | null = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error:  (e) => { encodeError = e; },
  });

  encoder.configure({
    codec:       codec.videoCodec,
    width:       w,
    height:      h,
    bitrate:     opts.bitrate,
    framerate:   fps,
    latencyMode: "quality",
  });

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError;

    const timeS = i / fps;
    video.currentTime = timeS;
    await new Promise<void>((r) => { video.onseeked = () => r(); });

    const timestampUs = Math.round(timeS * 1_000_000);
    const frame = new VideoFrame(video, { timestamp: timestampUs });
    encoder.encode(frame, { keyFrame: i % Math.round(fps * 2) === 0 });
    frame.close();

    opts.onProgress?.((i + 1) / totalFrames);

    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  if (encodeError) throw encodeError;

  muxer.finalize();
  URL.revokeObjectURL(blobUrl);
  video.remove();

  return new Uint8Array(target.buffer);
}
