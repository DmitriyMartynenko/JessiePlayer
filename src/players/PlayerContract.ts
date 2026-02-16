// PlayerContract.ts
// ==================================================
// ЄДИНИЙ КАНОНІЧНИЙ КОНТРАКТ ДЛЯ ВСІХ PLAYERʼІВ
// Змінюється ТІЛЬКИ з архітектурною причиною
// ==================================================

// ─────────────────────────────────────────────
// FILE MODEL (Electron is source of truth)
// ─────────────────────────────────────────────

export interface LoadedFile {
  id: string
  name: string
  extension: string            // "json" | "lottie" | "webm"
  size: number

  // Content (already loaded by Electron)
  text?: string                // JSON animation
  buffer?: ArrayBuffer         // .lottie (zip), .webm (blob URL in player)
  path?: string                // optional fallback for .webm

  // Optional meta (safe to ignore by players)
  meta?: Record<string, unknown>
}

// ─────────────────────────────────────────────
// PLAYER STATUS (Player → Stage)
// ─────────────────────────────────────────────

export type PlayerStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "ready" }
  | {
      type: "warning"
      warnings: PlayerWarning[]
    }
  | {
      type: "error"
      error: PlayerError
    }

// ─────────────────────────────────────────────
// WARNINGS / ERRORS (UNIFIED)
// ─────────────────────────────────────────────

export interface PlayerWarning {
  code: string                 // MACHINE READABLE
  message: string              // HUMAN READABLE
  details?: string
}

export interface PlayerError {
  code: string
  message: string
  details?: string
  fatal?: boolean              // default = true
}

// ─────────────────────────────────────────────
// ANIMATION CONTROL (Player → Controls)
// ─────────────────────────────────────────────

export interface AnimationInfo {
  totalFrames: number
  frameRate: number
  duration: number // in seconds
}

export interface AnimationControls {
  play: () => void
  pause: () => void
  seek: (frame: number) => void
  setSpeed: (speed: number) => void
  getCurrentFrame: () => number
  getIsPlaying: () => boolean
  getInfo: () => AnimationInfo | null
  onFrameChange?: (frame: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
}

// ─────────────────────────────────────────────
// STAGE → PLAYER PROPS (MANDATORY)
// ─────────────────────────────────────────────

export interface PlayerProps {
  file: LoadedFile

  // Controlled by Stage only
  scaleMode: "fit" | "original"
  scale: number
  background: "transparent" | "black" | "checker"

  // Pan offset (Original mode): content is transformed inside viewport, not the container moved
  panOffset?: { x: number; y: number }

  // Communication back to Stage
  onStatus?: (status: PlayerStatus) => void

  // Animation control registration (optional, for players that support it)
  onControlsReady?: (controls: AnimationControls) => void
}
