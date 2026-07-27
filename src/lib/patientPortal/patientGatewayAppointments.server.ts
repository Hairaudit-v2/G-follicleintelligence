/**
 * FI-PATIENT-APP-1D — patient gateway appointments ownership wrapper.
 * Queries only bookings linked to the server-resolved patient + tenant.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadBookingForTenant } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  buildPatientGatewayAppointmentsListResponse,
  mapBookingRowToPatientGatewayAppointment,
  type PatientGatewayAppointmentResponse,
  type PatientGatewayAppointmentsListResponse,
} from "./patientGatewayAppointmentsCore";
import { assertOwnedAppointmentRow } from "./patientGatewayOwnershipCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

const GATEWAY_BOOKING_SELECT =
  "id, tenant_id, lead_id, person_id, patient_id, case_id, clinic_id, room_id, room_required, assigned_staff_id, assigned_user_id, booking_type, booking_status, financial_os_status, title, description, start_at, end_at, timezone, location, metadata, cancelled_at, cancelled_by_user_id, cancellation_reason, created_by_user_id, created_at, updated_at";

function mapGatewayBookingRow(row: Record<string, unknown>): FiBookingRow {
  const metaRaw = row.metadata;
  const metadata =
    metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
      ? (metaRaw as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    room_id: row.room_id != null ? String(row.room_id) : null,
    room_required: row.room_required == null ? true : Boolean(row.room_required),
    assigned_staff_id: row.assigned_staff_id != null ? String(row.assigned_staff_id) : null,
    assigned_user_id: row.assigned_user_id != null ? String(row.assigned_user_id) : null,
    booking_type: String(row.booking_type ?? "other"),
    booking_status: String(row.booking_status ?? "scheduled"),
    financial_os_status: row.financial_os_status != null ? String(row.financial_os_status) : null,
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    start_at: String(row.start_at),
    end_at: String(row.end_at),
    timezone: row.timezone != null ? String(row.timezone) : null,
    location: row.location != null ? String(row.location) : null,
    metadata,
    cancelled_at: row.cancelled_at != null ? String(row.cancelled_at) : null,
    cancelled_by_user_id:
      row.cancelled_by_user_id != null ? String(row.cancelled_by_user_id) : null,
    cancellation_reason: row.cancellation_reason != null ? String(row.cancellation_reason) : null,
    created_by_user_id: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    created_at: String(row.created_at ?? row.start_at),
    updated_at: String(row.updated_at ?? row.start_at),
  };
}

/**
 * Patient-gateway booking load. Uses an explicit column list and null-safe metadata
 * so a single bad legacy row cannot fail-closed the whole list as an empty success.
 */
export async function loadBookingsForPatientGateway(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const pid = assertNonEmptyUuid(patientId, "patientId");

  const { data, error } = await supabase
    .from("fi_bookings")
    .select(GATEWAY_BOOKING_SELECT)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  let rows = ((data ?? []) as Record<string, unknown>[]).map(mapGatewayBookingRow);

  // Defensive fallback: production has been observed returning [] for the compound
  // patient_id filter while primary-key reads for the same rows succeed. Re-query
  // by tenant and filter in memory; ownership is still enforced by the caller.
  if (rows.length === 0) {
    const fallback = await supabase
      .from("fi_bookings")
      .select(GATEWAY_BOOKING_SELECT)
      .eq("tenant_id", tid)
      .order("start_at", { ascending: true })
      .limit(500);
    if (fallback.error) throw new Error(fallback.error.message);
    rows = ((fallback.data ?? []) as Record<string, unknown>[])
      .map(mapGatewayBookingRow)
      .filter((row) => String(row.patient_id ?? "").trim() === pid);
  }

  return rows;
}

export type LoadPatientGatewayAppointmentsOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  nowIso?: string;
  loadBookings?: (
    tenantId: string,
    patientId: string,
    client?: SupabaseClient
  ) => Promise<FiBookingRow[]>;
  loadBooking?: typeof loadBookingForTenant;
};

