import { LoadedFile } from "../../players/PlayerContract";
import { analyzeLottieJson } from "./jsonAnalyzer";
import JSZip from "jszip";

// ─────────────────────────────────────────────
// UNIFIED DIAGNOSTICS INTERFACE
// ─────────────────────────────────────────────

export type AnimationFormat = "lottie" | "webm" | "gif";

export interface AnimationDiagnostics {
  format: AnimationFormat;

  // Common fields
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  warnings: string[];

  // Lottie-specific fields
  frames?: number;
  layers?: number;
  assets?: number;
  bodymovinVersion?: string;
  imageCount?: number;
  embeddedImageCount?: number;
  externalImageCount?: number;
  hasExpressions?: boolean;

  // WebM-specific fields
  bitrate?: number; // bits per second
  codec?: string;
  fileSize?: number; // bytes
  audioTrackCount?: number;
}

// ─────────────────────────────────────────────
// LOTTIE ANALYZER (.json and .lottie)
// ─────────────────────────────────────────────

async function analyzeLottieFile(file: LoadedFile): Promise<AnimationDiagnostics> {
  let jsonData: any;

  if (file.extension === "json" && file.text) {
    try {
      jsonData = JSON.parse(file.text);
    } catch {
      return {
        format: "lottie",
        width: 0,
        height: 0,
        durationSec: 0,
        fps: 0,
        warnings: ["Corrupted or incomplete structure"],
      };
    }
  } else if (file.extension === "lottie" && file.buffer) {
    try {
      const zip = await JSZip.loadAsync(file.buffer);
      const allPaths = Object.keys(zip.files);

      // Try manifest.json first (official .lottie format)
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
              if (typeof first.path === "string" && first.path) {
                animationPath = first.path.replace(/^\//, "").replace(/\\/g, "/");
              } else if (first?.id) {
                const rawId = String(first.id).trim();
                const candidates = [
                  `${rawId}/animation.json`,
                  `${rawId}/data.json`,
                  `animations/${rawId}.json`,
                  `animations/${rawId}/animation.json`,
                ];
                for (const candidate of candidates) {
                  if (zip.file(candidate)) {
                    animationPath = candidate;
                    break;
                  }
                }
              }
            }
            const main = manifest.main as string | undefined;
            if (!animationPath && typeof main === "string" && main) {
              animationPath = main.replace(/^\//, "").replace(/\\/g, "/");
            }
          } catch {
            // ignore invalid manifest
          }
        }
      }

      // Fallback: find animation.json or data.json
      if (!animationPath) {
        const normalizedPaths = allPaths.map((p) => p.replace(/\\/g, "/"));
        const preferredIdx = normalizedPaths.findIndex(
          (p) =>
            p === "animation.json" ||
            p.endsWith("/animation.json") ||
            p === "data.json" ||
            p.endsWith("/data.json")
        );
        if (preferredIdx >= 0) {
          animationPath = allPaths[preferredIdx].replace(/\\/g, "/");
        }
      }

      const animationEntry = animationPath ? zip.file(animationPath) : null;
      if (!animationEntry) {
        return {
          format: "lottie",
          width: 0,
          height: 0,
          durationSec: 0,
          fps: 0,
          warnings: ["Corrupted or incomplete structure"],
        };
      }

      const animationText = await animationEntry.async("text");
      jsonData = JSON.parse(animationText);
    } catch {
      return {
        format: "lottie",
        width: 0,
        height: 0,
        durationSec: 0,
        fps: 0,
        warnings: ["Corrupted or incomplete structure"],
      };
    }
  } else {
    return {
      format: "lottie",
      width: 0,
      height: 0,
      durationSec: 0,
      fps: 0,
      warnings: ["Missing required fields"],
    };
  }

  const lottieDiag = analyzeLottieJson(jsonData);

  return {
    format: "lottie",
    width: lottieDiag.width,
    height: lottieDiag.height,
    durationSec: lottieDiag.durationSec,
    fps: lottieDiag.fps,
    frames: lottieDiag.frames,
    layers: lottieDiag.layers,
    assets: lottieDiag.assets,
    bodymovinVersion: lottieDiag.bodymovinVersion,
    imageCount: lottieDiag.imageCount,
    embeddedImageCount: lottieDiag.embeddedImageCount,
    externalImageCount: lottieDiag.externalImageCount,
    hasExpressions: lottieDiag.warnings.includes("Expressions detected"),
    warnings: lottieDiag.warnings,
  };
}

// ─────────────────────────────────────────────
// WEBM ANALYZER
// ─────────────────────────────────────────────

