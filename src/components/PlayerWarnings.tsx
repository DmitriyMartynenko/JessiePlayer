import { PlayerWarning } from "../players/PlayerContract";

type Props = {
  warnings: PlayerWarning[];
};

export function PlayerWarnings({ warnings }: Props) {
  if (warnings.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 max-w-md rounded bg-yellow-900/90 p-4 text-xs text-yellow-200 shadow-lg">
      <div className="mb-2 font-semibold text-yellow-100">
        Попередження
      </div>

      <ul className="space-y-2">
        {warnings.map((w, i) => (
          <li key={i}>
            <div className="font-medium">{w.message}</div>

            {w.details && (
              <div className="mt-1 text-[11px] opacity-70">
                {w.details}
              </div>
            )}

            <div className="mt-1 text-[10px] opacity-50">
              code: {w.code}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
