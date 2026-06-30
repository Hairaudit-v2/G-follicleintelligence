"use client";

import { cn } from "@/lib/utils";
import {
  CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE,
  normalizePatternClassificationString,
} from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import type { ConsultationFormOption } from "@/src/lib/consultationForms/consultationFormTypes";

export function NorwoodVisualAssessmentField({
  label,
  description,
  required,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  description?: string;
  required?: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  options: ConsultationFormOption[];
  disabled: boolean;
}) {
  const str = normalizePatternClassificationString(value);
  const hasLegacyUnknown = Boolean(str && !options.some((o) => o.value === str));

  const commonLabel = (
    <label className={fiOsLightFormSurfaceClassNames.label}>
      {label}
      {required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
    </label>
  );

  const desc =
    description?.trim() ? (
      <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {commonLabel}
        {desc}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
        <div className="border-b border-white/[0.06] bg-white/[0.03] px-3 py-2">
          <p className={cn("text-xs", fiOsLightFormSurfaceClassNames.helper)}>
            Tap the stage that best matches the pattern (reference diagram). Legacy dropdown remains below for precise
            coding.
          </p>
        </div>
        <div className="p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE}/norwood-scale.svg`}
            alt="Norwood pattern reference diagram"
            className="mx-auto max-h-[min(40vh,320px)] w-full max-w-2xl rounded-md border border-white/[0.06] bg-[#0F1629]/80 backdrop-blur-md object-contain"
          />
          <div className="-mx-1 mt-3 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-min flex-wrap justify-center gap-2">
              {hasLegacyUnknown ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(str)}
                  className={cn(
                    "min-h-[44px] shrink-0 rounded-lg border border-amber-300 bg-amber-400/10 px-3 py-2 text-left text-xs font-medium text-amber-200 ring-1 ring-amber-400/30 sm:text-sm",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                  title="Value from an older form version; tap to keep or pick a standard stage below."
                >
                  Legacy code: <span className="font-mono">{str}</span>
                </button>
              ) : null}
              {options.map((o) => {
                const active = str === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(normalizePatternClassificationString(o.value))}
                    className={cn(
                      "min-h-[44px] min-w-[44px] shrink-0 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors sm:min-w-0 sm:py-1.5 sm:text-sm",
                      active
                        ? "border-sky-600 bg-cyan-500/10 text-cyan-200 ring-1 ring-sky-500/30"
                        : "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-300 hover:border-slate-700 hover:bg-white/[0.03]",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <span className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500")}>Fallback (dropdown)</span>
        <select
          className={cn(fiOsLightFormSurfaceClassNames.controlInset, "max-w-lg")}
          value={str}
          disabled={disabled}
          onChange={(e) => onChange(normalizePatternClassificationString(e.target.value))}
        >
          <option value="">— Select —</option>
          {hasLegacyUnknown ? (
            <option value={str}>
              (Legacy) {str}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
