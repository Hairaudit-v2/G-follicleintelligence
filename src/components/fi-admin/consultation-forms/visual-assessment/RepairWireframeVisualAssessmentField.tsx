"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import type {
  ConsultationRepairAnnotationTag,
  ConsultationRepairVisualAnnotationsV1,
  ConsultationScalpZoneId,
} from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";
import {
  CONSULTATION_REPAIR_ANNOTATION_TAGS,
  CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE,
  parseRepairVisualAnnotations,
} from "@/src/lib/consultationForms/visualAssessment/consultationVisualAssessmentModel";

import { ScalpZonesTopViewSvg, repairTagLabel } from "./ScalpZonesTopViewSvg";

function cloneAnnotations(
  src: ConsultationRepairVisualAnnotationsV1
): ConsultationRepairVisualAnnotationsV1 {
  const out: ConsultationRepairVisualAnnotationsV1 = {};
  for (const k of Object.keys(src) as ConsultationScalpZoneId[]) {
    const v = src[k];
    if (v?.length) out[k] = [...v];
  }
  return out;
}

export function RepairWireframeVisualAssessmentField({
  label,
  description,
  required: _required,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  required?: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled: boolean;
}) {
  const annotations = parseRepairVisualAnnotations(value);
  const [activeTag, setActiveTag] = useState<ConsultationRepairAnnotationTag | null>(
    CONSULTATION_REPAIR_ANNOTATION_TAGS[0] ?? null
  );

  const applyToggle = (zone: ConsultationScalpZoneId) => {
    if (!activeTag) return;
    const next = cloneAnnotations(annotations);
    const cur = new Set(next[zone] ?? []);
    if (cur.has(activeTag)) cur.delete(activeTag);
    else cur.add(activeTag);
    if (cur.size === 0) delete next[zone];
    else next[zone] = Array.from(cur);
    onChange(next);
  };

  const clearZone = (zone: ConsultationScalpZoneId) => {
    const next = cloneAnnotations(annotations);
    delete next[zone];
    onChange(next);
  };

  const legend = (
    <label className={fiOsLightFormSurfaceClassNames.label}>
      {label}
      {_required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
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

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className={cn("mb-2 text-xs", fiOsLightFormSurfaceClassNames.helper)}>
          1) Choose an issue tag. 2) Tap scalp zones on the wireframe to add/remove that tag for the zone. Optional
          reference:
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CONSULTATION_REPAIR_ANNOTATION_TAGS.map((t) => {
            const on = activeTag === t;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => setActiveTag(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  on
                    ? "border-rose-600 bg-rose-50 text-rose-950"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                {repairTagLabel(t)}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${CONSULTATION_VISUAL_ASSESSMENT_PUBLIC_BASE}/head-wireframe.svg`}
              alt="Head wireframe reference"
              className="mx-auto mb-2 hidden max-h-36 w-full max-w-xs rounded border border-slate-100 object-contain md:block"
            />
            <ScalpZonesTopViewSvg
              mode="repair"
              selectedZones={[]}
              onToggleZone={applyToggle}
              repairAnnotations={annotations}
              activeRepairTag={activeTag}
              disabled={disabled}
            />
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-600">Zone summary</p>
            <ul className="space-y-2">
              {Object.keys(annotations).length === 0 ? (
                <li className="text-slate-500">No annotations yet.</li>
              ) : (
                (Object.keys(annotations) as ConsultationScalpZoneId[]).map((z) => (
                  <li
                    key={z}
                    className="rounded border border-slate-100 bg-slate-50/80 px-2 py-2 text-[11px] leading-snug text-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold capitalize text-slate-800">{z.replaceAll("_", " ")}</span>
                      <button
                        type="button"
                        className="shrink-0 text-[11px] font-medium text-rose-700 underline"
                        disabled={disabled}
                        onClick={() => clearZone(z)}
                      >
                        Clear
                      </button>
                    </div>
                    <p className="mt-1 text-slate-600">{(annotations[z] ?? []).map((t) => repairTagLabel(t)).join(", ")}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Raw JSON (read-only)</span>
        <pre className="max-h-28 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800">
          {JSON.stringify(annotations, null, 2)}
        </pre>
      </div>
    </div>
  );
}
