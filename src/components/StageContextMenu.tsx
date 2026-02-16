type ScaleMode = "fit" | "original";

type Props = {
  x: number;
  y: number;
  scaleMode: ScaleMode;
  onSelect: (mode: ScaleMode) => void;
  onClose: () => void;
};

export default function StageContextMenu({
  x,
  y,
  scaleMode,
  onSelect,
  onClose,
}: Props) {
  return (
    <div
 	className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded shadow-lg text-sm select-none"
 	style={{ top: y, left: x }}
  	onContextMenu={(e) => e.preventDefault()}
  	onMouseLeave={onClose}
      >

      <div className="px-3 py-1 text-neutral-400 text-xs">
        Scale Mode
      </div>

      <div
        className="px-3 py-2 hover:bg-neutral-800 cursor-pointer flex gap-2"
        onClick={() => onSelect("fit")}
      >
        <span className="w-4">
          {scaleMode === "fit" ? "✓" : ""}
        </span>
        Fit to Window
      </div>

      <div
        className="px-3 py-2 hover:bg-neutral-800 cursor-pointer flex gap-2"
        onClick={() => onSelect("original")}
      >
        <span className="w-4">
          {scaleMode === "original" ? "✓" : ""}
        </span>
        Original Size
      </div>
    </div>
  );
}