async function analyzeWebmFile(file: LoadedFile): Promise<AnimationDiagnostics> {
  const warnings: string[] = [];

  if (!file.buffer) {
    return {
      format: "webm",
      width: 0,
      height: 0,
      durationSec: 0,
      fps: 0,
      warnings: ["Missing video data"],
    };
  }

  return new Promise((resolve) => {
    const blob = new Blob([file.buffer], { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true; // Mute to avoid audio playback

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (video.parentNode) {
        video.remove();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        format: "webm",
        width: 0,
        height: 0,
        durationSec: 0,
        fps: 0,
        warnings: ["Unreadable metadata"],
      });
    }, 10000); // 10 second timeout

    const onLoadedMetadata = () => {
      clearTimeout(timeout);
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;

      // Calculate fps from video metadata if available
      // Note: HTML5 video API doesn't directly expose fps
      // We can estimate from frame count if available, but typically WebM is 24-30 fps
      let fps = 0;
      // Default assumption: 30 fps for WebM (common standard)
      // This could be enhanced with WebM container parsing to get actual frame rate
      fps = 30;

      // File size
      const fileSize = file.size || file.buffer.byteLength || 0;

      // Bitrate estimation (if duration > 0)
      let bitrate = 0;
      if (durationSec > 0 && fileSize > 0) {
        bitrate = Math.round((fileSize * 8) / durationSec); // bits per second
      }

      // Codec detection from WebM container
      // Parse the Matroska container to check for codec strings
      let codec = "unknown";

      try {
        // Parse WebM container (Matroska format) to detect codec
        const buffer = new Uint8Array(file.buffer);
        
        // Look for codec strings in Matroska CodecID elements
        // WebM stores codec info in specific Matroska elements
        // Check first 2MB for codec information (usually in header)
        const searchWindow = Math.min(buffer.length, 2 * 1024 * 1024);
        const bufferStr = new TextDecoder("latin1", { fatal: false }).decode(
          buffer.slice(0, searchWindow)
        );
        
        // Look for CodecID elements which contain codec strings
        // Matroska CodecID format: V_MPEG4/ISO/AVC, V_VP8, V_VP9, V_AV1, etc.
        
        // Check for VP8A (VP8 with alpha)
        const vp8aPattern = /V_VP8A|V_VP8A0|vp8a/i;
        if (vp8aPattern.test(bufferStr)) {
          codec = "VP8A";
        }
        // Check for VP9A (VP9 with alpha)
        else if (/V_VP9A|V_VP9A0|vp9a/i.test(bufferStr)) {
          codec = "VP9A";
        }
        // Check for AV1
        else if (/V_AV1|av01/i.test(bufferStr)) {
          codec = "AV1";
        }
        // Check for VP9 (without alpha)
        else if (/V_VP9|V_VP90|vp9/i.test(bufferStr)) {
          codec = "VP9";
        }
        // Check for VP8 (without alpha)
        else if (/V_VP8|V_VP80|vp8/i.test(bufferStr)) {
          codec = "VP8";
        }
        // Fallback: try to detect from video element codec support
        else {
          if (video.canPlayType) {
            if (video.canPlayType('video/webm; codecs="vp9"')) {
              codec = "VP9";
            } else if (video.canPlayType('video/webm; codecs="vp8"')) {
              codec = "VP8";
            } else {
              codec = "VP8/VP9";
            }
          }
        }
      } catch (err) {
        // If parsing fails, fall back to video element codec detection
        if (video.canPlayType) {
          if (video.canPlayType('video/webm; codecs="vp9"')) {
            codec = "VP9";
          } else if (video.canPlayType('video/webm; codecs="vp8"')) {
            codec = "VP8";
          } else {
            codec = "VP8/VP9";
          }
        }
      }

      // Audio tracks count
      let audioTrackCount = 0;
      try {
        // Check audioTracks API (if available)
        const audioTracks = (video as any).audioTracks;
        if (audioTracks && audioTracks.length) {
          audioTrackCount = audioTracks.length;
        } else {
          // Fallback: check if video has audio tracks via textTracks or other APIs
          // Most WebM files either have 0 or 1 audio track
          // We'll check duration > 0 as a basic indicator that metadata loaded
          // Actual audio detection would require deeper container parsing
          audioTrackCount = 0; // Default to 0, can be enhanced with WebM parser
        }
      } catch {
        audioTrackCount = 0;
      }

      // Warnings
      if (!width || !height) {
        warnings.push("Corrupted header");
      }
      if (!durationSec || !Number.isFinite(durationSec)) {
        warnings.push("Missing duration");
      }
      if (durationSec === 0) {
        warnings.push("Unreadable metadata");
      }

      cleanup();
      resolve({
        format: "webm",
        width,
        height,
        durationSec: Number.isFinite(durationSec) ? parseFloat(durationSec.toFixed(2)) : 0,
        fps,
        bitrate,
        codec,
        fileSize,
        audioTrackCount,
        warnings,
      });
    };

    const onError = () => {
      clearTimeout(timeout);
      warnings.push("Corrupted header");
      cleanup();
      resolve({
        format: "webm",
        width: 0,
        height: 0,
        durationSec: 0,
        fps: 0,
        warnings,
      });
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.src = url;
    // Trigger load
    video.load();
  });
}

