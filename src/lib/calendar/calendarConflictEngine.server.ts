import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForCalendarOverlap } from "@/src/lib/bookings/bookings";
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  evaluateCalendarConflicts,
  type CalendarConflictEngineResult,
} from "./calendarConflictEngineCore";

export type AssertCalendarBookingConflictsInput = {
  tenantId: string;
  candidate: Pick<
    FiBookingRow,
    | "id"
    | "start_at"
    | "end_at"
    | "assigned_staff_id"
    | "assigned_user_id"
    | "patient_id"
    | "room_id"
    | "booking_type"
    | "booking_status"
    | "room_required"
  >;
  adminKey?: string;
  request?: Request;
  client?: SupabaseClient;
};

export async function assertCalendarBookingConflicts(
  input: AssertCalendarBookingConflictsInput
): Promise<CalendarConflictEngineResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId").trim();
  await assertCrmTenantWriteAllowed({
    tenantId: tid,
    adminKey: input.adminKey,
    request: input.request,
  });

  const calendarSettings = await loadTenantOperationalCalendarSettings(tid);
  const rangeStartIso = input.candidate.start_at;
  const rangeEndIso = input.candidate.end_at;

  const existing = await loadBookingsForCalendarOverlap({
    tenantId: tid,
    rangeStartIso,
    rangeEndIso,
    limit: 400,
  });

  return evaluateCalendarConflicts({
    candidate: input.candidate,
    existing,
    gridConfig: calendarSettings.gridConfig,
    bufferMinutes: calendarSettings.settings.bufferMinutes,
  });
}

export type OverrideCalendarConflictInput = {
  tenantId: string;
  bookingId: string;
  reason: string;
  actorFiUserId: string | null;
  violations: CalendarConflictEngineResult["violations"];
  adminKey?: string;
  request?: Request;
  client?: SupabaseClient;
};

/**
 * Records an audited override when staff proceed despite calendar conflicts.
 * Does not mutate the booking — caller must save after override is logged.
 */
export async function overrideCalendarConflictWithAudit(
  input: OverrideCalendarConflictInput
): Promise<{ ok: true; auditEventId: string | null }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId").trim();
  const bid = assertNonEmptyUuid(input.bookingId, "bookingId").trim();
  const reason = input.reason.trim();
  if (!reason) throw new Error("Override reason is required.");

  await assertCrmTenantWriteAllowed({
    tenantId: tid,
    adminKey: input.adminKey,
    request: input.request,
  });

  const supabase = input.client ?? supabaseAdmin();
  const { data: booking, error } = await supabase
    .from("fi_bookings")
    .select("id, tenant_id, patient_id, lead_id, case_id")
    .eq("tenant_id", tid)
    .eq("id", bid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Booking not found for this tenant.");
  const rowTenant = String((booking as { tenant_id?: string }).tenant_id ?? "").trim();
  if (rowTenant && rowTenant !== tid) {
    throw new Error("Booking does not belong to this tenant.");
  }

  const b = booking as {
    id: string;
    patient_id: string | null;
    lead_id: string | null;
    case_id: string | null;
  };

  await appendCrmActivityEvent(
    {
      tenantId: tid,
      leadId: b.lead_id,
      patientId: b.patient_id,
      caseId: b.case_id,
      activityKind: "calendar.conflict_override",
      title: "Calendar conflict override",
      detail: {
        booking_id: bid,
        reason,
        violations: input.violations,
        actor_fi_user_id: input.actorFiUserId,
      },
      occurredAt: new Date().toISOString(),
    },
    supabase
  );

  return { ok: true, auditEventId: null };
}