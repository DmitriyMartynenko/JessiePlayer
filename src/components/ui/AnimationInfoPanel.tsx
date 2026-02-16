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
    sectionGeneral: "General animation info",
    sectionImages: "Image statistics",
    sectionBodymovin: "Bodymovin version",
    sectionTechnical: "Format-specific technical metadata",
    sectionAudioCodec: "Audio/codec statistics",
    sectionWarnings: "Warning",
    size: "Size",
    aspectRatio: "Aspect ratio",
    fps: "FPS",
    duration: "Duration",
    frames: "Frames",
    layers: "Layers",
    assets: "Assets",
    bodymovin: "Bodymovin",
    images: "Images",
    embeddedImages: "Embedded base64 images",
    externalImages: "External images",
    formats: "Formats",
    bitrate: "Bitrate",
    codec: "Codec",
    fileSize: "File size",
    alphaChannel: "Alpha channel",
    audioTracks: "Audio tracks",
    warningsTitle: "Warnings",
    secondsSuffix: "sec",
    kbps: "kbps",
    mb: "MB",
    yes: "Yes",
    no: "No",
  },
  ua: {
    title: "Інформація про анімацію",
    sectionGeneral: "Загальна інформація про анімацію",
    sectionImages: "Статистика зображень",
    sectionBodymovin: "Версія Bodymovin",
    sectionTechnical: "Технічні метадані формату",
    sectionAudioCodec: "Статистика аудіо/кодека",
    sectionWarnings: "Попередження",
    size: "Розмір",
    aspectRatio: "Співвідношення сторін",
    fps: "FPS",
    duration: "Тривалість",
    frames: "Кадри",
    layers: "Шари",
    assets: "Ресурси",
    bodymovin: "Bodymovin",
    images: "Зображення",
    embeddedImages: "Вбудовані base64-зображення",
    externalImages: "Зовнішні зображення",
    formats: "Формати",
    bitrate: "Бітрейт",
    codec: "Кодек",
    fileSize: "Розмір файлу",
    alphaChannel: "Альфа-канал",
    audioTracks: "Аудіо доріжки",
    warningsTitle: "Попередження",
    secondsSuffix: "сек",
    kbps: "кбіт/с",
    mb: "МБ",
    yes: "Так",
    no: "Ні",
  },
} as const;

const WARNING_TRANSLATIONS: Record<LogLanguage, Record<string, string>> = {
  en: {
    "Missing required fields": "Missing required fields",
    "Expressions detected": "Expressions detected",
    "Broken or missing image references": "Broken or missing image references",
    "Corrupted or incomplete structure": "Corrupted or incomplete structure",
    "Corrupted header": "Corrupted header",
    "Missing duration": "Missing duration",
    "Unreadable metadata": "Unreadable metadata",
    "Missing video data": "Missing video data",
  },
  ua: {
    "Missing required fields": "Відсутні обов'язкові поля",
    "Expressions detected": "Виявлено вирази",
    "Broken or missing image references":
      "Пошкоджені або відсутні посилання на зображення",
    "Corrupted or incomplete structure": "Пошкоджена або неповна структура",
    "Corrupted header": "Пошкоджений заголовок",
    "Missing duration": "Відсутня тривалість",
    "Unreadable metadata": "Неможливо прочитати метадані",
    "Missing video data": "Відсутні відео дані",
  },
};

