import { LoadedFile } from "../players/PlayerContract";
import iconImage from "../images/icon.png";

type LogLanguage = "en" | "ua";

type Props = {
  windowState: "normal" | "maximized";
  file: LoadedFile | null;
  showInfo: boolean;
  logLanguage: LogLanguage;
  onToggleInfo: () => void;
  onToggleInfoLanguage: () => void;
};

function getPathParts(file: LoadedFile): { dir: string; name: string } {
  const path = file.path ?? "";
  if (!path) return { dir: "", name: file.name };
  const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastSep < 0) return { dir: "", name: file.name };
  return { dir: path.slice(0, lastSep + 1), name: file.name };
}

export default function TopBar({
  windowState,
  file,
  showInfo,
  logLanguage,
  onToggleInfo,
  onToggleInfoLanguage,
}: Props) {
  const isMaximized = windowState === "maximized";
  const pathParts = file ? getPathParts(file) : null;

  const logLabel = logLanguage === "en" ? "Log" : "Лог";
  const logTooltip =
    logLanguage === "en"
      ? "Show animation technical information"
      : "Показати технічну інформацію анімації";

  return (
    <div
      className={`
        relative h-10 flex items-center justify-between px-3
        bg-neutral-900 border-b border-neutral-800 select-none
        ${!isMaximized ? "app-region-drag" : ""}
      `}
    >
      {/* ===== Ліва частина ===== */}
      <div className="flex items-center gap-3 text-sm app-region-no-drag">
        <button
          className="hover:opacity-80 transition-opacity"
          onClick={() => window.api?.openFile?.()}
          title="Open file"
        >
          <img
            src={iconImage}
            alt="Open file"
            className="w-5 h-5"
          />
        </button>

        <button
          className="px-2 py-1 text-xs bg-neutral-800 rounded hover:bg-neutral-700"
          onClick={() => window.api?.toggleBackground?.()}
          onContextMenu={(e) => {
            e.preventDefault();
            window.api?.toggleBackgroundTheme?.();
          }}
          title="Left click - change transparency&#10;Right click - change color"
        >
          BG
        </button>

        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            showInfo
              ? "bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-200"
              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          }`}
          onClick={onToggleInfo}
          onContextMenu={(e) => {
            e.preventDefault();
            if (showInfo) {
              onToggleInfoLanguage();
            }
          }}
          title={logTooltip}
        >
          {logLabel}
        </button>
      </div>

      {/* ===== Центр ===== */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-0 text-sm text-neutral-400 max-w-[60vw] min-w-0">
        {pathParts ? (
          <>
            <span className="truncate">{pathParts.dir}</span>
            <span className="font-semibold text-neutral-300 shrink-0">{pathParts.name}</span>
          </>
        ) : (
          "Waiting for file…"
        )}
      </div>

      {/* ===== Права частина (кнопки вікна) ===== */}
      <div className="flex items-center gap-1 app-region-no-drag">
        <button
          className="w-8 h-6 hover:bg-neutral-700 rounded"
          onClick={() => window.api?.window?.minimize?.()}
          onContextMenu={(e) => e.preventDefault()}
        >
          —
        </button>

        <button
          className="w-8 h-6 hover:bg-neutral-700 rounded"
          onClick={() => window.api?.window?.maximize?.()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {isMaximized ? "🗗" : "□"}
        </button>

        <button
          className="w-8 h-6 hover:bg-red-600 rounded"
          onClick={() => window.api?.window?.close?.()}
          onContextMenu={(e) => e.preventDefault()}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
