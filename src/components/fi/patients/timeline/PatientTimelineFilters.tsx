"use client";

import type { PatientTimelineItemType, PatientTimelineSourceType, PatientTimelineSortDirection } from "@/src/lib/patients/timeline/patientTimelineTypes";
import { patientTimelineItemTypeLabel, patientTimelineSourceLabel } from "@/src/lib/patients/timeline/patientTimelineLabels";
import type { PatientTimelineFilterState } from "@/src/lib/patients/timeline/patientTimelineFilters";

const ITEM_TYPES: PatientTimelineItemType[] = [
  "lead_created",
  "lead_converted",
  "crm_activity",
  "booking_scheduled",
  "booking_completed",
  "booking_cancelled",
  "case_created",
  "clinical_details_updated",
  "image_uploaded",
  "image_archived",
  "patient_admin_updated",
  "other",
];

const SOURCE_TYPES: PatientTimelineSourceType[] = [
  "patient",
  "lead",
  "crm_activity",
  "booking",
  "case",
  "clinical",
  "image",
  "system",
];

export function PatientTimelineFilters({
  filters,
  onChange,
  sortDirection,
  onSortDirectionChange,
}: {
  filters: PatientTimelineFilterState;
  onChange: (next: PatientTimelineFilterState) => void;
  sortDirection: PatientTimelineSortDirection;
  onSortDirectionChange: (d: PatientTimelineSortDirection) => void;
}) {
  const typeVal = filters.itemTypes?.length === 1 ? filters.itemTypes[0]! : "";
  const sourceVal = filters.sourceTypes?.length === 1 ? filters.sourceTypes[0]! : "";

  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 pb-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
      <div className="flex flex-col gap-1">
        <label htmlFor="timeline-type-filter" className="text-xs font-medium text-gray-600">
          Event type
        </label>
        <select
          id="timeline-type-filter"
          className="max-w-xs rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          value={typeVal}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              itemTypes: v ? ([v] as readonly PatientTimelineItemType[]) : null,
            });
          }}
        >
          <option value="">All types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {patientTimelineItemTypeLabel(t)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="timeline-source-filter" className="text-xs font-medium text-gray-600">
          Source
        </label>
        <select
          id="timeline-source-filter"
          className="max-w-xs rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          value={sourceVal}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              sourceTypes: v ? ([v] as readonly PatientTimelineSourceType[]) : null,
            });
          }}
        >
          <option value="">All sources</option>
          {SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>
              {patientTimelineSourceLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Order</span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              sortDirection === "newest_first" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
            }`}
            onClick={() => onSortDirectionChange("newest_first")}
          >
            Newest first
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              sortDirection === "oldest_first" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
            }`}
            onClick={() => onSortDirectionChange("oldest_first")}
          >
            Oldest first
          </button>
        </div>
      </div>
    </div>
  );
}
