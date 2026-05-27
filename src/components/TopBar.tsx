import { useState, useRef, useEffect } from "react";
import { LoadedFile } from "../players/PlayerContract";
import { useUiStore } from "../store/uiStore";
import iconUrl from "../images/icon.png";

const LINKEDIN_URL = "https://www.linkedin.com/in/dmytromartynenko/";
const GITHUB_URL   = "https://github.com/DmitriyMartynenko";
const APP_VERSION  = "1.0.0";

const SWATCHES = [
  { label: "Black",        color: "#000000" },
  { label: "Dark",         color: "#1c1c1c" },
  { label: "Grey",         color: "#808080" },
  { label: "White",        color: "#ffffff" },
  { label: "Green screen", color: "#00b140" },
  { label: "Blue screen",  color: "#0047ab" },
];

type LogLanguage = "en" | "ua";

type Props = {
  windowState: "normal" | "maximized";
  file: LoadedFile | null;
  showInfo: boolean;
  logLanguage: LogLanguage;
  backgroundColor: string;
  backgroundOpacity: number;
  onBgChange: (color: string, opacity: number) => void;
  onBgPreview: (preview: { color?: string; opacity?: number } | null) => void;
  onToggleInfo: () => void;
  onToggleInfoLanguage: () => void;
};

// ── Helpers ───────────────────────────────────────────────
function isValidHex(h: string) { return /^#[0-9a-fA-F]{6}$/.test(h); }

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16)||0, g: parseInt(h.slice(2,4),16)||0, b: parseInt(h.slice(4,6),16)||0 };
}
function rgbToHex(r: number, g: number, b: number) {
  return `#${[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,"0")).join("")}`;
}
function hexToRgba(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${opacity})`;
}
function getPathParts(file: LoadedFile) {
  const path = file.path ?? "";
  if (!path) return { dir: "", name: file.name };
  const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSep < 0 ? { dir: "", name: file.name } : { dir: path.slice(0, lastSep+1), name: file.name };
}

function AeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-[0.1em] font-sans select-none" style={{ color: "#4a4a4a" }}>
      {children}
    </span>
  );
}

function RgbInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => { const n = parseInt(local,10); if (!isNaN(n)) onChange(Math.max(0,Math.min(255,n))); else setLocal(String(value)); };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <input type="text" maxLength={3} value={local}
        onChange={e => setLocal(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key==="Enter") commit(); }}
        className="w-9 text-center font-mono text-[11px] rounded-sm outline-none border focus:border-[#555] transition-colors"
        style={{ background:"#1c1c1c", border:"1px solid #2e2e2e", color:"#bbb", padding:"2px 0" }}
      />
      <AeLabel>{label}</AeLabel>
    </div>
  );
}

// ── JP Logo icon ──────────────────────────────────────────
function JpIcon({ size = 20 }: { size?: number }) {
  return (
    <img src={iconUrl} width={size} height={size} alt="Jessie Player" aria-hidden style={{ borderRadius: '25%' }} />
  );
}

// ─────────────────────────────────────────────────────────
export default function TopBar({
  windowState, file, showInfo, logLanguage,
  backgroundColor, backgroundOpacity,
  onBgChange, onBgPreview,
  onToggleInfo, onToggleInfoLanguage,
}: Props) {
  const isMaximized  = windowState === "maximized";
  const pathParts    = file ? getPathParts(file) : null;
  const scaleMode    = useUiStore((s) => s.scaleMode);
  const setScaleMode = useUiStore((s) => s.actions.setScaleMode);

  // ── About popover ─────────────────────────────────────
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aboutOpen) return;
    const h = (e: MouseEvent) => {
      if (aboutRef.current && !aboutRef.current.contains(e.target as Node)) setAboutOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aboutOpen]);

  // ── BG popover ────────────────────────────────────────
  const [bgOpen, setBgOpen]           = useState(false);
  const [localOpacity, setLocalOpacity] = useState(Math.round(backgroundOpacity * 100));
  const [hexInput, setHexInput]       = useState(backgroundColor);
  const [hexError, setHexError]       = useState(false);
  const bgRef      = useRef<HTMLDivElement>(null);
  const colorPicker = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalOpacity(Math.round(backgroundOpacity * 100)); }, [backgroundOpacity]);
  useEffect(() => { setHexInput(backgroundColor); }, [backgroundColor]);

  useEffect(() => {
    if (!bgOpen) return;
    const h = (e: MouseEvent) => {
      if (bgRef.current && !bgRef.current.contains(e.target as Node)) {
        setBgOpen(false); onBgPreview(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [bgOpen]);

  // ── Mode toggle — sliding pill ────────────────────────
  const toggleRef = useRef<HTMLDivElement>(null);
  const fitRef    = useRef<HTMLButtonElement>(null);
  const compRef   = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState({ left: 2, width: 28 });

  useEffect(() => {
    const container = toggleRef.current;
    const activeBtn = (scaleMode === "compose" ? compRef : fitRef).current;
    if (!container || !activeBtn) return;
    const cr = container.getBoundingClientRect();
    const br = activeBtn.getBoundingClientRect();
    setPill({ left: br.left - cr.left, width: br.width });
  }, [scaleMode]);

  const { r, g, b } = hexToRgb(backgroundColor);

  const applyHex = (raw: string) => {
    const h = raw.startsWith("#") ? raw : `#${raw}`;
    if (isValidHex(h)) { setHexError(false); setHexInput(h); onBgChange(h, localOpacity/100); }
    else setHexError(true);
  };
  const applyRgb = (nr: number, ng: number, nb: number) => {
    const hex = rgbToHex(nr, ng, nb);
    setHexInput(hex); setHexError(false); onBgChange(hex, localOpacity/100);
  };

  const logLabel   = logLanguage === "en" ? "Log" : "Лог";
  const logTooltip = logLanguage === "en" ? "Show animation technical information" : "Показати технічну інформацію анімації";
  const openExternal = (url: string) => window.api?.openExternalUrl?.(url);

  return (
    <div className={`relative h-10 flex items-center justify-between px-3 bg-neutral-900 border-b border-neutral-800 select-none ${!isMaximized ? "app-region-drag" : ""}`}>

      {/* ── Left: JP About + BG + Log ──────────────────── */}
      <div className="flex items-center gap-3 text-sm app-region-no-drag">

        {/* JP About */}
        <div className="relative" ref={aboutRef}>
          <button
            onClick={() => setAboutOpen(v => !v)}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              aboutOpen ? "bg-emerald-600/30 border border-emerald-500/30" : "hover:bg-neutral-800"
            }`}
            title="About Jessie Player"
          >
            <JpIcon />
          </button>

          {aboutOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden shadow-2xl"
                 style={{ width: 220, background: "#161616", border: "1px solid #2a2a2a" }}>

              {/* Identity */}
              <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: "#1c1c1c", border: "1px solid #2a2a2a" }}>
                    <JpIcon size={24} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-200">Jessie Player</div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: "#444" }}>v {APP_VERSION}</div>
                  </div>
                </div>
                <div className="text-[11px] mt-2.5" style={{ color: "#555" }}>
                  Animation viewer for Lottie, JSON&nbsp;and WebM files.
                </div>
              </div>

              {/* Developer */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <AeLabel>Developer</AeLabel>
                <div className="text-[12px] text-neutral-400 mt-1.5">Dmytro Martynenko</div>
              </div>

              {/* Links */}
              <div className="px-3 py-2 flex flex-col gap-0.5">
                {[
                  { label: "LinkedIn", icon: <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: "#0a66c2", color: "#fff" }}>in</span>, url: LINKEDIN_URL },
                  { label: "GitHub",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#777" className="shrink-0"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>, url: GITHUB_URL },
                ].map(({ label, icon, url }) => (
                  <button key={label} onClick={() => openExternal(url)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors hover:bg-neutral-800"
                    style={{ color: "#777" }}>
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BG popover */}
        <div className="relative" ref={bgRef}>
          <button
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
              bgOpen ? "bg-emerald-600/30 border border-emerald-500/30 text-emerald-200"
                     : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
            }`}
            onClick={() => setBgOpen(v => !v)}
            title="Background color and opacity"
          >
            <span className="text-neutral-400">BG</span>
            <span className="w-3.5 h-3.5 rounded-sm border border-neutral-600 shrink-0"
                  style={{ backgroundColor: backgroundOpacity === 0 ? "transparent" : hexToRgba(backgroundColor, 1) }} />
          </button>

          {bgOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 rounded overflow-hidden shadow-2xl"
                 style={{ width: 244, background: "#161616", border: "1px solid #2a2a2a" }}>
              <div className="flex items-center px-3 py-2" style={{ borderBottom: "1px solid #222" }}>
                <AeLabel>Background</AeLabel>
              </div>
              <div className="px-3 py-2.5">
                <AeLabel>Presets</AeLabel>
                <div className="flex items-center gap-1.5 mt-2">
                  {SWATCHES.map(s => (
                    <button key={s.color} title={s.label}
                      className="transition-transform hover:scale-110 shrink-0"
                      style={{ width:22, height:22, backgroundColor:s.color, border: backgroundColor===s.color ? "2px solid #34d399" : "1px solid #3a3a3a", borderRadius:2 }}
                      onMouseEnter={() => onBgPreview({ color: s.color })}
                      onMouseLeave={() => onBgPreview(null)}
                      onClick={() => { setHexInput(s.color); setHexError(false); onBgChange(s.color, localOpacity/100); }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid #222" }} />
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <AeLabel>Opacity</AeLabel>
                  <span className="font-mono text-[11px]" style={{ color: "#999" }}>{localOpacity}%</span>
                </div>
                <input type="range" min={0} max={100} value={localOpacity}
                  className="timeline-input w-full"
                  style={{ "--fill": `${localOpacity}%` } as React.CSSProperties}
                  onInput={e => { const v=parseInt((e.target as HTMLInputElement).value); setLocalOpacity(v); onBgPreview({ opacity: v/100 }); }}
                  onMouseUp={() => onBgChange(backgroundColor, localOpacity/100)}
                />
              </div>
              <div style={{ borderTop: "1px solid #222" }} />
              <div className="px-3 py-2.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <AeLabel>Hex</AeLabel>
                  <div className="flex items-center flex-1 px-2 rounded-sm transition-colors"
                       style={{ background:"#1c1c1c", border: hexError?"1px solid #8b1a1a":"1px solid #2e2e2e", height:24 }}>
                    <span className="font-mono text-[11px] mr-0.5" style={{ color:"#444" }}>#</span>
                    <input type="text" maxLength={7} placeholder="000000"
                      className="bg-transparent font-mono text-[11px] outline-none w-full" style={{ color:"#bbb" }}
                      value={hexInput.replace("#","")}
                      onChange={e => { setHexInput(`#${e.target.value}`); setHexError(false); }}
                      onKeyDown={e => { if (e.key==="Enter") applyHex(hexInput); }}
                      onBlur={() => applyHex(hexInput)}
                    />
                  </div>
                  <button title="Open color picker" onClick={() => colorPicker.current?.click()}
                    className="flex items-center justify-center rounded-sm shrink-0"
                    style={{ width:24, height:24, background:"#1c1c1c", border:"1px solid #2e2e2e", color:"#555" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="#999")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="#555")}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
                    </svg>
                  </button>
                  <input ref={colorPicker} type="color" value={backgroundColor} className="sr-only"
                    onChange={e => { const c=e.target.value; setHexInput(c); setHexError(false); onBgChange(c, localOpacity/100); }} />
                </div>
                <div className="flex items-center gap-2">
                  <AeLabel>RGB</AeLabel>
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <RgbInput label="R" value={r} onChange={v => applyRgb(v,g,b)} />
                    <RgbInput label="G" value={g} onChange={v => applyRgb(r,v,b)} />
                    <RgbInput label="B" value={b} onChange={v => applyRgb(r,g,v)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Log */}
        <button
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
            showInfo ? "bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-200"
                     : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
          }`}
          onClick={onToggleInfo}
          onContextMenu={e => { e.preventDefault(); onToggleInfoLanguage(); }}
          title={logTooltip}>
          <span>{logLabel}</span>
          <span className="px-1 py-px text-[9px] leading-tight rounded bg-neutral-700 border border-neutral-600 text-neutral-400 font-mono">
            {logLanguage.toUpperCase()}
          </span>
        </button>
      </div>

      {/* ── Center: file path ─────────────────────────── */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center text-sm text-neutral-400 max-w-[50vw] min-w-0">
        {pathParts ? (
          <><span className="truncate">{pathParts.dir}</span><span className="font-semibold text-neutral-300 shrink-0">{pathParts.name}</span></>
        ) : "Waiting for file…"}
      </div>

      {/* ── Right: Fit|Compose toggle + window controls ── */}
      <div className="flex items-center gap-3 app-region-no-drag">

        {/* Sliding toggle */}
        <div ref={toggleRef} className="relative flex items-center rounded-md"
             style={{ background:"#1c1c1c", border:"1px solid #2e2e2e", padding:"2px", gap:0 }}>
          {/* Pill */}
          <div style={{
            position:"absolute", top:2, left:pill.left, width:pill.width,
            height:"calc(100% - 4px)", background:"#2d4a3e",
            border:"1px solid #34d399", borderRadius:4, pointerEvents:"none",
            transition:"left 0.15s ease, width 0.15s ease",
          }} />
          {/* Fit */}
          <button ref={fitRef} onClick={() => setScaleMode("fit")} title="View"
            className="relative z-10 w-7 h-[22px] flex items-center justify-center transition-colors"
            style={{ color: scaleMode !== "compose" ? "#6ee7b7" : "#555" }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/>
            </svg>
          </button>
          {/* Compose */}
          <button ref={compRef} onClick={() => setScaleMode("compose")} title="Creator"
            className="relative z-10 w-7 h-[22px] flex items-center justify-center transition-colors"
            style={{ color: scaleMode === "compose" ? "#6ee7b7" : "#555" }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="8" height="8" rx="1.2"/>
              <rect x="5" y="1" width="8" height="8" rx="1.2"/>
            </svg>
          </button>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-0.5">
          <button className="w-8 h-6 hover:bg-neutral-700 rounded text-neutral-400 transition-colors" onClick={() => window.api?.window?.minimize?.()} onContextMenu={e=>e.preventDefault()}>—</button>
          <button className="w-8 h-6 hover:bg-neutral-700 rounded text-neutral-400 transition-colors" onClick={() => window.api?.window?.maximize?.()} onContextMenu={e=>e.preventDefault()}>{isMaximized?"🗗":"□"}</button>
          <button className="w-8 h-6 hover:bg-red-600 rounded text-neutral-400 transition-colors"    onClick={() => window.api?.window?.close?.()}    onContextMenu={e=>e.preventDefault()}>✕</button>
        </div>
      </div>
    </div>
  );
}
