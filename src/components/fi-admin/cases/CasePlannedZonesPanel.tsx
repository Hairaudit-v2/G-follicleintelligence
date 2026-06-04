"use client";

import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";

export function CasePlannedZonesPanel({
  zones,
  onChange,
}: {
  zones: PlannedZoneRow[];
  onChange: (next: PlannedZoneRow[]) => void;
}) {
  function updateAt(index: number, patch: Partial<PlannedZoneRow>) {
    const next = zones.map((z, i) => (i === index ? { ...z, ...patch } : z));
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-800">Planned zones</h3>
        <button
          type="button"
          onClick={() => onChange([...zones, { key: `zone_${zones.length + 1}`, label: "" }])}
          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          Add zone
        </button>
      </div>
      <p className="text-xs text-gray-500">Recipient-area keys (e.g. hairline, midscalp, crown). Labels are optional.</p>
      {zones.length === 0 ? (
        <p className="text-xs text-gray-400">No zones yet.</p>
      ) : (
        <ul className="space-y-2">
          {zones.map((z, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2 rounded border border-gray-100 bg-gray-50/80 p-2">
              <label className="text-xs text-gray-600">
                Key
                <input
                  value={z.key}
                  onChange={(e) => updateAt(i, { key: e.target.value })}
                  className="mt-0.5 block w-36 rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="hairline"
                />
              </label>
              <label className="min-w-[8rem] flex-1 text-xs text-gray-600">
                Label
                <input
                  value={z.label ?? ""}
                  onChange={(e) => updateAt(i, { label: e.target.value || null })}
                  className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="Optional display name"
                />
              </label>
              <button
                type="button"
                onClick={() => onChange(zones.filter((_, j) => j !== i))}
                className="text-xs text-rose-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
