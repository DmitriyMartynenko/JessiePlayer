import { useState, useRef, useEffect } from "react";
import { AnimationState, useAnimationControls, SpeedOption } from "../hooks/useAnimationControls";

type Props = {
  state: AnimationState;
  actions: ReturnType<typeof useAnimationControls>["actions"];
  speedOptions: readonly SpeedOption[];
  sidebarOpen: boolean;
  hasFile: boolean;
  onToggleSidebar: () => void;
  onExport: () => void;
};

export default function BottomControls({
  state,
  actions,
  speedOptions,
  sidebarOpen,
  hasFile,
  onToggleSidebar,
  onExport,
}: Props) {
  const [showSpeedMenu, setShowSpeedMenu]     = useState(false);
  const [showShortcuts, setShowShortcuts]     = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, left: "0%", text: "" });

  const speedMenuRef  = useRef<HTMLDivElement>(null);
  const shortcutsBtnRef = useRef<HTMLButtonElement>(null);
  const shortcutsPanelRef = useRef<HTMLDivElement>(null);
  const tlWrapRef     = useRef<HTMLDivElement>(null);
  const timelineRef   = useRef<HTMLInputElement>(null);

  // ── Close speed menu on outside click ─────────────────
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handle = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node))
        setShowSpeedMenu(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSpeedMenu]);

  // ── Close shortcuts panel on outside click ────────────
  useEffect(() => {
    if (!showShortcuts) return;
    const handle = (e: MouseEvent) => {
      if (
        shortcutsBtnRef.current?.contains(e.target as Node) ||
        shortcutsPanelRef.current?.contains(e.target as Node)
      ) return;
      setShowShortcuts(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showShortcuts]);

  // ── Update --fill CSS var on timeline ─────────────────
  const progress =
    state.info && state.info.totalFrames > 0
      ? state.currentFrame / (state.info.totalFrames - 1)
      : 0;

  useEffect(() => {
    timelineRef.current?.style.setProperty("--fill", `${(progress * 100).toFixed(2)}%`);
  }, [progress]);

  // ── Timeline hover tooltip ─────────────────────────────
  const handleTlMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.info) return;
    const rect = tlWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct   = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const frame = Math.round(pct * (state.info.totalFrames - 1));
    const time  = (frame / state.info.frameRate).toFixed(1);
    setTooltip({ visible: true, left: `${(pct * 100).toFixed(1)}%`, text: `${time}s · f${frame}` });
  };

  const handleTlLeave = () => setTooltip((t) => ({ ...t, visible: false }));

  // ── Timeline change ────────────────────────────────────
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (state.info) actions.seekToFrame(parseFloat(e.target.value));
  };

  // ── Speed ──────────────────────────────────────────────
  const handleSpeedSelect = (speed: SpeedOption) => {
    actions.setSpeed(speed);
    setShowSpeedMenu(false);
  };

  // ── Derived display values ─────────────────────────────
  const totalTime    = state.info ? state.info.duration : 0;
  const elapsedTime  = state.elapsedTime;
  const currentFrame = Math.round(state.currentFrame);
  const maxValue     = state.info ? state.info.totalFrames - 1 : 100;

  const formatTime = (s: number) => s.toFixed(1);

  return (
    <div className="relative h-16 px-4 flex items-center gap-4 bg-neutral-900 border-t border-neutral-800">

      {/* ── Shortcuts panel ─────────────────────────────── */}
      {showShortcuts && (
        <div
          ref={shortcutsPanelRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50
                     rounded-xl bg-neutral-900 border border-neutral-700/70
                     shadow-2xl px-5 py-4"
        >
          <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-600 mb-3">
            Keyboard Shortcuts
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            {[
              ["Space",  "Play / Pause"],
              ["Ctrl +", "Zoom in"],
              ["Ctrl −", "Zoom out"],
              ["Ctrl 0", "Reset zoom"],
              ["RMB",    "Scale mode menu"],
              ["Drag",   "Pan (original mode)"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-2.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-neutral-800 border border-neutral-700
                               text-neutral-200 font-mono text-[11px] shadow-sm shrink-0 min-w-[48px] text-center">
                  {key}
                </kbd>
                <span className="text-xs text-neutral-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Play / Pause ─────────────────────────────────── */}
      <button
        onClick={actions.togglePlayPause}
        className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600
                   flex items-center justify-center transition-colors text-white shrink-0"
        title={state.isPlaying ? "Pause" : "Play"}
        disabled={!state.info}
      >
        {state.isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="shrink-0" aria-hidden>
            <rect x="4" y="3" width="3" height="10" rx="0.5" />
            <rect x="9" y="3" width="3" height="10" rx="0.5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 ml-0.5" aria-hidden>
            <path d="M5 3v10l8-5-8-5z" />
          </svg>
        )}
      </button>

      {/* ── Timecode ─────────────────────────────────────── */}
      <div className="shrink-0 select-none font-mono tabular-nums" style={{ minWidth: 90 }}>
        <div className="flex items-baseline gap-1 leading-none">
          <span className="text-[15px] font-semibold text-neutral-100 tracking-tight">
            {formatTime(elapsedTime)}
          </span>
          <span className="text-[12px] font-medium text-neutral-500">s</span>
          <span className="text-[11px] text-neutral-700 mx-0.5">/</span>
          <span className="text-[11px] text-neutral-500">
            {formatTime(totalTime)}s
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-600">
            f{String(currentFrame).padStart(3, "0")}
          </span>
          <span className="w-px h-2.5 bg-neutral-800 rounded-full" />
          <span className="text-[10px] text-neutral-700">
            {state.info ? state.info.totalFrames : 0}fr
          </span>
        </div>
      </div>

      {/* ── Timeline with hover tooltip ──────────────────── */}
      <div
        ref={tlWrapRef}
        className="relative flex-1"
        onMouseMove={handleTlMove}
        onMouseLeave={handleTlLeave}
      >
        <input
          ref={timelineRef}
          type="range"
          className="timeline-input"
          min={0}
          max={maxValue}
          value={state.currentFrame}
          onChange={handleTimelineChange}
          onMouseDown={() => {}}
          onMouseUp={() => {}}
          disabled={!state.info}
          style={{ opacity: state.info ? 1 : 0.4 }}
        />

        {/* Tooltip */}
        <div
          className="absolute bottom-7 -translate-x-1/2 pointer-events-none
                     px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700/80
                     text-[10px] text-neutral-200 font-mono shadow-xl whitespace-nowrap
                     transition-opacity duration-100"
          style={{
            left: tooltip.left,
            opacity: tooltip.visible && state.info ? 1 : 0,
          }}
        >
          {tooltip.text}
        </div>
      </div>

      {/* ── Speed ─────────────────────────────────────────── */}
      <div className="relative shrink-0" ref={speedMenuRef}>
        <button
          onClick={() => setShowSpeedMenu((v) => !v)}
          className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
          disabled={!state.info}
          style={{ opacity: state.info ? 1 : 0.4 }}
        >
          <span>×{state.speed}</span>
          <svg className="w-2.5 h-2.5 text-neutral-500 shrink-0" viewBox="0 0 10 7" fill="none"
               stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 1 5 5 9 1" />
          </svg>
        </button>

        {showSpeedMenu && state.info && (
          <div className="absolute bottom-full right-0 mb-2 bg-neutral-900 border border-neutral-700/70
                          rounded-xl shadow-2xl py-1.5 min-w-[90px] z-50 overflow-hidden">
            <div className="px-3 pb-1 text-[10px] text-neutral-600 uppercase tracking-wider">Speed</div>
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedSelect(speed)}
                className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                  state.speed === speed
                    ? "bg-neutral-800 text-white font-medium"
                    : "hover:bg-neutral-800 text-neutral-400"
                }`}
              >
                ×{speed}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Export MP4 ───────────────────────────────────── */}
      <button
        onClick={onExport}
        disabled={!hasFile}
        className="w-7 h-7 rounded flex items-center justify-center shrink-0
                   transition-colors bg-neutral-800 hover:bg-neutral-700
                   text-neutral-500 hover:text-neutral-300
                   disabled:opacity-30 disabled:pointer-events-none"
        title="Export MP4"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
             stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M5 7l3 3 3-3"/>
          <path d="M3 12h10"/>
        </svg>
      </button>

      {/* ── Shortcuts hint ────────────────────────────────── */}
      <button
        ref={shortcutsBtnRef}
        onClick={() => setShowShortcuts((v) => !v)}
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
                    transition-colors text-[11px] font-semibold ${
                      showShortcuts
                        ? "bg-neutral-700 text-neutral-200"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-500 hover:text-neutral-300"
                    }`}
        title="Keyboard shortcuts"
      >
        ?
      </button>

      {/* ── Sidebar toggle ────────────────────────────────── */}
      <button
        className={[
          "w-8 h-8 flex items-center justify-center rounded transition-colors shrink-0",
          sidebarOpen
            ? "bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/30"
            : "bg-neutral-800 hover:bg-neutral-700",
        ].join(" ")}
        title="Files"
        onClick={onToggleSidebar}
      >
        <svg
          className={`w-[18px] h-[18px] ${sidebarOpen ? "text-emerald-300" : "text-neutral-400"}`}
          viewBox="0 0 18 18" fill="none"
          stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <rect x="1.5" y="1.5" width="15" height="15" rx="2" />
          <line x1="12" y1="1.5" x2="12" y2="16.5" />
        </svg>
      </button>
    </div>
  );
}
