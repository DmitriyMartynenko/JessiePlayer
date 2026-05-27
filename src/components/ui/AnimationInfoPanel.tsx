import type { AnimationDiagnostics } from "../../core/analyzers/animationAnalyzer";

type LogLanguage = "en" | "ua";

interface Props {
  diagnostics: AnimationDiagnostics | null;
  visible: boolean;
  language: LogLanguage;
}

const LABELS = {
  en: {
    title: "Animation Info",
    general: "General",
    images: "Images",
    technical: "Technical",
    warnings: "Warnings",
    size: "Size", ratio: "Ratio", fps: "FPS",
    duration: "Duration", frames: "Frames", layers: "Layers", assets: "Assets",
    total: "Total", embedded: "Embedded", external: "External",
    bodymovin: "Bodymovin", bitrate: "Bitrate", codec: "Codec",
    fileSize: "File size", audioTracks: "Audio tracks",
    sec: "sec", kbps: "kbps", mb: "MB",
  },
  ua: {
    title: "Інфо про анімацію",
    general: "Загальне",
    images: "Зображення",
    technical: "Технічне",
    warnings: "Попередження",
    size: "Розмір", ratio: "Пропорції", fps: "FPS",
    duration: "Тривалість", frames: "Кадри", layers: "Шари", assets: "Ресурси",
    total: "Всього", embedded: "Вбудовані", external: "Зовнішні",
    bodymovin: "Bodymovin", bitrate: "Бітрейт", codec: "Кодек",
    fileSize: "Розмір файлу", audioTracks: "Аудіо",
    sec: "сек", kbps: "кбіт/с", mb: "МБ",
  },
} as const;

const WARN_UA: Record<string, string> = {
  "Missing required fields": "Відсутні обов'язкові поля",
  "Expressions detected": "Виявлено вирази",
  "Broken or missing image references": "Пошкоджені посилання на зображення",
  "Corrupted or incomplete structure": "Пошкоджена або неповна структура",
  "Corrupted header": "Пошкоджений заголовок",
  "Missing duration": "Відсутня тривалість",
  "Unreadable metadata": "Неможливо прочитати метадані",
  "Missing video data": "Відсутні відео дані",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-neutral-500">{label}</span>
      <span className="text-slate-100">{value}</span>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.58rem] font-semibold uppercase tracking-widest text-neutral-600 mb-1.5">
        {title}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-[3px]">
        {children}
      </div>
    </div>
  );
}

export function AnimationInfoPanel({ diagnostics, visible, language }: Props) {
  if (!visible || !diagnostics) return null;

  const L = LABELS[language];
  const {
    format, width, height, fps, durationSec, warnings,
    frames, layers, assets, bodymovinVersion,
    imageCount, embeddedImageCount, externalImageCount,
    bitrate, codec, fileSize, audioTrackCount,
  } = diagnostics;

  const isLottie = format === "lottie";
  const isGif    = format === "gif";
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const ratio = width && height ? (() => {
    const d = gcd(width, height);
    return `${width / d}:${height / d}`;
  })() : "—";

  const fmtSize = (b?: number) => b ? `${(b / 1048576).toFixed(2)} ${L.mb}` : "—";
  const fmtBitrate = (bps?: number) => bps ? `${Math.round(bps / 1000)} ${L.kbps}` : "—";

  const prettyWarnings = warnings.map((w) =>
    language === "ua" ? (WARN_UA[w] ?? w) : w
  );

  const badgeClass = isLottie
    ? "bg-blue-950 text-blue-300 border-blue-800/50"
    : isGif
      ? "bg-teal-950 text-teal-300 border-teal-800/50"
      : "bg-amber-950 text-amber-300 border-amber-800/50";

  return (
    <div
      className="absolute top-3 left-3 z-50 rounded-xl
                 bg-neutral-900/95 backdrop-blur-md
                 border border-neutral-800/70 shadow-2xl
                 text-xs font-mono text-slate-200 overflow-hidden"
      style={{ minWidth: 210 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/60">
        <span className="text-[0.62rem] font-semibold uppercase tracking-widest text-neutral-500">
          {L.title}
        </span>
        <span className={`px-1.5 py-px text-[9px] rounded border font-sans font-semibold ${badgeClass}`}>
          {isGif ? "GIF" : isLottie ? (bodymovinVersion ? "LOTTIE" : "JSON") : "WEBM"}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-3">

        {/* General */}
        <Section title={L.general}>
          <Row label={L.size}     value={`${width} × ${height}`} />
          <Row label={L.ratio}    value={ratio} />
          <Row label={L.fps}      value={fps || "—"} />
          <Row label={L.duration} value={`${durationSec.toFixed(2)} ${L.sec}`} />
          {(isLottie || isGif) && frames !== undefined && <Row label={L.frames} value={frames} />}
          {isLottie && layers !== undefined && <Row label={L.layers} value={layers} />}
          {isLottie && assets !== undefined && <Row label={L.assets} value={assets} />}
        </Section>

        {/* WebM technical */}
        {!isLottie && (
          <>
            <div className="border-t border-neutral-800/60" />
            <Section title={L.technical}>
              {codec     && <Row label={L.codec}      value={codec} />}
              {bitrate   !== undefined && <Row label={L.bitrate}  value={fmtBitrate(bitrate)} />}
              {fileSize  !== undefined && <Row label={L.fileSize} value={fmtSize(fileSize)} />}
              {audioTrackCount !== undefined && <Row label={L.audioTracks} value={audioTrackCount} />}
            </Section>
          </>
        )}

        {/* Lottie images */}
        {isLottie && !!imageCount && (
          <>
            <div className="border-t border-neutral-800/60" />
            <Section title={L.images}>
              <Row label={L.total}    value={imageCount} />
              {embeddedImageCount !== undefined && <Row label={L.embedded} value={embeddedImageCount} />}
              {externalImageCount !== undefined && <Row label={L.external} value={externalImageCount} />}
            </Section>
          </>
        )}

        {/* Bodymovin */}
        {isLottie && bodymovinVersion && (
          <>
            <div className="border-t border-neutral-800/60" />
            <div className="grid grid-cols-[auto_1fr] gap-x-4">
              <Row label={L.bodymovin} value={bodymovinVersion} />
            </div>
          </>
        )}

        {/* Warnings */}
        {prettyWarnings.length > 0 && (
          <>
            <div className="border-t border-neutral-800/60" />
            <div>
              <div className="text-[0.58rem] font-semibold uppercase tracking-widest text-amber-600/80 mb-1.5 flex items-center gap-1">
                <span>⚠</span>
                <span>{L.warnings}</span>
              </div>
              <ul className="space-y-0.5">
                {prettyWarnings.map((w, i) => (
                  <li key={i} className="text-amber-400/90">{w}</li>
                ))}
              </ul>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
