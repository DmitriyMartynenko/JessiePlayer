import { PlayerProps } from "../PlayerContract";

export function FallbackPlayer({ file, onStatus }: PlayerProps) {
  // Fallback завжди "готовий"
  onStatus?.({ type: "ready" });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-neutral-400">
      <div className="text-3xl">📄</div>

      <div className="font-medium text-neutral-200">
        Файл не є анімацією
      </div>

      <div className="text-xs opacity-70">
        {file.name}
      </div>

      <div className="mt-4 rounded bg-neutral-800 px-4 py-2 text-[11px] text-neutral-400">
        extension: {file.extension}
      </div>
    </div>
  );
}