export function AnimationInfoPanel({
  diagnostics,
  visible,
  language,
}: Props) {
  if (!visible || !diagnostics) return null;

  const {
    format,
    width,
    height,
    fps,
    durationSec,
    warnings,
    // Lottie-specific
    frames,
    layers,
    assets,
    bodymovinVersion,
    imageCount,
    embeddedImageCount,
    externalImageCount,
    hasExpressions,
    // WebM-specific
    bitrate,
    codec,
    fileSize,
    audioTrackCount,
  } = diagnostics;

  const labels = LABELS[language];
  const prettyWarnings =
    warnings.length > 0
      ? warnings.map(
          (w) => WARNING_TRANSLATIONS[language][w] ?? w,
        )
      : [];

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} ${labels.mb}`;
  };

  const formatBitrate = (bps: number | undefined): string => {
    if (!bps) return "—";
    const kbps = Math.round(bps / 1000);
    return `${kbps} ${labels.kbps}`;
  };

  const formatAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return "—";
    // Calculate GCD to simplify ratio
    const gcd = (a: number, b: number): number => {
      return b === 0 ? a : gcd(b, a % b);
    };
    const divisor = gcd(w, h);
    const simplifiedW = w / divisor;
    const simplifiedH = h / divisor;
    return `${simplifiedW}:${simplifiedH}`;
  };

  return (
    <div
      className="
        absolute top-3 left-3 z-50
        rounded-xl backdrop-blur-md bg-black/60
        text-xs font-mono text-slate-100
        px-3 py-2
        pointer-events-none select-none
        shadow-lg
        space-y-1
      "
    >
      <div className="font-semibold text-[0.7rem] uppercase tracking-wide text-slate-300">
        {labels.title}
      </div>

      {/* General animation info */}
      <div className="mt-1 space-y-0.5">
        <div className="text-[0.7rem] uppercase tracking-wide text-slate-400">
          {labels.sectionGeneral}
        </div>
        <div>
          <span className="text-slate-400">{labels.size}:</span>{" "}
          <span className="text-slate-50">
            {width} × {height}
          </span>
        </div>
        <div>
          <span className="text-slate-400">{labels.aspectRatio}:</span>{" "}
          <span className="text-slate-50">
            {formatAspectRatio(width, height)}
          </span>
        </div>
        <div>
          <span className="text-slate-400">{labels.fps}:</span>{" "}
          <span className="text-slate-50">{fps || "—"}</span>
        </div>
        <div>
          <span className="text-slate-400">{labels.duration}:</span>{" "}
          <span className="text-slate-50">
            {durationSec.toFixed(2)} {labels.secondsSuffix}
          </span>
        </div>
        {format === "lottie" && frames !== undefined && (
          <div>
            <span className="text-slate-400">{labels.frames}:</span>{" "}
            <span className="text-slate-50">{frames}</span>
          </div>
        )}
        {format === "lottie" && layers !== undefined && (
          <div>
            <span className="text-slate-400">{labels.layers}:</span>{" "}
            <span className="text-slate-50">{layers}</span>
          </div>
        )}
        {format === "lottie" && assets !== undefined && (
          <div>
            <span className="text-slate-400">{labels.assets}:</span>{" "}
            <span className="text-slate-50">{assets}</span>
          </div>
        )}
      </div>

      {/* Format-specific technical metadata */}
      {format === "webm" && (
        <div className="mt-2 space-y-0.5">
          <div className="text-[0.7rem] uppercase tracking-wide text-slate-400">
            {labels.sectionTechnical}
          </div>
          {bitrate !== undefined && (
            <div>
              <span className="text-slate-400">{labels.bitrate}:</span>{" "}
              <span className="text-slate-50">{formatBitrate(bitrate)}</span>
            </div>
          )}
          {codec && (
            <div>
              <span className="text-slate-400">{labels.codec}:</span>{" "}
              <span className="text-slate-50">{codec}</span>
            </div>
          )}
          {fileSize !== undefined && (
            <div>
              <span className="text-slate-400">{labels.fileSize}:</span>{" "}
              <span className="text-slate-50">{formatFileSize(fileSize)}</span>
            </div>
          )}
        </div>
      )}

      {/* Image statistics (Lottie only) */}
      {format === "lottie" && imageCount !== undefined && imageCount > 0 && (
        <div className="mt-2 space-y-0.5">
          <div className="text-[0.7rem] uppercase tracking-wide text-slate-400">
            {labels.sectionImages}
          </div>
          <div>
            <span className="text-slate-400">{labels.images}:</span>{" "}
            <span className="text-slate-50">{imageCount}</span>
          </div>
          {embeddedImageCount !== undefined && (
            <div>
              <span className="text-slate-400">{labels.embeddedImages}:</span>{" "}
              <span className="text-slate-50">{embeddedImageCount}</span>
            </div>
          )}
          {externalImageCount !== undefined && (
            <div>
              <span className="text-slate-400">{labels.externalImages}:</span>{" "}
              <span className="text-slate-50">{externalImageCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Audio/codec statistics (WebM only) */}
      {format === "webm" && audioTrackCount !== undefined && (
        <div className="mt-2 space-y-0.5">
          <div className="text-[0.7rem] uppercase tracking-wide text-slate-400">
            {labels.sectionAudioCodec}
          </div>
          <div>
            <span className="text-slate-400">{labels.audioTracks}:</span>{" "}
            <span className="text-slate-50">{audioTrackCount}</span>
          </div>
        </div>
      )}

      {/* Bodymovin version (Lottie only) */}
      {format === "lottie" && bodymovinVersion && (
        <div className="mt-2 space-y-0.5">
          <div className="text-[0.7rem] uppercase tracking-wide text-slate-400">
            {labels.sectionBodymovin}
          </div>
          <div>
            <span className="text-slate-400">{labels.bodymovin}:</span>{" "}
            <span className="text-slate-50">{bodymovinVersion}</span>
          </div>
        </div>
      )}

      {/* Real warnings only */}
      {prettyWarnings.length > 0 && (
        <div className="mt-2 space-y-0.5 text-amber-400">
          <div className="text-[0.7rem] uppercase tracking-wide flex items-center gap-1">
            <span>⚠</span>
            <span>{labels.sectionWarnings}</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {prettyWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

