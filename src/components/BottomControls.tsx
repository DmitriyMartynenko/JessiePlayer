export default function BottomControls() {
  return (
    <div className="h-16 px-4 flex items-center gap-4 bg-neutral-900 border-t border-neutral-800">
      {/* Play */}
      <button className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center">
        ▶
      </button>

      {/* Current time */}
      <div className="text-xs text-neutral-400 w-12 text-right">0.0 s</div>

      {/* Timeline */}
      <input
        type="range"
        className="flex-1 h-1 accent-slate-400"
        min={0}
        max={100}
      />

      {/* Duration */}
      <div className="text-xs text-neutral-400 w-12">0.0 s</div>

      {/* Speed */}
      <button className="px-2 py-1 text-xs bg-neutral-800 rounded">
        x1
      </button>

      {/* Menu */}
      <button
        className="w-8 h-8 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700"
        title="Menu"
      >
        ☰
      </button>
    </div>
  );
}
