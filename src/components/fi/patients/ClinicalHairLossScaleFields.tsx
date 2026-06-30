"use client";

import {
  HAIRLINE_PATTERN_OPTIONS,
  LUDWIG_OPTIONS,
  NORWOOD_OPTIONS,
} from "@/src/lib/patients/hairLossScales";

export type ClinicalHairLossScaleFieldKey =
  | "norwood_scale"
  | "ludwig_scale"
  | "hairline_pattern"
  | "primary_concern";

type Props = {
  values: Record<ClinicalHairLossScaleFieldKey, string>;
  onFieldChange: (key: ClinicalHairLossScaleFieldKey, value: string) => void;
  disabled?: boolean;
  /** When set, primary concern uses this label (e.g. vs. primary hair concern). */
  primaryConcernLabel?: string;
};

export function ClinicalHairLossScaleFields({
  values,
  onFieldChange,
  disabled,
  primaryConcernLabel = "Primary concern",
}: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Pattern & classification
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-200">
          Hamilton–Norwood
          <select
            value={values.norwood_scale}
            onChange={(e) => onFieldChange("norwood_scale", e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">Not set</option>
            {NORWOOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.description}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-200">
          Ludwig (female pattern)
          <select
            value={values.ludwig_scale}
            onChange={(e) => onFieldChange("ludwig_scale", e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">Not set</option>
            {LUDWIG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.description}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-200 sm:col-span-2">
          Hairline / distribution pattern
          <select
            value={values.hairline_pattern}
            onChange={(e) => onFieldChange("hairline_pattern", e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">Not set</option>
            {HAIRLINE_PATTERN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.description}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-200 sm:col-span-2">
          {primaryConcernLabel}
          <textarea
            value={values.primary_concern}
            onChange={(e) => onFieldChange("primary_concern", e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="e.g. temple recession, crown density, family history of loss…"
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
      </div>
    </div>
  );
}
