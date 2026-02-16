// BottomControls.tsx
// ==================================================
// Animation control panel with playback, timeline, and speed control
// ==================================================

import { useState, useRef, useEffect } from "react";
import { AnimationState, useAnimationControls, SpeedOption } from "../hooks/useAnimationControls";

type Props = {
  state: AnimationState;
  actions: ReturnType<typeof useAnimationControls>["actions"];
  speedOptions: readonly SpeedOption[];
};

export default function BottomControls({ state, actions, speedOptions }: Props) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────
  // Close speed menu on outside click
  // ─────────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(event.target as Node)
      ) {
        setShowSpeedMenu(false);
      }
    };

    if (showSpeedMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showSpeedMenu]);

  // ─────────────────────────────────────────────
  // Timeline progress calculation
  // ─────────────────────────────────────────────

  const progress =
    state.info && state.info.totalFrames > 0
      ? state.currentFrame / (state.info.totalFrames - 1)
      : 0;

  const maxValue = state.info ? state.info.totalFrames - 1 : 100;

  // ─────────────────────────────────────────────
  // Format time display
  // ─────────────────────────────────────────────

  const formatTime = (seconds: number): string => {
    return seconds.toFixed(1);
  };

  // ─────────────────────────────────────────────
  // Timeline handlers
  // ─────────────────────────────────────────────

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (state.info) {
      actions.seekToFrame(value);
    }
  };

  const handleTimelineMouseDown = () => {
    setIsDraggingTimeline(true);
  };

  const handleTimelineMouseUp = () => {
    setIsDraggingTimeline(false);
  };

  // ─────────────────────────────────────────────
  // Speed menu handlers
  // ─────────────────────────────────────────────

  const handleSpeedSelect = (speed: SpeedOption) => {
    actions.setSpeed(speed);
    setShowSpeedMenu(false);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  const totalTime = state.info ? state.info.duration : 0;
  const elapsedTime = state.elapsedTime;
  const currentFrame = Math.round(state.currentFrame);

  return (
    <div className="h-16 px-4 flex items-center gap-4 bg-neutral-900 border-t border-neutral-800">
      {/* Play/Pause Button */}
      <button
        onClick={actions.togglePlayPause}
        className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center transition-colors"
        title={state.isPlaying ? "Pause" : "Play"}
        disabled={!state.info}
      >
        {state.isPlaying ? (
          <span className="text-xs">⏸</span>
        ) : (
          <span className="text-xs ml-0.5">▶</span>
        )}
      </button>

      {/* Current Time / Total Time */}
      <div className="text-xs text-neutral-400 w-20 text-right tabular-nums">
        {state.info ? (
          <>
            {formatTime(elapsedTime)}s / {formatTime(totalTime)}s
          </>
        ) : (
          "0.0s / 0.0s"
        )}
      </div>

      {/* Timeline */}
      <input
        ref={timelineRef}
        type="range"
        className="flex-1 h-1 accent-slate-400 cursor-pointer"
        min={0}
        max={maxValue}
        value={state.currentFrame}
        onChange={handleTimelineChange}
        onMouseDown={handleTimelineMouseDown}
        onMouseUp={handleTimelineMouseUp}
        disabled={!state.info}
        style={{
          opacity: state.info ? 1 : 0.5,
        }}
      />

      {/* Current Frame */}
      <div className="text-xs text-neutral-400 w-16 tabular-nums">
        {state.info ? `Frame ${currentFrame}` : "Frame 0"}
      </div>

      {/* Speed Control */}
      <div className="relative" ref={speedMenuRef}>
        <button
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
          disabled={!state.info}
          style={{
            opacity: state.info ? 1 : 0.5,
          }}
        >
          ×{state.speed}
        </button>

        {/* Speed Menu */}
        {showSpeedMenu && state.info && (
          <div className="absolute bottom-full right-0 mb-2 bg-neutral-800 rounded shadow-lg border border-neutral-700 py-1 min-w-[80px] z-50">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedSelect(speed)}
                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-neutral-700 transition-colors ${
                  state.speed === speed ? "bg-neutral-700 font-semibold" : ""
                }`}
              >
                ×{speed}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu Button (placeholder for future implementation) */}
      <button
        className="w-8 h-8 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
        title="Menu"
        disabled
        style={{
          opacity: 0.5,
          cursor: "not-allowed",
        }}
      >
        <span className="text-xs">☰</span>
      </button>
    </div>
  );
}