// ─────────────────────────────────────────────
// GIF ANALYZER
// Parses the GIF binary header to extract dimensions,
// frame count, and per-frame delays.
// ─────────────────────────────────────────────

function analyzeGifFile(file: LoadedFile): AnimationDiagnostics {
  const empty = (): AnimationDiagnostics => ({
    format: "gif", width: 0, height: 0, durationSec: 0, fps: 0,
    warnings: ["Could not parse GIF metadata"],
  });

  if (!file.buffer) return empty();

  const buf = new Uint8Array(file.buffer);
  if (buf.length < 13) return empty();

  // Validate GIF signature
  const sig = String.fromCharCode(buf[0], buf[1], buf[2]);
  if (sig !== "GIF") return { ...empty(), warnings: ["Not a valid GIF file"] };

  // Logical Screen Descriptor (bytes 6-9, little-endian)
  const width  = buf[6] | (buf[7] << 8);
  const height = buf[8] | (buf[9] << 8);

  // Skip optional Global Color Table
  const packed = buf[10];
  const hasGCT = (packed >> 7) & 1;
  const gctSize = hasGCT ? 3 * (2 ** ((packed & 0x07) + 1)) : 0;
  let pos = 13 + gctSize;

  let frameCount = 0;
  let totalDelay = 0; // centiseconds (1/100 s)

  while (pos < buf.length) {
    const byte = buf[pos];
    if (byte === 0x3B) break; // Trailer

    if (byte === 0x21 && pos + 1 < buf.length) {
      // Extension block
      const label = buf[pos + 1];
      pos += 2;

      if (label === 0xF9 && pos < buf.length && buf[pos] >= 4) {
        // GCE: buf[pos]=blockSize(4), buf[pos+1]=packed, buf[pos+2]=delay_lo, buf[pos+3]=delay_hi
        const delay = buf[pos + 2] | (buf[pos + 3] << 8);
        totalDelay += delay > 0 ? delay : 10;
      }
      // Correct: skip from block-size byte (do NOT pos++ first)
      while (pos < buf.length && buf[pos] !== 0) {
        pos += buf[pos] + 1;
      }
      pos++; // block terminator

    } else if (byte === 0x2C) {
      // Image Descriptor → one frame
      frameCount++;
      if (pos + 9 >= buf.length) break;

      const lctFlags = buf[pos + 9];
      const hasLCT   = (lctFlags >> 7) & 1;
      const lctSize  = hasLCT ? 3 * (2 ** ((lctFlags & 0x07) + 1)) : 0;
      pos += 10 + lctSize + 1; // descriptor + LCT + LZW min code size

      // Skip image sub-blocks
      while (pos < buf.length && buf[pos] !== 0) {
        pos += buf[pos] + 1;
      }
      pos++;
    } else {
      pos++;
    }
  }

  const durationSec = totalDelay / 100;
  const fps = frameCount > 1 && durationSec > 0
    ? parseFloat((frameCount / durationSec).toFixed(1))
    : frameCount === 1 ? 0 : 10;

  return {
    format: "gif",
    width,
    height,
    durationSec: parseFloat(durationSec.toFixed(2)),
    fps,
    frames: frameCount,
    warnings: [],
  };
}

// ─────────────────────────────────────────────
// UNIFIED ANALYZER API
// ─────────────────────────────────────────────

export async function analyzeAnimation(
  file: LoadedFile | null
): Promise<AnimationDiagnostics | null> {
  if (!file) return null;

  try {
    if (file.extension === "json" || file.extension === "lottie") {
      return await analyzeLottieFile(file);
    } else if (file.extension === "webm") {
      return await analyzeWebmFile(file);
    } else if (file.extension === "gif") {
      return analyzeGifFile(file);
    }
  } catch (err) {
    console.error("[Animation Analyzer] Error:", err);
    const fmt: AnimationFormat =
      file.extension === "webm" ? "webm"
      : file.extension === "gif" ? "gif"
      : "lottie";
    return { format: fmt, width: 0, height: 0, durationSec: 0, fps: 0, warnings: ["Unreadable metadata"] };
  }

  return null;
}
