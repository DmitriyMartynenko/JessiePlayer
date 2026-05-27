import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { LoadedFile } from "../players/PlayerContract";
import { useUiStore, ComposeImage, ComposeCanvasSize } from "../store/uiStore";

export const SIDEBAR_DRAWER_WIDTH = 320;
const TOP_BAR_HEIGHT_PX    = 40;
const BOTTOM_BAR_HEIGHT_PX = 64;

type DirectoryEntry =
  | { kind: "dir";  name: string; path: string }
  | { kind: "file"; name: string; path: string; extension: string };

function getDirectoryFromPath(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return lastSep < 0 ? "" : filePath.slice(0, lastSep);
}

function parseBreadcrumbs(dirPath: string): { label: string; path: string }[] {
  if (!dirPath) return [];
  const sep   = dirPath.includes("\\") ? "\\" : "/";
  const parts = dirPath.split(sep).filter(Boolean);
  return parts.map((label, i) => {
    const path = i === 0 && label.endsWith(":") ? label + sep : parts.slice(0, i+1).join(sep);
    return { label, path };
  });
}

function extBadgeClass(ext: string): string {
  switch (ext.toLowerCase()) {
    case "json":   return "bg-blue-950 text-blue-300 border-blue-800/50";
    case "lottie": return "bg-purple-950 text-purple-300 border-purple-800/50";
    case "webm":   return "bg-amber-950 text-amber-300 border-amber-800/50";
    case "gif":    return "bg-teal-950 text-teal-300 border-teal-800/50";
    default:       return "bg-neutral-800 text-neutral-400 border-neutral-700/50";
  }
}

function AeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-[0.1em] font-sans select-none" style={{ color: "#4a4a4a" }}>
      {children}
    </span>
  );
}

// ── Scrub input — drag to change value, click to type ────────
// Drag: value changes by `step` per pixel.
// Ctrl + Drag: changes by `fastStep` per pixel (10× faster).
interface ScrubInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  fastStep?: number;
  disabled?: boolean;
}

function ScrubInput({
  label, value, onChange,
  min = -Infinity, max = Infinity,
  step = 1, fastStep = 10,
  disabled = false,
}: ScrubInputProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText]       = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally
  useEffect(() => { if (!editing) setText(String(value)); }, [value, editing]);

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));

  const commitEdit = () => {
    const n = parseInt(text, 10);
    if (!isNaN(n)) onChange(clamp(n));
    else setText(String(value));
    setEditing(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || editing) return;
    e.preventDefault();

    const startX     = e.clientX;
    const startValue = value;
    let   moved      = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 2) moved = true;
      if (!moved) return;
      const s = ev.ctrlKey ? fastStep : step;
      onChange(clamp(startValue + dx * s));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      if (!moved) {
        // Plain click → switch to text editing
        setEditing(true);
        setText(String(value));
        requestAnimationFrame(() => { inputRef.current?.select(); });
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  const baseInputStyle: React.CSSProperties = {
    background: "#1c1c1c",
    color: disabled ? "#444" : "#bbb",
    padding: "2px 0",
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={text}
          className="w-full text-center font-mono text-[11px] rounded-sm outline-none"
          style={{ ...baseInputStyle, border: "1px solid #4a90e2", color: "#fff" }}
          onChange={e => setText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === "Enter")  commitEdit();
            if (e.key === "Escape") { setText(String(value)); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <div
          className="w-full text-center font-mono text-[11px] rounded-sm select-none"
          style={{
            ...baseInputStyle,
            border: "1px solid #2e2e2e",
            cursor: disabled ? "default" : "ew-resize",
          }}
          onMouseDown={handleMouseDown}
          title={disabled ? undefined : "Drag to change · Ctrl+drag for ×10 · Click to type"}
        >
          {value}
        </div>
      )}
      <AeLabel>{label}</AeLabel>
    </div>
  );
}

const CANVAS_MIN = 320;
const CANVAS_MAX = 4096;

