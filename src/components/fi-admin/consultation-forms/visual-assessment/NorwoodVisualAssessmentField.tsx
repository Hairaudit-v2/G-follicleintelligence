"use client";

import { cn } from "@/lib/utils";
import { CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE } from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";
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
  const str = typeof value === "string" ? value : "";

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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
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
            className="mx-auto w-full max-w-2xl rounded-md border border-slate-100 bg-white"
          />
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {options.map((o) => {
              const active = str === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(o.value)}
                  className={cn(
                    "min-h-[36px] rounded-lg border px-2.5 py-1 text-left text-xs font-medium transition-colors sm:text-sm",
                    active
                      ? "border-sky-600 bg-sky-50 text-sky-950 ring-1 ring-sky-500/30"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
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

      <div className="space-y-1">
        <span className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500")}>Fallback (dropdown)</span>
        <select
          className={cn(fiOsLightFormSurfaceClassNames.controlInset, "max-w-lg")}
          value={str}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Select —</option>
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
