/**
 * `changed_keys` for `booking.updated` CRM activity (Stage 3A). Pure.
 */

import type { FiBookingRow } from "./types";

export type BookingDetailComparableSnapshot = {
  booking_type: string;
  booking_status: string;
  title: string | null;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  location: string | null;
  clinic_id: string | null;
  assigned_user_id: string | null;
  lead_id: string | null;
  person_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  /** Stable JSON string for metadata comparison */
  metadata_json: string;
};

function normText(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function normUuid(v: string | null | undefined): string | null {
  if (v == null || !String(v).trim()) return null;
  return String(v).trim();
}

function stableMetadataJson(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata, Object.keys(metadata).sort());
}

export function bookingDetailSnapshotFromRowLike(row: FiBookingRow): BookingDetailComparableSnapshot {
  return {
    booking_type: row.booking_type.trim(),
    booking_status: row.booking_status.trim(),
    title: normText(row.title),
    description: normText(row.description),
    start_at: row.start_at.trim(),
    end_at: row.end_at.trim(),
    timezone: normText(row.timezone),
    location: normText(row.location),
    clinic_id: normUuid(row.clinic_id),
    assigned_user_id: normUuid(row.assigned_user_id),
    lead_id: normUuid(row.lead_id),
    person_id: normUuid(row.person_id),
    patient_id: normUuid(row.patient_id),
    case_id: normUuid(row.case_id),
    metadata_json: stableMetadataJson(row.metadata ?? {}),
  };
}

const TRACKED: (keyof BookingDetailComparableSnapshot)[] = [
  "booking_type",
  "booking_status",
  "title",
  "description",
  "start_at",
  "end_at",
  "timezone",
  "location",
  "clinic_id",
  "assigned_user_id",
  "lead_id",
  "person_id",
  "patient_id",
  "case_id",
  "metadata_json",
];

export function collectChangedBookingDetailKeys(
  before: BookingDetailComparableSnapshot,
  after: BookingDetailComparableSnapshot
): string[] {
  const keys: string[] = [];
  for (const k of TRACKED) {
    if (before[k] !== after[k]) {
      keys.push(k === "metadata_json" ? "metadata" : k);
    }
  }
  return keys;
}
