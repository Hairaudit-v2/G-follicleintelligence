import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  isProcedureDayWorkflowStage,
  type ProcedureDayWorkflowStage,
} from "./procedureDayWorkflowCore";
import type { ProcedureDayEventRow, ProcedureDaySessionRow } from "./procedureDayWorkflowTypes";

function isMissingRelationError(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || /relation.*does not exist/i.test(error.message ?? "");
}

function mapSessionRow(raw: Record<string, unknown>): ProcedureDaySessionRow {
  const meta =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const stageRaw = String(raw.current_stage ?? "scheduled");
  const currentStage = isProcedureDayWorkflowStage(stageRaw) ? stageRaw : "scheduled";
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    bookingId: String(raw.booking_id),
    patientId: String(raw.patient_id),
    caseId: raw.case_id != null ? String(raw.case_id) : null,
    currentStage,
    startedAt: raw.started_at != null ? String(raw.started_at) : null,
    completedAt: raw.completed_at != null ? String(raw.completed_at) : null,
    metadata: meta,
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

function mapEventRow(raw: Record<string, unknown>): ProcedureDayEventRow {
  const fromRaw = raw.from_stage != null ? String(raw.from_stage) : null;
  const toRaw = raw.to_stage != null ? String(raw.to_stage) : null;
  const payload =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    sessionId: String(raw.session_id),
    bookingId: String(raw.booking_id),
    patientId: String(raw.patient_id),
    eventType: String(raw.event_type),
    fromStage: fromRaw && isProcedureDayWorkflowStage(fromRaw) ? fromRaw : null,
    toStage: toRaw && isProcedureDayWorkflowStage(toRaw) ? toRaw : null,
    payload,
    actorUserId: raw.actor_user_id != null ? String(raw.actor_user_id) : null,
    createdAt: String(raw.created_at),
  };
}

export async function loadProcedureDaySessionsForBookings(
  tenantId: string,
  bookingIds: string[],
  client?: SupabaseClient
): Promise<Map<string, ProcedureDaySessionRow>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = [...new Set(bookingIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, ProcedureDaySessionRow>();
  if (!ids.length) return out;

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_procedure_day_sessions")
    .select("*")
    .eq("tenant_id", tid)
    .in("booking_id", ids);
  if (error) {
    if (isMissingRelationError(error)) return out;
    throw new Error(error.message);
  }

  for (const raw of data ?? []) {
    const row = mapSessionRow(raw as Record<string, unknown>);
    if (row.tenantId !== tid) throw new Error("Cross-tenant procedure day session detected.");
    out.set(row.bookingId, row);
  }
  return out;
}

export async function loadProcedureDaySessionForBooking(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<ProcedureDaySessionRow | null> {
  const map = await loadProcedureDaySessionsForBookings(tenantId, [bookingId], client);
  return map.get(bookingId.trim()) ?? null;
}

export async function loadProcedureDayEventsForSession(
  tenantId: string,
  sessionId: string,
  limit = 80,
  client?: SupabaseClient
): Promise<ProcedureDayEventRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const sid = assertNonEmptyUuid(sessionId, "sessionId").trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_procedure_day_events")
    .select("*")
    .eq("tenant_id", tid)
    .eq("session_id", sid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((raw) => mapEventRow(raw as Record<string, unknown>));
}

export async function assertProcedureDayBookingScope(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<{
  bookingId: string;
  patientId: string;
  caseId: string | null;
  bookingStatus: string;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const bid = assertNonEmptyUuid(bookingId, "bookingId").trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, tenant_id, patient_id, case_id, booking_status, booking_type")
    .eq("tenant_id", tid)
    .eq("id", bid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Booking not found for this tenant.");
  const row = data as {
    id: string;
    tenant_id: string;
    patient_id: string | null;
    case_id: string | null;
    booking_status: string;
    booking_type: string;
  };
  if (String(row.tenant_id) !== tid) throw new Error("Booking does not belong to this tenant.");
  const patientId = row.patient_id?.trim();
  if (!patientId) throw new Error("Booking must be linked to a patient for procedure day workflow.");
  if (row.booking_type?.trim().toLowerCase() !== "surgery") {
    throw new Error("Procedure day workflow applies to surgery bookings only.");
  }
  return {
    bookingId: String(row.id),
    patientId,
    caseId: row.case_id?.trim() || null,
    bookingStatus: String(row.booking_status ?? "scheduled"),
  };
}

export type ProcedureDaySessionWriteRow = ProcedureDaySessionRow & {
  currentStage: ProcedureDayWorkflowStage;
};