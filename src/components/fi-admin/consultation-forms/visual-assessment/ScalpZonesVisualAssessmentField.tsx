"use client";

import { cn } from "@/lib/utils";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import type { ConsultationFormOption } from "@/src/lib/consultationForms/consultationFormTypes";
import type { ConsultationScalpZoneId } from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";
import { CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE, parseSelectedZones } from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";

import { ScalpZonesTopViewSvg } from "./ScalpZonesTopViewSvg";

export function ScalpZonesVisualAssessmentField({
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
  const selected = parseSelectedZones(value);
  const selectedSet = new Set(selected);
  const optByValue = new Map(options.map((o) => [o.value, o]));

  const toggle = (zone: ConsultationScalpZoneId) => {
    const next = new Set(selectedSet);
    if (next.has(zone)) next.delete(zone);
    else next.add(zone);
    onChange(Array.from(next));
  };

  const legend = (
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
        {legend}
        {desc}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className={cn("text-xs", fiOsLightFormSurfaceClassNames.helper)}>
            Click regions on the schematic to toggle involvement. Optional reference still:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE}/scalp-zones-top.svg`}
            alt="Scalp zone reference (replaceable asset)"
            className="mx-auto hidden max-h-40 w-full max-w-xs rounded border border-slate-100 object-contain sm:block"
          />
          <ScalpZonesTopViewSvg
            mode="multi"
            selectedZones={selected}
            onToggleZone={toggle}
            repairAnnotations={{}}
            activeRepairTag={null}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <span className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500")}>Selected</span>
          <ul className="min-h-[2rem] list-inside list-disc text-sm text-slate-700">
            {selected.length === 0 ? <li className="list-none text-slate-500">None</li> : null}
            {selected.map((z) => (
              <li key={z}>{optByValue.get(z)?.label ?? z}</li>
            ))}
          </ul>
        </div>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500")}>
          Fallback (checkbox list)
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const checked = selectedSet.has(o.value as ConsultationScalpZoneId);
            return (
              <label key={o.value} className={fiOsLightFormSurfaceClassNames.choiceRow}>
                <input
                  type="checkbox"
                  className={fiOsLightFormSurfaceClassNames.choiceCheckbox}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    toggle(o.value as ConsultationScalpZoneId);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