/**
 * List patient-safe appointments for the authenticated gateway patient only.
 */
export async function listPatientGatewayAppointments(
  ctx: PatientGatewayContext,
  options?: LoadPatientGatewayAppointmentsOptions
): Promise<PatientGatewayAppointmentsListResponse | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const loadBookings = options?.loadBookings ?? loadBookingsForPatientGateway;

  try {
    const rows = await loadBookings(ctx.tenantId, ctx.patientId, options?.supabase);

    for (const row of rows) {
      const ownership = assertOwnedAppointmentRow(ctx, {
        tenant_id: row.tenant_id,
        patient_id: row.patient_id,
      });
      if (ownership) {
        if (writeAudit) {
          writePatientGatewayAudit({
            action: "appointment_ownership_denied",
            outcome: "deny",
            code: ownership.code,
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "appointment",
            resourceId: row.id,
          });
          writePatientGatewayAudit({
            action: "appointments_list_denied",
            outcome: "deny",
            code: ownership.code,
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "appointment",
            resourceId: row.id,
          });
        }
        return ownership;
      }
    }

    const response = buildPatientGatewayAppointmentsListResponse(rows, ctx.clinicName, nowIso);

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "appointments_list_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "appointment",
      });
    }

    return response;
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load appointments.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "appointments_list_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "appointment",
      });
    }
    return deny;
  }
}

/**
 * Read one appointment after re-verifying ownership against the gateway context.
 * Appointment IDs from the client are untrusted.
 */
export async function getPatientGatewayAppointment(
  ctx: PatientGatewayContext,
  appointmentId: string,
  options?: LoadPatientGatewayAppointmentsOptions
): Promise<PatientGatewayAppointmentResponse | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const loadBooking = options?.loadBooking ?? loadBookingForTenant;

  let bid: string;
  try {
    bid = assertNonEmptyUuid(appointmentId, "appointmentId").trim();
  } catch {
    const deny = patientGatewayDeny("not_found", 404, "Appointment not found.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "appointment_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "appointment",
        resourceId: appointmentId,
      });
    }
    return deny;
  }

  try {
    const row: FiBookingRow | null = await loadBooking(ctx.tenantId, bid, options?.supabase);
    if (!row) {
      const deny = patientGatewayDeny("not_found", 404, "Appointment not found.");
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "appointment_read_denied",
          outcome: "deny",
          code: deny.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "appointment",
          resourceId: bid,
        });
      }
      return deny;
    }

    const ownership = assertOwnedAppointmentRow(ctx, {
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
    });
    if (ownership) {
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "appointment_ownership_denied",
          outcome: "deny",
          code: ownership.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "appointment",
          resourceId: row.id,
        });
        writePatientGatewayAudit({
          action: "appointment_read_denied",
          outcome: "deny",
          code: ownership.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "appointment",
          resourceId: row.id,
        });
      }
      return ownership;
    }

    const appointment = mapBookingRowToPatientGatewayAppointment(row, ctx.clinicName, nowIso);

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "appointment_read_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "appointment",
        resourceId: row.id,
      });
    }

    return { ok: true, appointment };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load appointment.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "appointment_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "appointment",
        resourceId: bid,
      });
    }
    return deny;
  }
}

/** Explicit ownership helper for appointment rows (audited). */
export function requirePatientGatewayOwnedAppointment(
  ctx: PatientGatewayContext,
  row: { tenant_id: string; patient_id: string | null | undefined },
  resourceId?: string | null,
  writeAudit = true
): PatientGatewayDeny | null {
  const deny = assertOwnedAppointmentRow(ctx, row);
  if (!deny) return null;
  if (writeAudit) {
    writePatientGatewayAudit({
      action: "appointment_ownership_denied",
      outcome: "deny",
      code: deny.code,
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "appointment",
      resourceId: resourceId ?? null,
    });
  }
  return deny;
}
