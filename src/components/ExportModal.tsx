import { useState, useRef, useCallback } from "react";
import { LoadedFile } from "../players/PlayerContract";
import { loadAnimationData, createLottieCanvasRenderer } from "../core/export/lottieRenderer";
import { encodeAnimation, reencodeWebm } from "../core/export/ffmpegEncoder";
import { exportComposition } from "../core/export/composeExport";
import { exportGif } from "../core/export/gifExport";
import { ComposeImage, ComposeTransform, ComposeCanvasSize } from "../store/uiStore";

// ── Quality presets ───────────────────────────────────────
const QUALITY_PRESETS = {
  draft:  { label: "Draft",  bitrate: 1_500_000 },
  normal: { label: "Normal", bitrate: 6_000_000 },
  high:   { label: "High",   bitrate: 12_000_000 },
} as const;
type QualityKey = keyof typeof QUALITY_PRESETS;

// ── Output format ─────────────────────────────────────────
const FORMAT_OPTIONS = [
  { id: "mp4", label: "MP4", desc: "H.264, widest compatibility" },
  { id: "gif", label: "GIF", desc: "256 colors, loops everywhere" },
] as const;
type FormatId = typeof FORMAT_OPTIONS[number]["id"];

export interface ComposeExportInfo {
  bgImage: ComposeImage | null;
  transform: ComposeTransform;
  canvasSize: ComposeCanvasSize;
  backgroundColor: string;
  backgroundOpacity: number;
}

interface Props {
  file: LoadedFile;
  backgroundColor: string;
  backgroundOpacity: number;
  composeInfo?: ComposeExportInfo;
  onClose: () => void;
}

type Phase = "idle" | "working" | "done" | "error";

