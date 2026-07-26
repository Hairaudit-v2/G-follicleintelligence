/**
 * FI-PATIENT-APP-1D — patient gateway appointments ownership wrapper.
 * Queries only bookings linked to the server-resolved patient + tenant.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadBookingForTenant, loadBookingsForPatient } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

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

export type LoadPatientGatewayAppointmentsOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  nowIso?: string;
  loadBookings?: typeof loadBookingsForPatient;
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
  const loadBookings = options?.loadBookings ?? loadBookingsForPatient;

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
