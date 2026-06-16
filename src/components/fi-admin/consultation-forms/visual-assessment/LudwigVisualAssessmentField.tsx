"use client";

import { cn } from "@/lib/utils";
import { CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE } from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import type { ConsultationFormOption } from "@/src/lib/consultationForms/consultationFormTypes";

export function LudwigVisualAssessmentField({
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
            Tap the Ludwig stage that best matches central density loss. Replace the diagram in{" "}
            <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px]">public/consultation-os/visual-assessment/</code>{" "}
            with your clinic asset when ready.
          </p>
        </div>
        <div className="p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE}/ludwig-scale.svg`}
            alt="Ludwig pattern reference diagram"
            className="mx-auto w-full max-w-xl rounded-md border border-slate-100 bg-white"
          />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {options.map((o) => {
              const active = str === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(o.value)}
                  className={cn(
                    "min-h-[40px] min-w-[120px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-violet-600 bg-violet-50 text-violet-950 ring-1 ring-violet-500/30"
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
