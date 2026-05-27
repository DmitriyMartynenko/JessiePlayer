# Jessie Player — CLAUDE.md

Electron + React desktop app that plays Lottie animations (`.json`, `.lottie`) and WebM video files. Personal/portfolio project by Dmytro Martynenko.

## Stack

- **Electron 30** (main process in `electron/main.cjs`, preload in `electron/preload.cjs`)
- **React 18 + TypeScript 5 + Vite 5**
- **Tailwind 4**, **Zustand 5**, **lottie-web**, **JSZip**

## Architecture

```
electron/main.cjs         IPC handlers, file reading, settings (userData/settings.json)
electron/preload.cjs      contextBridge → window.api (only way renderer touches Electron)

src/App.tsx               → WindowLayout (root)
src/components/
  WindowLayout.tsx        File state (single source of truth), IPC listeners, spacebar hotkey
  TopBar.tsx              Logo menu, BG/Log toggles, path display, window controls
  Stage.tsx               Player viewport + overlays (error, warning, zoom, info panel)
  StageLogic.ts           useStageLogic hook — player routing, zoom/pan, diagnostics, drag-drop
  BottomControls.tsx      Play/pause, timeline scrubber, speed selector, sidebar toggle
  SidebarDrawer.tsx       File browser overlay (right edge), directory navigation
  StageContextMenu.tsx    Right-click scale-mode menu
  PlayerWarnings.tsx      Yellow warning overlay inside Stage
  ui/AnimationInfoPanel.tsx  Bilingual (EN/UA) diagnostics panel overlay

src/players/
  PlayerContract.ts       Canonical interfaces: LoadedFile, PlayerStatus, AnimationControls, PlayerProps
  JsonPlayer/             lottie-web on .json text
  LottiePlayer/           JSZip unzip → lottie-web; resolves embedded images as data URLs
  WebmPlayer/             Blob URL → <video>; 30 fps assumed (HTML5 API limitation)
  FallbackPlayer/         Shows file info for unsupported extensions

src/hooks/
  useAnimationControls.ts Bridges AnimationControls (from players) ↔ BottomControls state

src/store/
  uiStore.ts              Zustand: sidebarOpen, isFullScreen, scaleMode ("fit"|"original"), hydrated

src/core/analyzers/
  animationAnalyzer.ts    Async unified analyzer (routes to Lottie or WebM); exports AnimationDiagnostics
  jsonAnalyzer.ts         Deep Lottie JSON analysis (layers, expressions, images)
```

## Rules for working in this codebase

- **PlayerContract is the contract** — before touching any player, read `src/players/PlayerContract.ts`. All players must implement `PlayerProps` and call `onControlsReady(controls)`.
- **File state lives only in WindowLayout** — `file: LoadedFile | null` is the single source of truth. Files arrive only via IPC (`app:file-changed`).
- **IPC is the boundary** — renderer never imports `fs`, `path`, or Electron APIs directly. All system calls go through `window.api`.
- **uiStore for UI flags only** — `sidebarOpen`, `isFullScreen`, `scaleMode`. Nothing else belongs in Zustand.
- **Settings persistence** — Electron main owns `userData/settings.json`. Renderer reads/writes it via `window.api.readSettings()` / `window.api.writeSettings(patch)`.

## Known issues (do not re-introduce workarounds for these)

1. **Disconnected stub files** — `Layout.tsx`, `Sidebar.tsx`, `PlayerArea.tsx`, `Controls.tsx` are an unfinished redesign skeleton. `App.tsx` still imports `WindowLayout`. The stubs do nothing at runtime.
2. **Duplicate `AnimationDiagnostics` type** — `jsonAnalyzer.ts` has a Lottie-only version; `animationAnalyzer.ts` has a superset version with `format`. They are different shapes.
3. **Dead state in StageLogic** — `background` state is always `"transparent"` (never mutated). `isDragging`/`lastMouse` refs in StageLogic are unused (Stage.tsx has its own).
4. **`DirectoryEntry` defined twice** — once globally in `global.d.ts`, once locally in `SidebarDrawer.tsx`.
5. **WebM FPS hardcoded to 30** — HTML5 video API doesn't expose actual frame rate. Intentional limitation.
6. **Debug logs in preload.cjs** — `console.log` on every window button click. Left from development.

## Dev commands

```bash
npm run electron:dev    # Vite dev server + Electron (hot reload)
npm run dist:win        # Build Windows NSIS installer
npm run dist:mac        # Build macOS DMG
```
