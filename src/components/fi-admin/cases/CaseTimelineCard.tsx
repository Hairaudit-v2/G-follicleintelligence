"use client";

import { useMemo, useState } from "react";
import {
  CASE_DETAIL_SECTION_IDS,
  caseDetailSectionHeadingId,
} from "@/src/lib/cases/caseDetailNavConstants";
import type { CaseTimelineFilterPreset, CaseTimelineItem } from "@/src/lib/cases/caseTimelineTypes";
import {
  CASE_TIMELINE_FILTER_PRESETS,
  caseTimelinePresetIncludesKind,
} from "@/src/lib/cases/caseTimelineLabels";
import { CaseTimelineItemList } from "./CaseTimelineItemList";

export function CaseTimelineFilters({
  value,
  onChange,
}: {
  value: CaseTimelineFilterPreset;
  onChange: (v: CaseTimelineFilterPreset) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CASE_TIMELINE_FILTER_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          title={p.hint}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            value === p.id
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-200 hover:bg-white/[0.03]"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function CaseTimelineCard({ items }: { items: CaseTimelineItem[] }) {
  const [preset, setPreset] = useState<CaseTimelineFilterPreset>("all");

  const filtered = useMemo(() => {
    if (preset === "all") return items;
    return items.filter((it) => caseTimelinePresetIncludesKind(preset, it.kind));
  }, [items, preset]);

  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.timeline)}
            className="text-sm font-semibold text-slate-100"
          >
            Patient timeline
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Stage 5E: read-only clinical journey (newest first). Aggregates case, CRM, bookings,
            media, planning, procedure, post-op, follow-ups, and foundation timeline rows. No
            HairAudit scores, audit grading, AI outcome scoring, or certification logic.
          </p>
        </div>
        <p className="text-xs text-gray-500">
          {filtered.length} of {items.length} shown
        </p>
      </div>

      <div className="mt-3">
        <CaseTimelineFilters value={preset} onChange={setPreset} />
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <CaseTimelineItemList items={filtered} />
      </div>
    </div>
  );
}
