/**
 * FI-PATIENT-APP-1D — patient-safe appointment DTOs (pure).
 * Never maps staff notes, assignee IDs, revenue, or CRM anchors into the response.
 */

import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type PatientGatewayAppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type PatientGatewayAppointment = {
  id: string;
  type: string;
  title: string;
  startAt: string;
  endAt: string;
  location: {
    name: string | null;
  };
  status: PatientGatewayAppointmentStatus;
  canRequestChange: boolean;
};

export type PatientGatewayAppointmentsListResponse = {
  ok: true;
  upcoming: PatientGatewayAppointment[];
  past: PatientGatewayAppointment[];
};

export type PatientGatewayAppointmentResponse = {
  ok: true;
  appointment: PatientGatewayAppointment;
};

/** Patient-visible status vocabulary — operational arrival collapses to confirmed. */
export function mapBookingStatusToPatientStatus(
  bookingStatus: string
): PatientGatewayAppointmentStatus {
  const s = bookingStatus.trim().toLowerCase();
  if (s === "cancelled") return "cancelled";
  if (s === "completed") return "completed";
  if (s === "no_show") return "no_show";
  if (s === "confirmed" || s === "arrived") return "confirmed";
  return "scheduled";
}

function appointmentTitle(row: Pick<FiBookingRow, "title" | "booking_type">): string {
  const titled = row.title?.trim();
  if (titled) return titled;
  return bookingTypeLabel(row.booking_type);
}

/**
 * Map a booking row to the patient gateway DTO.
 * Explicitly omits description, metadata, staff, financial, and CRM fields.
 */
export function mapBookingRowToPatientGatewayAppointment(
  row: FiBookingRow,
  clinicName: string | null,
  nowIso: string
): PatientGatewayAppointment {
  const status = isBookingCancelled(row)
    ? "cancelled"
    : mapBookingStatusToPatientStatus(row.booking_status);
  const nowMs = Date.parse(nowIso);
  const startMs = Date.parse(row.start_at);
  const upcoming =
    Number.isFinite(startMs) &&
    Number.isFinite(nowMs) &&
    startMs >= nowMs &&
    status !== "cancelled" &&
    status !== "completed" &&
    status !== "no_show";

  const locationName = clinicName?.trim() || row.location?.trim() || null;

  return {
    id: row.id,
    type: row.booking_type.trim() || "other",
    title: appointmentTitle(row),
    startAt: row.start_at,
    endAt: row.end_at,
    location: { name: locationName },
    status,
    canRequestChange: upcoming && (status === "scheduled" || status === "confirmed"),
  };
}

/**
 * Classify appointments into upcoming vs past using instant comparison (timezone-safe).
 * Cancelled / completed / no_show always classify as past.
 */
export function classifyPatientGatewayAppointments(
  rows: readonly FiBookingRow[],
  clinicName: string | null,
  nowIso: string
): { upcoming: PatientGatewayAppointment[]; past: PatientGatewayAppointment[] } {
  const nowMs = Date.parse(nowIso);
  const upcoming: PatientGatewayAppointment[] = [];
  const past: PatientGatewayAppointment[] = [];

  for (const row of rows) {
    const dto = mapBookingRowToPatientGatewayAppointment(row, clinicName, nowIso);
    const startMs = Date.parse(row.start_at);
    const isPastBucket =
      dto.status === "cancelled" ||
      dto.status === "completed" ||
      dto.status === "no_show" ||
      !Number.isFinite(startMs) ||
      startMs < nowMs;
    if (isPastBucket) past.push(dto);
    else upcoming.push(dto);
  }

  upcoming.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  past.sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  return { upcoming, past };
}

export function buildPatientGatewayAppointmentsListResponse(
  rows: readonly FiBookingRow[],
  clinicName: string | null,
  nowIso: string
): PatientGatewayAppointmentsListResponse {
  const { upcoming, past } = classifyPatientGatewayAppointments(rows, clinicName, nowIso);
  return { ok: true, upcoming, past };
}

/** Detect leakage of staff-only appointment fields in a serialized payload. */
export function appointmentPayloadExposesStaffFields(payload: unknown): boolean {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "assigned_staff_id",
    "assigned_user_id",
    "financial_os_status",
    "cancellation_reason",
    "cancelled_by_user_id",
    "created_by_user_id",
    "lead_id",
    "case_id",
    "person_id",
    "metadata",
    "description",
    "room_id",
  ];
  return forbidden.some((k) => serialized.includes(k));
}
