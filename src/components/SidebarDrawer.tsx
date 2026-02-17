import { useEffect, useMemo, useRef, useState } from "react";
import type { LoadedFile } from "../players/PlayerContract";
import { useUiStore } from "../store/uiStore";

export const SIDEBAR_DRAWER_WIDTH = 320;
const TOP_BAR_HEIGHT_PX = 40; // TopBar uses h-10
const BOTTOM_BAR_HEIGHT_PX = 64; // BottomControls uses h-16

type DirectoryEntry =
  | { kind: "dir"; name: string; path: string }
  | { kind: "file"; name: string; path: string; extension: string };

function getDirectoryFromPath(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastSep < 0) return "";
  return filePath.slice(0, lastSep);
}

export default function SidebarDrawer({ file }: { file: LoadedFile | null }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const close = useUiStore((s) => s.actions.setSidebarOpen);

  const [currentDir, setCurrentDir] = useState<string>("");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePath = file?.path ?? "";
  const activeDir = useMemo(() => (activePath ? getDirectoryFromPath(activePath) : ""), [activePath]);

  const requestIdRef = useRef(0);

  // Keep directory synced to opened file
  useEffect(() => {
    if (activeDir) setCurrentDir(activeDir);
  }, [activeDir]);

  // Load directory listing when open or directory changes
  useEffect(() => {
    if (!sidebarOpen) return;
    if (!currentDir) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    const myId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(async () => {
        const list = await window.api.getDirectoryFiles(currentDir);
        if (cancelled) return;
        if (requestIdRef.current !== myId) return;
        setEntries(list as DirectoryEntry[]);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to read directory");
        setEntries([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sidebarOpen, currentDir]);

  const goUp = async () => {
    if (!currentDir) return;
    const parent = await window.api.getParentDirectory(currentDir);
    if (parent) setCurrentDir(parent);
  };

  const openEntry = async (entry: DirectoryEntry) => {
    if (entry.kind === "dir") {
      setCurrentDir(entry.path);
      return;
    }

    // Prefer invoke-based IPC alias if present
    if (window.api.openFileIPC) {
      await window.api.openFileIPC(entry.path);
      return;
    }
    window.api.openFileByPath(entry.path);
  };

  return (
    <div
      className={[
        "absolute left-0 right-0 z-50 transition-opacity duration-200",
        sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      ].join(" ")}
      style={{
        top: TOP_BAR_HEIGHT_PX,
        bottom: BOTTOM_BAR_HEIGHT_PX,
      }}
    >
      {/* Backdrop (outside click closes) */}
      <div
        className="absolute inset-0 bg-black/20"
        onMouseDown={() => close(false)}
      />

      {/* Drawer */}
      <aside
        className={[
          "absolute right-0 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col",
          "transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{
          width: SIDEBAR_DRAWER_WIDTH,
          top: 0,
          bottom: 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header / path */}
        <div className="h-10 px-3 flex items-center gap-2 border-b border-neutral-800">
          <button
            className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded"
            onClick={goUp}
            disabled={!currentDir}
            title="Up one level"
          >
            ..
          </button>
          <div className="text-xs text-neutral-400 truncate min-w-0 flex-1">
            {currentDir || "No file opened"}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-neutral-500">Loading…</div>
          )}
          {error && (
            <div className="px-3 py-2 text-xs text-red-300">{error}</div>
          )}

          {!loading && !error && (
            <ul className="py-1">
              {entries.map((e) => {
                const isActive = e.kind === "file" && e.path === activePath;
                return (
                  <li key={`${e.kind}:${e.path}`}>
                    <button
                      className={[
                        "w-full px-3 py-2 text-left text-sm",
                        "hover:bg-neutral-800 transition-colors",
                        "flex items-center gap-2",
                        isActive ? "bg-emerald-600/20 text-emerald-200" : "text-neutral-200",
                      ].join(" ")}
                      onClick={() => openEntry(e)}
                      title={e.path}
                    >
                      <span className="text-xs opacity-70 w-8 shrink-0 flex items-center justify-start">
                        {e.kind === "dir" ? "📁" : (e.extension || "FILE").toUpperCase()}
                      </span>
                      <span className="truncate min-w-0 flex-1">{e.name}</span>
                    </button>
                  </li>
                );
              })}
              {entries.length === 0 && currentDir && (
                <li className="px-3 py-2 text-xs text-neutral-500">
                  No supported files here.
                </li>
              )}
              {!currentDir && (
                <li className="px-3 py-2 text-xs text-neutral-500">
                  Open a file to show its directory.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Donate (inactive) */}
        <div className="p-3 border-t border-neutral-800">
          <button
            className="w-full py-2 rounded bg-amber-600/40 text-amber-100 border border-amber-500/40 cursor-not-allowed opacity-70"
            disabled
            title="Donate (coming soon)"
          >
            Donate
          </button>
        </div>
      </aside>
    </div>
  );
}