export default function ExportModal({ file, backgroundColor, backgroundOpacity, composeInfo, onClose }: Props) {
  const isCompose = !!composeInfo;
  const [phase, setPhase]         = useState<Phase>("idle");
  const [progress, setProgress]   = useState(0);
  const [statusText, setStatus]   = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const [quality, setQuality]     = useState<QualityKey>("normal");
  const [format, setFormat]       = useState<FormatId>("mp4");
  const [gifUseBg, setGifUseBg]   = useState(true);
  const abortRef = useRef(false);

  const isLottie = file.extension === "json" || file.extension === "lottie";
  const isWebm   = file.extension === "webm";
  const isGif    = file.extension === "gif";

  const handleExport = useCallback(async () => {
    abortRef.current = false;
    setPhase("working");
    setProgress(0);
    setErrorMsg("");
    setSavedPath(null);

    try {
      const bitrate = QUALITY_PRESETS[quality].bitrate;
      let outData: Uint8Array;

      const progressCb = (label: string, p: number) => {
        if (!abortRef.current) { setProgress(p); setStatus(label); }
      };

      if (isCompose && composeInfo) {
        // ── Compose mode ───────────────────────────────
        if (format === "gif") {
          outData = await exportGif(
            file, composeInfo.canvasSize, composeInfo.transform, composeInfo.bgImage,
            composeInfo.backgroundColor, gifUseBg ? composeInfo.backgroundOpacity : 0,
            { onProgress: progressCb },
          );
        } else {
          outData = await exportComposition(
            file, composeInfo.bgImage, composeInfo.transform,
            composeInfo.canvasSize, composeInfo.backgroundColor, composeInfo.backgroundOpacity,
            { onProgress: progressCb },
          );
        }
      } else if (isLottie) {
        // ── Load animation metadata ────────────────────
        setStatus("Reading animation…");
        const meta = await loadAnimationData(file.extension, file.text, file.buffer, file.path);
        if (abortRef.current) return;

        const { width, height, fps, totalFrames, animationData } = meta;

        // ── Setup offscreen renderer ───────────────────
        setStatus("Initialising renderer…");
        const { canvas, renderFrame, destroy } = await createLottieCanvasRenderer(
          animationData, width, height, backgroundColor
        );
        if (abortRef.current) { destroy(); return; }

        // ── Render + encode frame by frame ─────────────
        try {
          if (format === "gif") {
            outData = await exportGif(
              file, { w: width, h: height }, { x: width/2, y: height/2, scale: 1, opacity: 1 },
              null, backgroundColor, gifUseBg ? backgroundOpacity : 0,
              { onProgress: progressCb },
            );
          } else {
            outData = await encodeAnimation(
              canvas, totalFrames,
              async (i) => {
                if (abortRef.current) throw new Error("Cancelled");
                await renderFrame(i);
                const pct = Math.round(((i + 1) / totalFrames) * 100);
                setProgress((i + 1) / totalFrames);
                setStatus(`Rendering frame ${i + 1} / ${totalFrames} (${pct}%)…`);
              },
              { width, height, fps, bitrate },
            );
          }
        } finally {
          destroy();
        }

      } else if (isWebm) {
        // ── WebM → MP4 ─────────────────────────────────
        if (!file.buffer) throw new Error("No video data in file");
        outData = await reencodeWebm(file.buffer, {
          bitrate,
          onProgress: (p) => {
            if (!abortRef.current) { setProgress(p); setStatus(`Encoding… ${Math.round(p * 100)}%`); }
          },
        });

      } else if (isGif) {
        // ── GIF → export as-is (re-encode to requested format) ──
        // For GIF files we re-render through the same lottie-style pipeline isn't available,
        // so we export the original GIF buffer wrapped in the chosen output format.
        // Currently GIF → GIF passes through; GIF → MP4 is not supported.
        if (format === "gif") {
          if (!file.buffer) throw new Error("No GIF data");
          outData = new Uint8Array(file.buffer);
          setProgress(1);
        } else {
          throw new Error("GIF → MP4 conversion is not supported. Choose GIF as output format.");
        }

      } else {
        throw new Error(`Unsupported format: .${file.extension}`);
      }

      if (abortRef.current) return;

      // ── Save ───────────────────────────────────────
      setStatus("Saving…");
      const ext = format === "gif" ? "gif" : format === "webm" ? "webm" : "mp4";
      const defaultName = file.name.replace(/\.[^.]+$/, "") + "." + ext;
      const path = await window.api.saveMp4(outData.buffer, defaultName);

      if (path) {
        setSavedPath(path);
        setProgress(1);
        setPhase("done");
      } else {
        setPhase("idle");
      }

    } catch (err) {
      if (!abortRef.current) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    }
  }, [file, backgroundColor, backgroundOpacity, quality, format, gifUseBg, composeInfo]);

  const busy = phase === "working";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 380, background: "#161616", border: "1px solid #2a2a2a" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid #222" }}
        >
          <span className="text-sm font-semibold text-neutral-200">Export</span>
          {!busy && (
            <button
              className="text-neutral-600 hover:text-neutral-300 transition-colors leading-none"
              onClick={onClose}
            >✕</button>
          )}
        </div>

        {/* Format + format-specific settings (when idle/error) */}
        {(phase === "idle" || phase === "error") && (
          <div className="px-5 pt-3 pb-0 space-y-3">

            {/* 1. Format — always first */}
            <div>
              <div className="text-[9px] uppercase tracking-[.1em] mb-1.5" style={{ color: "#4a4a4a" }}>Format</div>
              <div className="flex gap-1.5">
                {FORMAT_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setFormat(opt.id)}
                    className="flex-1 py-1.5 text-xs rounded transition-colors"
                    title={opt.desc}
                    style={{
                      background:  format === opt.id ? "#1a3a6e" : "#1e1e1e",
                      border:      `1px solid ${format === opt.id ? "#2563eb" : "#2e2e2e"}`,
                      color:       format === opt.id ? "#93c5fd" : "#666",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2a. MP4 — quality selector */}
            {format === "mp4" && (
              <div>
                <div className="text-[9px] uppercase tracking-[.1em] mb-1.5" style={{ color: "#4a4a4a" }}>Quality</div>
                <div className="flex gap-1.5">
                  {(Object.entries(QUALITY_PRESETS) as [QualityKey, typeof QUALITY_PRESETS[QualityKey]][]).map(([key, { label }]) => (
                    <button key={key} onClick={() => setQuality(key)}
                      className="flex-1 py-1.5 text-xs rounded transition-colors"
                      style={{
                        background:  quality === key ? "#2d4a3e" : "#1e1e1e",
                        border:      `1px solid ${quality === key ? "#34d399" : "#2e2e2e"}`,
                        color:       quality === key ? "#6ee7b7" : "#666",
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2b. GIF — background two-state toggle */}
            {format === "gif" && (
              <div>
                <div className="text-[9px] uppercase tracking-[.1em] mb-1.5" style={{ color: "#4a4a4a" }}>Background</div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setGifUseBg(false)}
                    className="flex-1 py-1.5 text-xs rounded transition-colors"
                    style={{
                      background: !gifUseBg ? "#2d4a3e" : "#1e1e1e",
                      border:     `1px solid ${!gifUseBg ? "#34d399" : "#2e2e2e"}`,
                      color:      !gifUseBg ? "#6ee7b7" : "#666",
                    }}>
                    Transparent
                  </button>
                  <button
                    onClick={() => setGifUseBg(true)}
                    className="flex-1 py-1.5 text-xs rounded transition-colors flex items-center justify-center gap-1.5"
                    style={{
                      background: gifUseBg ? "#2d4a3e" : "#1e1e1e",
                      border:     `1px solid ${gifUseBg ? "#34d399" : "#2e2e2e"}`,
                      color:      gifUseBg ? "#6ee7b7" : "#666",
                    }}>
                    Color
                    <span className="w-3 h-3 rounded-sm border shrink-0"
                          style={{
                            backgroundColor: backgroundColor,
                            borderColor: gifUseBg ? "rgba(52,211,153,0.4)" : "#333",
                          }} />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* File info + BG color preview */}
        <div className="px-5 py-3 flex items-center gap-3">
          <span
            className="px-1.5 py-px text-[9px] font-semibold rounded border shrink-0"
            style={{
              background:  isWebm ? "#451a03" : "#1e1b4b",
              color:       isWebm ? "#fbbf24" : "#a5b4fc",
              borderColor: isWebm ? "#78350f" : "#3730a3",
            }}
          >
            {file.extension.toUpperCase()}
          </span>
          <span className="text-sm text-neutral-300 truncate flex-1">{file.name}</span>

          {/* BG color swatch */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] uppercase tracking-wider" style={{ color: "#444" }}>BG</span>
            <span
              className="w-4 h-4 rounded-sm border"
              style={{ backgroundColor, borderColor: "#333" }}
            />
          </div>
        </div>

        {/* Progress */}
        {(busy || phase === "done") && (
          <div className="px-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 truncate pr-2">{statusText}</span>
              <span className="text-xs font-mono shrink-0" style={{ color: "#555" }}>
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "#222" }}>
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width:      `${Math.round(progress * 100)}%`,
                  background: phase === "done" ? "#34d399" : "#4f8ef7",
                }}
              />
            </div>
          </div>
        )}

        {/* Done */}
        {phase === "done" && savedPath && (
          <div className="px-5 pb-4">
            <div
              className="text-xs rounded-lg p-2.5 flex items-center gap-2"
              style={{ background: "#052e16", border: "1px solid #14532d", color: "#86efac" }}
            >
              <span className="shrink-0">✓</span>
              <span className="truncate">{savedPath}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="px-5 pb-4">
            <div
              className="text-xs rounded-lg p-2.5 whitespace-pre-wrap"
              style={{ background: "#3b0a0a", border: "1px solid #7f1d1d", color: "#fca5a5" }}
            >
              {errorMsg}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: "1px solid #222" }}
        >
          {phase === "done" ? (
            <>
              {savedPath && (
                <button
                  className="px-3 py-1.5 text-xs rounded transition-colors"
                  style={{ background: "#1e1e1e", border: "1px solid #2e2e2e", color: "#888" }}
                  onClick={() => window.api.revealInExplorer(savedPath)}
                >
                  Show in folder
                </button>
              )}
              <button
                className="px-4 py-1.5 text-xs rounded"
                style={{ background: "#2d4a3e", border: "1px solid #34d399", color: "#6ee7b7" }}
                onClick={onClose}
              >
                Close
              </button>
            </>
          ) : (
            <>
              {!busy && (
                <button
                  className="px-3 py-1.5 text-xs rounded"
                  style={{ background: "#1e1e1e", border: "1px solid #2e2e2e", color: "#888" }}
                  onClick={onClose}
                >
                  Cancel
                </button>
              )}
              <button
                className="px-4 py-1.5 text-xs rounded disabled:opacity-40"
                style={{ background: "#1a3a6e", border: "1px solid #2563eb", color: "#93c5fd" }}
                onClick={handleExport}
                disabled={busy}
              >
                {phase === "error" ? "Retry" : "Export"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
