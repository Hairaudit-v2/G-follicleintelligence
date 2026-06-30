"use client";

import { useMemo, useState } from "react";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import type { PatientTimelineBuildResult } from "@/src/lib/patients/timeline/patientTimelineTypes";
import type { PatientTimelineSortDirection } from "@/src/lib/patients/timeline/patientTimelineTypes";
import {
  filterPatientTimelineItems,
  groupPatientTimelineByPeriod,
  sortPatientTimelineItems,
} from "@/src/lib/patients/timeline/patientTimelineFilters";
import type { PatientTimelineFilterState } from "@/src/lib/patients/timeline/patientTimelineFilters";
import { PatientTimelineFilters } from "./PatientTimelineFilters";
import { PatientTimelineItem } from "./PatientTimelineItem";

function sectionTitle(id: "today" | "this_week" | "earlier"): string {
  if (id === "today") return "Today";
  if (id === "this_week") return "This week";
  return "Earlier";
}

export function PatientTreatmentTimelineCard({
  patientTimeline,
  patientImages,
}: {
  patientTimeline: PatientTimelineBuildResult;
  patientImages: PatientImagesProfileBundle;
}) {
  const [filters, setFilters] = useState<PatientTimelineFilterState>({ itemTypes: null, sourceTypes: null });
  const [sortDirection, setSortDirection] = useState<PatientTimelineSortDirection>("newest_first");

  const thumbByImageId = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of patientImages.activeWithSignedUrls) {
      m.set(t.image.id, t.signed.url);
    }
    return m;
  }, [patientImages.activeWithSignedUrls]);

  const visible = useMemo(() => {
    const filtered = filterPatientTimelineItems(patientTimeline.items, filters);
    return sortPatientTimelineItems(filtered, sortDirection);
  }, [patientTimeline.items, filters, sortDirection]);

  const grouped = useMemo(() => groupPatientTimelineByPeriod(visible), [visible]);

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Treatment timeline</h2>
      <p className="mt-1 text-xs text-gray-500">
        This timeline summarises patient activity without exposing full clinical notes, admin notes, or message bodies.
      </p>
      <p className="mt-2 text-xs text-amber-200">
        Read-only aggregation across CRM, bookings, cases, clinical metadata, and imaging. Editing, drag-and-drop
        timelines, and patient-facing views remain out of scope for Stage 4D.
      </p>

      <div className="mt-4">
        <PatientTimelineFilters
          filters={filters}
          onChange={setFilters}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
        />
      </div>

      {patientTimeline.hasMore ? (
        <p className="mt-2 text-xs text-gray-500">Showing the latest {patientTimeline.items.length} events.</p>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          {patientTimeline.items.length === 0
            ? "No timeline events yet. Activity will appear as leads, bookings, cases, clinical details, and images are linked to this patient."
            : "No timeline events matched the current filters."}
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {(["today", "this_week", "earlier"] as const).map((key) => {
            const block = grouped[key];
            if (!block.length) return null;
            return (
              <div key={key}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{sectionTitle(key)}</h3>
                <ul className="mt-1">
                  {block.map((item) => (
                    <PatientTimelineItem
                      key={item.id}
                      item={item}
                      thumbnailUrl={item.item_type === "image_uploaded" ? thumbByImageId.get(item.source_id) : null}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