// ── Background tab ─────────────────────────────────────────
function BackgroundTab({ hasFile }: { hasFile: boolean }) {
  const composeImage      = useUiStore((s) => s.composeImage);
  const composeTransform  = useUiStore((s) => s.composeTransform);
  const composeCanvasSize = useUiStore((s) => s.composeCanvasSize);
  const uiActions         = useUiStore((s) => s.actions);

  const [scaleLocal,   setScaleLocal]   = useState(Math.round(composeTransform.scale * 100));
  const [opacityLocal, setOpacityLocal] = useState(Math.round((composeTransform.opacity ?? 1) * 100));
  const [aspectLock,   setAspectLock]   = useState(true);

  useEffect(() => { setScaleLocal(Math.round(composeTransform.scale * 100)); }, [composeTransform.scale]);
  useEffect(() => { setOpacityLocal(Math.round((composeTransform.opacity ?? 1) * 100)); }, [composeTransform.opacity]);

  const handleLoadImage = useCallback(async () => {
    const result = await window.api.openImageFile?.();
    if (!result?.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const ci: ComposeImage = {
        dataUrl:      result.dataUrl,
        naturalWidth:  img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
      uiActions.setComposeImage(ci);
      uiActions.setComposeTransform({
        x:     img.naturalWidth / 2,
        y:     img.naturalHeight / 2,
        scale: 1,
      });
    };
    img.src = result.dataUrl;
  }, [uiActions]);

  const commitScale = (v: number) => {
    uiActions.setComposeTransform(prev => ({ ...prev, scale: Math.max(0.05, v / 100) }));
  };

  const aspectRatio = composeCanvasSize.h > 0 ? composeCanvasSize.w / composeCanvasSize.h : 1;

  const setW = (w: number) => {
    const h = aspectLock && !composeImage ? Math.round(w / aspectRatio) : composeCanvasSize.h;
    uiActions.setComposeCanvasSize({ w, h: Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, h)) });
  };
  const setH = (h: number) => {
    const w = aspectLock && !composeImage ? Math.round(h * aspectRatio) : composeCanvasSize.w;
    uiActions.setComposeCanvasSize({ w: Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, w)), h });
  };

  const fillPct = `${Math.max(0, Math.min(100, ((scaleLocal - 5) / (300 - 5)) * 100)).toFixed(1)}%`;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">

      {/* ── Background image ───────────────────────────── */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
        <AeLabel>Background Image</AeLabel>

        {!composeImage ? (
          /* No image */
          <div className="mt-2 rounded-lg flex flex-col items-center justify-center gap-2 py-5"
               style={{ background: "#111", border: "1px dashed #2a2a2a" }}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none"
                 stroke="#3a3a3a" strokeWidth="1.5" strokeLinecap="round">
              <rect x="4" y="8" width="40" height="32" rx="3"/>
              <circle cx="15" cy="19" r="4"/>
              <path d="M4 34 l10-10 8 8 6-6 16 14"/>
            </svg>
            <span className="text-[11px]" style={{ color: "#444" }}>No image loaded</span>
            <button onClick={handleLoadImage}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors mt-1"
              style={{ background: "#1e2a1e", border: "1px solid #2d4a2d", color: "#6ee7b7" }}>
              Load image…
            </button>
          </div>
        ) : (
          /* Has image */
          <div className="mt-2">
            <div className="rounded-lg overflow-hidden mb-2.5" style={{ height: 90 }}>
              <img src={composeImage.dataUrl} alt="" draggable={false}
                   className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] truncate" style={{ color: "#666" }}>
                {composeImage.naturalWidth} × {composeImage.naturalHeight}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button onClick={handleLoadImage}
                  className="text-[10px] px-2 py-px rounded transition-colors"
                  style={{ color: "#555", border: "1px solid #2a2a2a", background: "#1a1a1a" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#aaa"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#555"; }}>
                  Change
                </button>
                <button
                  onClick={() => uiActions.setComposeImage(null)}
                  className="text-[10px] px-2 py-px rounded transition-colors"
                  style={{ color: "#7f1d1d", border: "1px solid #2a1a1a", background: "#1a1111" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fca5a5"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#7f1d1d"; }}
                  title="Remove background image">
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Animation opacity ──────────────────────────── */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid #1e1e1e", opacity: hasFile ? 1 : 0.4 }}>
        <div className="flex items-center justify-between mb-2">
          <AeLabel>Opacity</AeLabel>
          <span className="text-[11px] font-mono" style={{ color: "#aaa" }}>
            {hasFile ? `${opacityLocal}%` : "—"}
          </span>
        </div>
        <input
          type="range" min={0} max={100} value={opacityLocal}
          disabled={!hasFile}
          className="timeline-input w-full"
          style={{ "--fill": `${opacityLocal}%` } as React.CSSProperties}
          onInput={e => {
            const v = parseInt((e.target as HTMLInputElement).value);
            setOpacityLocal(v);
            uiActions.setComposeTransform(prev => ({ ...prev, opacity: v / 100 }));
          }}
        />
      </div>

      {/* ── Animation scale ────────────────────────────── */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid #1e1e1e", opacity: hasFile ? 1 : 0.4 }}>
        <div className="flex items-center justify-between mb-2">
          <AeLabel>Animation Scale</AeLabel>
          <span className="text-[11px] font-mono" style={{ color: "#aaa" }}>
            {hasFile ? `${scaleLocal}%` : "—"}
          </span>
        </div>
        <input
          type="range" min={5} max={300} value={scaleLocal}
          disabled={!hasFile}
          className="timeline-input w-full"
          style={{ "--fill": fillPct } as React.CSSProperties}
          onInput={e => {
            const v = parseInt((e.target as HTMLInputElement).value);
            setScaleLocal(v);
            uiActions.setComposeTransform(prev => ({ ...prev, scale: v / 100 }));
          }}
          onMouseUp={() => commitScale(scaleLocal)}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[9px]" style={{ color: "#333" }}>5%</span>
          <span className="text-[9px]" style={{ color: "#333" }}>300%</span>
        </div>
      </div>

      {/* ── Animation size (= composition canvas size) ─── */}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-3">
          <AeLabel>Animation Size</AeLabel>
          {composeImage && (
            <span className="text-[9px] font-mono" style={{ color: "#3a3a3a" }}>from image</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <ScrubInput
              label="W"
              value={composeImage ? composeImage.naturalWidth : composeCanvasSize.w}
              onChange={setW}
              min={CANVAS_MIN} max={CANVAS_MAX}
              step={1} fastStep={10}
              disabled={!!composeImage}
            />
          </div>

          {/* Aspect ratio lock */}
          {!composeImage && (
            <button
              className="flex items-center justify-center rounded mb-3 transition-colors shrink-0"
              style={{
                width: 20, height: 20, marginTop: 2,
                color: aspectLock ? "#34d399" : "#3a3a3a",
                background: aspectLock ? "rgba(52,211,153,0.1)" : "transparent",
                border: `1px solid ${aspectLock ? "rgba(52,211,153,0.3)" : "#2a2a2a"}`,
              }}
              onClick={() => setAspectLock(v => !v)}
              title={aspectLock ? "Unlock aspect ratio" : "Lock aspect ratio"}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {aspectLock
                  ? <><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.5a2 2 0 0 1 4 0V5"/></>
                  : <><rect x="2" y="5" width="8" height="6" rx="1"/><path d="M4 5V3.5a2 2 0 0 1 4 0"/></>
                }
              </svg>
            </button>
          )}

          <div className="flex-1">
            <ScrubInput
              label="H"
              value={composeImage ? composeImage.naturalHeight : composeCanvasSize.h}
              onChange={setH}
              min={CANVAS_MIN} max={CANVAS_MAX}
              step={1} fastStep={10}
              disabled={!!composeImage}
            />
          </div>
        </div>
        <div className="text-[9px] mt-1.5" style={{ color: "#333" }}>
          {composeImage
            ? "Set by background image"
            : `Composition canvas · ${CANVAS_MIN}–${CANVAS_MAX} px`}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function SidebarDrawer({ file }: { file: LoadedFile | null }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const scaleMode   = useUiStore((s) => s.scaleMode);
  const close       = useUiStore((s) => s.actions.setSidebarOpen);

  const [activeTab, setActiveTab]   = useState<"files" | "bg">("files");
  const [currentDir, setCurrentDir] = useState<string>("");
  const [entries, setEntries]       = useState<DirectoryEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const activePath = file?.path ?? "";
  const activeDir  = useMemo(() => (activePath ? getDirectoryFromPath(activePath) : ""), [activePath]);
  const requestIdRef = useRef(0);

  // Reset to Files tab when leaving Compose mode
  useEffect(() => {
    if (scaleMode !== "compose") setActiveTab("files");
  }, [scaleMode]);

  useEffect(() => {
    if (activeDir) setCurrentDir(activeDir);
  }, [activeDir]);

  useEffect(() => {
    if (!sidebarOpen || activeTab !== "files") return;
    if (!currentDir) { setEntries([]); return; }
    let cancelled = false;
    const myId = ++requestIdRef.current;
    setLoading(true); setError(null);
    Promise.resolve()
      .then(async () => {
        const list = await window.api.getDirectoryFiles(currentDir);
        if (cancelled || requestIdRef.current !== myId) return;
        setEntries(list as DirectoryEntry[]);
      })
      .catch(e => { if (!cancelled) { setError(e?.message ?? "Failed to read directory"); setEntries([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sidebarOpen, activeTab, currentDir]);

  const goUp = async () => {
    if (!currentDir) return;
    const parent = await window.api.getParentDirectory(currentDir);
    if (parent) setCurrentDir(parent);
  };

  const openEntry = async (entry: DirectoryEntry) => {
    if (entry.kind === "dir") { setCurrentDir(entry.path); return; }
    if (window.api.openFileIPC) { await window.api.openFileIPC(entry.path); return; }
    window.api.openFileByPath(entry.path);
  };

  const isCompose = scaleMode === "compose";

  const tabClass = (tab: "files" | "bg") =>
    `flex-1 py-2 text-xs font-medium transition-colors ${
      activeTab === tab
        ? "text-emerald-300 border-b-2 border-emerald-500 bg-emerald-600/10"
        : "text-neutral-500 hover:text-neutral-300 border-b-2 border-transparent"
    }`;

  return (
    <div
      className={[
        "absolute left-0 right-0 z-50 transition-opacity duration-200",
        sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        // In Compose mode: outer wrapper is pointer-events-none so stage
        // receives drag/scroll events. The <aside> overrides this with
        // pointer-events-auto so sidebar interaction still works.
        isCompose && sidebarOpen ? "pointer-events-none" : (sidebarOpen ? "pointer-events-auto" : ""),
      ].join(" ")}
      style={{ top: TOP_BAR_HEIGHT_PX, bottom: BOTTOM_BAR_HEIGHT_PX }}
    >
      {/* Backdrop — only in non-Compose mode */}
      {!isCompose && (
        <div className="absolute inset-0" onMouseDown={() => close(false)} />
      )}

      {/* Drawer */}
      <aside
        className={["absolute right-0 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col",
          "transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
          "pointer-events-auto",  // restore events on sidebar itself in Compose mode
        ].join(" ")}
        style={{ width: SIDEBAR_DRAWER_WIDTH, top: 0, bottom: 0 }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Tabs (Background only in Compose mode) ──── */}
        <div className="flex shrink-0 border-b border-neutral-800">
          <button className={tabClass("files")} onClick={() => setActiveTab("files")}>Files</button>
          {isCompose && (
            <button className={tabClass("bg")} onClick={() => setActiveTab("bg")}>Background</button>
          )}
        </div>

        {/* ── FILES tab ─────────────────────────────────── */}
        {activeTab === "files" && (
          <>
            {/* Breadcrumb header */}
            <div className="px-2.5 py-2 flex items-center gap-2 border-b border-neutral-800 shrink-0">
              <button
                type="button"
                className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded flex items-center gap-1.5 text-neutral-300 transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0"
                onClick={goUp} disabled={!currentDir} title="Up one level">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="10 4 6 8 10 12" />
                </svg>
                Up
              </button>
              {currentDir ? (
                <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-hidden text-xs">
                  {(() => {
                    const crumbs  = parseBreadcrumbs(currentDir);
                    const visible = crumbs.length > 3 ? [{ label: "…", path: "" }, ...crumbs.slice(-2)] : crumbs;
                    return visible.map((crumb, i) => (
                      <span key={i} className="flex items-center gap-0.5 min-w-0 shrink-0">
                        {i > 0 && <span className="text-neutral-700 px-0.5">/</span>}
                        <button
                          className={`truncate transition-colors ${
                            i === visible.length - 1
                              ? "text-neutral-300 hover:text-neutral-100 font-medium"
                              : "text-neutral-600 hover:text-neutral-400"
                          } ${!crumb.path ? "cursor-default pointer-events-none" : ""}`}
                          onClick={() => crumb.path && setCurrentDir(crumb.path)}
                          title={crumb.path || undefined}>
                          {crumb.label}
                        </button>
                      </span>
                    ));
                  })()}
                </div>
              ) : (
                <span className="text-xs text-neutral-600 flex-1">No file opened</span>
              )}
            </div>

            {/* File list */}
            <div className="flex-1 min-h-0 overflow-auto">
              {loading && <div className="px-3 py-2 text-xs text-neutral-500">Loading…</div>}
              {error   && <div className="px-3 py-2 text-xs text-red-300">{error}</div>}
              {!loading && !error && (
                <ul className="py-1">
                  {entries.map(e => {
                    const isActive = e.kind === "file" && e.path === activePath;
                    return (
                      <li key={`${e.kind}:${e.path}`}>
                        <button
                          className={["w-full px-3 py-2 text-left text-sm hover:bg-neutral-800 transition-colors flex items-center gap-2.5",
                            isActive ? "bg-emerald-600/20 border-l-2 border-emerald-500/50 text-emerald-200" : "text-neutral-300",
                          ].join(" ")}
                          onClick={() => openEntry(e)} title={e.path}>
                          {e.kind === "dir" ? (
                            <span className="text-base leading-none shrink-0">📁</span>
                          ) : (
                            <span className={`px-1.5 py-px text-[9px] font-semibold rounded border shrink-0 ${extBadgeClass(e.extension)}`}>
                              {(e.extension || "FILE").toUpperCase()}
                            </span>
                          )}
                          <span className="truncate min-w-0 flex-1">{e.name}</span>
                        </button>
                      </li>
                    );
                  })}
                  {entries.length === 0 && currentDir && (
                    <li className="px-3 py-2 text-xs text-neutral-500">No supported files here.</li>
                  )}
                  {!currentDir && (
                    <li className="px-3 py-2 text-xs text-neutral-500">Open a file to show its directory.</li>
                  )}
                </ul>
              )}
            </div>
          </>
        )}

        {/* ── BACKGROUND tab ────────────────────────────── */}
        {activeTab === "bg" && <BackgroundTab hasFile={!!file} />}
      </aside>
    </div>
  );
}
