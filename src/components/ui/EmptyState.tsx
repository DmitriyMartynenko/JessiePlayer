import { useState, useEffect } from "react";
import iconUrl from "../../images/icon.png";

type RecentFile = { path: string; name: string; extension: string };

const EXT_COLORS: Record<string, string> = {
  json: "#93c5fd", lottie: "#c4b5fd", webm: "#fcd34d", gif: "#5eead4",
};

export function EmptyState({
  isDragOver, onDragOver, onDragLeave, onDrop,
}: {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const [recent, setRecent] = useState<RecentFile[]>([]);

  useEffect(() => {
    window.api?.getRecentFiles?.().then(setRecent).catch(() => {});
  }, []);

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-6 select-none transition-colors
        ${isDragOver ? "bg-slate-700/20 ring-2 ring-inset ring-slate-500" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => window.api?.openFile?.()}
      style={{ cursor: "pointer" }}
    >
      <div className="opacity-60 hover:opacity-90 transition-opacity">
        <img src={iconUrl} width={72} height={72} alt="Jessie Player" aria-hidden
             style={{ borderRadius: "25%" }} />
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-base text-neutral-500">
          Drop your{" "}
          {["json", "lottie", "webm", "gif"].map((ext, i, arr) => (
            <span key={ext}>
              <strong style={{ color: EXT_COLORS[ext] }}>{ext}</strong>
              {i < arr.length - 1 ? (i === arr.length - 2 ? " or " : ", ") : ""}
            </span>
          ))}
          {" "}file here
        </span>
        <span className="text-sm text-neutral-700">or click anywhere to browse</span>
      </div>

      {recent.length > 0 && (
        <div
          className="flex flex-col gap-0.5"
          style={{ minWidth: 260, maxWidth: 380 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-700 mb-1.5 text-center">
            Recent
          </div>
          {recent.slice(0, 6).map(f => (
            <button
              key={f.path}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-left"
              style={{ color: "#555" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              onClick={() => window.api?.openFileByPath?.(f.path)}
              title={f.path}
            >
              <span
                className="text-[9px] font-semibold font-mono shrink-0 w-10 text-right"
                style={{ color: EXT_COLORS[f.extension] ?? "#666" }}
              >
                {f.extension.toUpperCase()}
              </span>
              <span className="text-sm text-neutral-500 truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
