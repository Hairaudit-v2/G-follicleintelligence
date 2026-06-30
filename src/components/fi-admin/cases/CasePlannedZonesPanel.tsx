"use client";

import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";

import { caseFormField } from "./caseFormFieldProps";

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
        <h3 className="text-xs font-semibold text-slate-200">Planned zones</h3>
        <button
          type="button"
          onClick={() => onChange([...zones, { key: `zone_${zones.length + 1}`, label: "" }])}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/[0.03]"
        >
          Add zone
        </button>
      </div>
      <p className="text-xs text-gray-500">Recipient-area keys (e.g. hairline, midscalp, crown). Labels are optional.</p>
      {zones.length === 0 ? (
        <p className="text-xs text-gray-400">No zones yet.</p>
      ) : (
        <ul className="space-y-2">
          {zones.map((z, i) => {
            const keyField = caseFormField(`planned-zone-${i}-key`);
            const labelField = caseFormField(`planned-zone-${i}-label`);
            return (
            <li key={i} className="flex flex-wrap items-end gap-2 rounded border border-white/[0.06] bg-white/[0.03] p-2">
              <label htmlFor={keyField.id} className="text-xs text-slate-400">
                Key
                <input
                  {...keyField}
                  value={z.key}
                  onChange={(e) => updateAt(i, { key: e.target.value })}
                  className="mt-0.5 block w-36 rounded border border-slate-700 px-2 py-1 text-sm"
                  placeholder="hairline"
                />
              </label>
              <label htmlFor={labelField.id} className="min-w-[8rem] flex-1 text-xs text-slate-400">
                Label
                <input
                  {...labelField}
                  value={z.label ?? ""}
                  onChange={(e) => updateAt(i, { label: e.target.value || null })}
                  className="mt-0.5 block w-full rounded border border-slate-700 px-2 py-1 text-sm"
                  placeholder="Optional display name"
                />
              </label>
              <button
                type="button"
                onClick={() => onChange(zones.filter((_, j) => j !== i))}
                className="text-xs text-rose-300 hover:underline"
              >
                Remove
              </button>
            </li>
          );
          })}
        </ul>
      )}
    </div>
  );
}
