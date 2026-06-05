import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCalendarBookings, loadCalendarResources } from "@/src/lib/bookings/calendarLoader";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { utcCalendarDateStringFromDate } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicOsCalendarColumnId, ClinicOsCalendarLiveBookingDTO, ClinicOsCalendarReadOnlyPayload } from "./clinicOsCalendarTypes";

function todayUtcDayQuery(now: Date): ParsedCalendarQuery {
  return {
    view: "day",
    dateAnchor: utcCalendarDateStringFromDate(now),
    calendarTimezone: "UTC",
    status: null,
    bookingType: null,
    assignedUserId: null,
    clinicId: null,
    includeCancelled: false,
    search: null,
    sampleMode: false,
  };
}

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string | null {
  if (!id?.trim()) return null;
  const o = options.find((x) => x.id === id);
  const label = o?.email?.trim() || null;
  return label;
}

function roomLabel(clinics: CrmShellClinicOption[], row: FiBookingRow): string | null {
  if (row.clinic_id?.trim()) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    if (c) return c.display_name;
    return row.clinic_id.slice(0, 8);
  }
  const loc = row.location?.trim();
  return loc || null;
}

function humanizeBookingType(type: string): string {
  const t = type.trim();
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapBookingToGridColumn(row: FiBookingRow): ClinicOsCalendarColumnId {
  const t = row.booking_type.trim().toLowerCase();
  if (t === "surgery") return "surgeryRoom";
  if (t === "prp" || t === "prf" || t === "mesotherapy" || t === "exosomes") return "nursePrp";
  if (t === "consultation") return "consultant";
  return "doctor";
}

function readPatientLabel(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const dn = metadata.display_name;
  const pn = metadata.patient_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  if (typeof pn === "string" && pn.trim()) return pn.trim();
  return null;
}

async function loadPatientNameMap(tenantId: string, patientIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(patientIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; metadata: unknown };
    const label = readPatientLabel(r.metadata as Record<string, unknown>);
    if (label) out.set(String(r.id), label);
  }
  return out;
}

function patientNameForRow(row: FiBookingRow, patientLabels: Map<string, string>): string {
  if (row.patient_id?.trim()) {
    const lab = patientLabels.get(row.patient_id.trim());
    if (lab) return lab;
    return `Patient ${row.patient_id.trim().slice(0, 8)}…`;
  }
  if (row.lead_id?.trim()) return `Lead ${row.lead_id.trim().slice(0, 8)}…`;
  if (row.person_id?.trim()) return `Person ${row.person_id.trim().slice(0, 8)}…`;
  return "Unassigned guest";
}

/**
 * Read-only bookings for the Clinic OS calendar day view: today's UTC window via
 * {@link loadCalendarBookings} / {@link loadBookingsForCalendarOverlap} — no mutations.
 */
export async function loadClinicOsCalendarTodayReadOnly(
  tenantId: string,
  now: Date = new Date()
): Promise<ClinicOsCalendarReadOnlyPayload> {
  const tid = tenantId.trim();
  const query = todayUtcDayQuery(now);

  const [{ bookings, listTruncated }, resources] = await Promise.all([
    loadCalendarBookings(tid, query),
    loadCalendarResources(tid),
  ]);

  const patientIds = bookings.map((b) => b.patient_id).filter((x): x is string => Boolean(x?.trim()));
  const patientLabels = await loadPatientNameMap(tid, patientIds);

  /** Must match `ClinicOsCalendarHome` grid (8:00–18:00 UTC when live data is shown). */
  const dayStartHourUtc = 8;

  const liveBookings: ClinicOsCalendarLiveBookingDTO[] = [];

  for (const row of bookings) {
    const startMs = Date.parse(row.start_at);
    const endMs = Date.parse(row.end_at);
    const dur = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(1, Math.round((endMs - startMs) / 60000)) : 30;

    const start = new Date(row.start_at);
    const startMin = start.getUTCHours() * 60 + start.getUTCMinutes() - dayStartHourUtc * 60;
    const endMin = startMin + dur;
    const gridLast = 10 * 60;
    if (endMin <= 0 || startMin >= gridLast) continue;

    const visStart = Math.max(0, startMin);
    const visEnd = Math.min(gridLast, endMin);
    const displayDurationMin = Math.max(15, visEnd - visStart);

    liveBookings.push({
      id: row.id,
      title: row.title?.trim() || humanizeBookingType(row.booking_type),
      patientName: patientNameForRow(row, patientLabels),
      appointmentType: humanizeBookingType(row.booking_type),
      startTime: row.start_at,
      endTime: row.end_at,
      staffName: assigneeLabel(resources.assignees, row.assigned_user_id),
      roomName: roomLabel(resources.clinics, row),
      status: row.booking_status?.trim() || null,
      href: null,
      startMin: visStart,
      durationMin: displayDurationMin,
      column: mapBookingToGridColumn(row),
    });
  }

  return {
    tenantId: tid,
    dayUtcYmd: query.dateAnchor,
    liveBookings,
    listTruncated,
  };
}
