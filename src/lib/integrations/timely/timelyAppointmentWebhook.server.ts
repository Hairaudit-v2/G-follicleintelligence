import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "@/src/lib/fi/foundation/internal";
import type { CreateBookingParams } from "@/src/lib/bookings/bookings";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { isConsultationLikeBookingType } from "@/src/lib/consultations/consultationBookingLink";
import type { z } from "zod";
import type { timelyAppointmentWebhookSchema } from "./timelyWebhookSchemas";
import {
  extractTimelyAppointmentEventType,
  inferTimelyAppointmentLifecycleEvent,
  mapTimelyStatusToBookingStatus,
  type TimelyAppointmentLifecycleEvent,
} from "./timelyAppointmentLifecycle";
import { TimelyWebhookHttpError } from "./timelyWebhookHttp.server";

async function defaultLoadBooking(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<FiBookingRow | null> {
  const { loadBookingForTenant } = await import("@/src/lib/bookings/server");
  return loadBookingForTenant(tenantId, bookingId, client);
}
const SOURCE = "timely";
const ENTITY_BOOKING = "booking";

export type TimelyAppointmentPayload = z.infer<typeof timelyAppointmentWebhookSchema>;

async function assertTenantExists(supabase: SupabaseClient, tenantId: string): Promise<void> {
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId.trim()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TimelyWebhookHttpError(404, "Tenant not found.");
}

async function loadExistingBookingMapping(
  supabase: SupabaseClient,
  tenantId: string,
  externalAppointmentId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_external_entity_mappings")
    .select("internal_id")
    .eq("tenant_id", tenantId.trim())
    .eq("source_system", SOURCE)
    .eq("entity_type", ENTITY_BOOKING)
    .eq("external_id", externalAppointmentId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return String((data as { internal_id: string }).internal_id);
}

async function resolveDefaultClinicId(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) {
    throw new TimelyWebhookHttpError(422, "No clinic is configured for this tenant.");
  }
  if (rows.length > 1) {
    throw new TimelyWebhookHttpError(
      422,
      "Multiple clinics exist for this tenant; Timely webhook cannot pick a default clinic."
    );
  }
  return String(rows[0].id);
}

async function resolveServiceBookingType(
  supabase: SupabaseClient,
  tenantId: string,
  serviceName: string | undefined
): Promise<string> {
  const name = serviceName?.trim();
  if (!name) return "consultation";

  const { data, error } = await supabase
    .from("fi_services")
    .select("booking_type, name")
    .eq("tenant_id", tenantId.trim())
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { booking_type: string; name: string }[];
  const lower = name.toLowerCase();
  const match = rows.find((r) => r.name.trim().toLowerCase() === lower);
  if (!match) {
    throw new TimelyWebhookHttpError(422, `Service not found for name: ${name}`);
  }
  return String(match.booking_type).trim();
}

/**
 * Exact (trimmed) or case-insensitive full_name match among active staff.
 * Multiple matches → ambiguous (caller should 422).
 */
export function resolveTimelyStaffIdByName(
  staffRows: { id: string; full_name: string }[],
  staffName: string | undefined | null
): { staffId: string | null; ambiguous: boolean } {
  const raw = staffName?.trim();
  if (!raw) return { staffId: null, ambiguous: false };

  const exact = staffRows.filter((s) => s.full_name.trim() === raw);
  if (exact.length === 1) return { staffId: exact[0].id, ambiguous: false };
  if (exact.length > 1) return { staffId: null, ambiguous: true };

  const lower = raw.toLowerCase();
  const ci = staffRows.filter((s) => s.full_name.trim().toLowerCase() === lower);
  if (ci.length === 1) return { staffId: ci[0].id, ambiguous: false };
  if (ci.length > 1) return { staffId: null, ambiguous: true };

  return { staffId: null, ambiguous: false };
}

async function loadPatientForTimelyExternalId(
  supabase: SupabaseClient,
  tenantId: string,
  externalPatientId: string
): Promise<{ patient_id: string; person_id: string } | null> {
  const { data: mapRow, error: e1 } = await supabase
    .from("fi_patient_source_ids")
    .select("patient_id")
    .eq("tenant_id", tenantId.trim())
    .eq("source_system", SOURCE)
    .eq("source_patient_id", externalPatientId.trim())
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!mapRow) return null;

  const pid = String((mapRow as { patient_id: string }).patient_id);
  const { data: patient, error: e2 } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", pid)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!patient) return null;
  const p = patient as { id: string; person_id: string };
  return { patient_id: String(p.id), person_id: String(p.person_id) };
}

async function insertBookingMapping(
  supabase: SupabaseClient,
  tenantId: string,
  externalAppointmentId: string,
  bookingId: string
): Promise<void> {
  const { error } = await supabase.from("fi_external_entity_mappings").insert({
    tenant_id: tenantId.trim(),
    source_system: SOURCE,
    entity_type: ENTITY_BOOKING,
    external_id: externalAppointmentId.trim(),
    internal_id: bookingId.trim(),
  });
  if (error?.code === "23505") {
    return;
  }
  if (error) throw new Error(error.message);
}

function isStaffRetryableError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as Error;
  const n = err.name;
  if (n === "StaffClinicalAvailabilityError" || n === "ServiceStaffEligibilityError") return true;
  if (n === "RoomAvailabilityError" && typeof err.message === "string") {
    const m = err.message;
    return (
      m.includes("already booked") ||
      m.includes("not eligible") ||
      m.includes("needs") ||
      m.includes("Assign matching staff")
    );
  }
  return false;
}

function isModelRequiresStaffError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as Error;
  if (err.name !== "RoomAvailabilityError" || typeof err.message !== "string") return false;
  const m = err.message;
  return (
    m.includes("This booking needs") ||
    m.includes("Assign matching staff") ||
    m.includes("eligible room") ||
    m.includes("room must be assigned")
  );
}

function buildTimelyBookingMetadata(
  payload: TimelyAppointmentPayload,
  externalAppointmentId: string,
  existingMetadata?: Record<string, unknown>
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? existingMetadata
      : {};

  const patch: Record<string, unknown> = {
    source_system: SOURCE,
    external_appointment_id: externalAppointmentId,
    external_patient_id: payload.external_patient_id.trim(),
  };
  if (payload.service_name?.trim()) patch.service_name = payload.service_name.trim();
  if (payload.staff_name?.trim()) patch.staff_name = payload.staff_name.trim();
  if (payload.notes != null && String(payload.notes).trim()) patch.notes = String(payload.notes).trim();
  if (payload.status?.trim()) patch.original_status = payload.status.trim();

  return shallowMergeMetadata(base, patch);
}

function resolveLifecycleEvent(
  payload: TimelyAppointmentPayload,
  hasExistingBooking: boolean,
  existingStartAt?: string | null
): TimelyAppointmentLifecycleEvent {
  const startAt = new Date(payload.start_time.trim()).toISOString();
  const startTimeChanged = Boolean(
    hasExistingBooking && existingStartAt && new Date(existingStartAt).toISOString() !== startAt
  );

  return inferTimelyAppointmentLifecycleEvent({
    explicitEventType: extractTimelyAppointmentEventType(payload),
    status: payload.status ?? null,
    hasExistingBooking,
    startTimeChanged,
  });
}

function resolveTargetBookingStatus(
  lifecycleEvent: TimelyAppointmentLifecycleEvent,
  payload: TimelyAppointmentPayload,
  existing: FiBookingRow
): string {
  if (lifecycleEvent === "appointment_cancelled") return "cancelled";
  if (lifecycleEvent === "appointment_completed") return "completed";
  if (lifecycleEvent === "appointment_no_show") return "no_show";

  const mapped = mapTimelyStatusToBookingStatus(payload.status ?? null);
  if (mapped) return mapped;

  return existing.booking_status;
}

function nullableTrimmedEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a?.trim() || null) === (b?.trim() || null);
}

function bookingFieldsUnchanged(
  existing: FiBookingRow,
  next: {
    start_at: string;
    end_at: string;
    assigned_staff_id: string | null;
    booking_status: string;
    metadata: Record<string, unknown>;
    cancelled_at: string | null;
  }
): boolean {
  const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
  return (
    new Date(existing.start_at).toISOString() === next.start_at &&
    new Date(existing.end_at).toISOString() === next.end_at &&
    (existing.assigned_staff_id?.trim() || null) === next.assigned_staff_id &&
    existing.booking_status.trim() === next.booking_status &&
    nullableTrimmedEqual(existing.cancelled_at, next.cancelled_at) &&
    String(existingMeta.original_status ?? "") === String(next.metadata.original_status ?? "")
  );
}

export type TimelyConsultationAction = "created" | "existing" | "skipped";

export type ProcessTimelyAppointmentWebhookSuccess = {
  ok: true;
  booking_id: string;
  action: "created" | "updated";
  lifecycle_event: TimelyAppointmentLifecycleEvent;
  unchanged?: boolean;
  consultation_id: string | null;
  consultation_action: TimelyConsultationAction;
};

type ProcessTimelyAppointmentWebhookCoreSuccess = Omit<
  ProcessTimelyAppointmentWebhookSuccess,
  "consultation_id" | "consultation_action"
>;

export type ProcessTimelyAppointmentWebhookResult =
  | ProcessTimelyAppointmentWebhookSuccess
  | { ok: false; status: number; message: string };

export type TimelyAppointmentWebhookPorts = {
  createBooking: (params: CreateBookingParams, client?: SupabaseClient) => Promise<FiBookingRow>;
  updateBooking: (
    params: import("@/src/lib/bookings/bookings").UpdateBookingParams,
    client?: SupabaseClient
  ) => Promise<FiBookingRow>;
  loadBooking: (tenantId: string, bookingId: string, client?: SupabaseClient) => Promise<FiBookingRow | null>;
  loadActiveStaffForTenant: (
    tenantId: string,
    client?: SupabaseClient
  ) => Promise<{ id: string; full_name: string }[]>;
  syncBookingReminders: (booking: FiBookingRow, client?: SupabaseClient) => Promise<void>;
  createConsultationFromBooking: (
    tenantId: string,
    bookingId: string,
    client?: SupabaseClient
  ) => Promise<{ consultation: { id: string }; created: boolean }>;
};

function getDefaultAppointmentPorts(): TimelyAppointmentWebhookPorts {
  return {
    createBooking: async (params, client) => {
      const { createBooking } = await import("@/src/lib/bookings/server");
      return createBooking(params, client);
    },
    updateBooking: async (params, client) => {
      const { updateBooking } = await import("@/src/lib/bookings/server");
      return updateBooking(params, client);
    },
    loadBooking: defaultLoadBooking,
    loadActiveStaffForTenant: async (tenantId, client) => {
      const { loadActiveStaffForTenant } = await import("@/src/lib/staff/staff.server");
      return loadActiveStaffForTenant(tenantId, client);
    },
    syncBookingReminders: async (booking, client) => {
      const { syncBookingReminderJobs } = await import("@/src/lib/reminders/reminderEnqueue.server");
      await syncBookingReminderJobs(booking, client);
    },
    createConsultationFromBooking: async (tenantId, bookingId) => {
      const { createConsultationFromBooking } = await import("@/src/lib/consultations/consultationMutations.server");
      return createConsultationFromBooking(tenantId, bookingId);
    },
  };
}

function shouldSkipConsultationWorkspaceForBooking(
  booking: Pick<FiBookingRow, "booking_type" | "booking_status" | "cancelled_at">
): boolean {
  if (!isConsultationLikeBookingType(booking.booking_type)) return true;
  if (isBookingCancelled(booking)) return true;
  if (booking.booking_status.trim() === "no_show") return true;
  return false;
}

async function attachConsultationWorkspaceToTimelyAppointmentResult(
  supabase: SupabaseClient,
  tenantId: string,
  result: ProcessTimelyAppointmentWebhookCoreSuccess,
  ports: TimelyAppointmentWebhookPorts
): Promise<ProcessTimelyAppointmentWebhookSuccess> {
  const booking = await ports.loadBooking(tenantId, result.booking_id, supabase);
  if (!booking || shouldSkipConsultationWorkspaceForBooking(booking)) {
    return {
      ...result,
      consultation_id: null,
      consultation_action: "skipped",
    };
  }

  const { consultation, created } = await ports.createConsultationFromBooking(
    tenantId,
    result.booking_id,
    supabase
  );
  return {
    ...result,
    consultation_id: consultation.id,
    consultation_action: created ? "created" : "existing",
  };
}

async function patchTimelyBookingMetadataOnly(
  supabase: SupabaseClient,
  tenantId: string,
  bookingId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("fi_bookings")
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId.trim())
    .eq("id", bookingId.trim());
  if (error) throw new Error(error.message);
}

async function applyTimelyCancellation(
  supabase: SupabaseClient,
  tenantId: string,
  bookingId: string,
  existing: FiBookingRow,
  metadata: Record<string, unknown>,
  ports: TimelyAppointmentWebhookPorts
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("fi_bookings")
    .update({
      booking_status: "cancelled",
      cancelled_at: existing.cancelled_at?.trim() || nowIso,
      metadata,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId.trim())
    .eq("id", bookingId.trim());
  if (error) throw new Error(error.message);

  const refreshed = await ports.loadBooking(tenantId, bookingId, supabase);
  if (refreshed) await ports.syncBookingReminders(refreshed, supabase);
}

async function syncExistingTimelyBooking(
  supabase: SupabaseClient,
  tenantId: string,
  bookingId: string,
  payload: TimelyAppointmentPayload,
  externalAppointmentId: string,
  ports: TimelyAppointmentWebhookPorts
): Promise<ProcessTimelyAppointmentWebhookResult | ProcessTimelyAppointmentWebhookCoreSuccess> {
  const existing = await ports.loadBooking(tenantId, bookingId, supabase);
  if (!existing) {
    return { ok: false, status: 404, message: "Mapped booking not found." };
  }

  const lifecycleEvent = resolveLifecycleEvent(payload, true, existing.start_at);
  const staffList = await ports.loadActiveStaffForTenant(tenantId, supabase);
  const staffPick = resolveTimelyStaffIdByName(
    staffList.map((s) => ({ id: s.id, full_name: s.full_name })),
    payload.staff_name
  );
  if (staffPick.ambiguous) {
    return { ok: false, status: 422, message: "Staff not found or ambiguous" };
  }

  const startAt = new Date(payload.start_time.trim()).toISOString();
  const endAt = new Date(payload.end_time.trim()).toISOString();
  const metadata = buildTimelyBookingMetadata(payload, externalAppointmentId, existing.metadata as Record<string, unknown>);
  const targetStatus = resolveTargetBookingStatus(lifecycleEvent, payload, existing);
  const nextAssignedStaffId =
    payload.staff_name !== undefined ? staffPick.staffId : (existing.assigned_staff_id?.trim() || null);

  const cancelledAt =
    targetStatus === "cancelled" ? existing.cancelled_at?.trim() || new Date().toISOString() : existing.cancelled_at;

  const nextSnapshot = {
    start_at: startAt,
    end_at: endAt,
    assigned_staff_id: nextAssignedStaffId,
    booking_status: targetStatus,
    metadata,
    cancelled_at: cancelledAt,
  };

  if (bookingFieldsUnchanged(existing, nextSnapshot)) {
    return {
      ok: true,
      booking_id: bookingId,
      action: "updated",
      lifecycle_event: lifecycleEvent,
      unchanged: true,
    };
  }

  const isCancelled = existing.booking_status === "cancelled" || Boolean(existing.cancelled_at?.trim());

  if (lifecycleEvent === "appointment_cancelled" || targetStatus === "cancelled") {
    await applyTimelyCancellation(supabase, tenantId, bookingId, existing, metadata, ports);
    return {
      ok: true,
      booking_id: bookingId,
      action: "updated",
      lifecycle_event: lifecycleEvent,
    };
  }

  if (isCancelled) {
    await patchTimelyBookingMetadataOnly(supabase, tenantId, bookingId, metadata);
    return {
      ok: true,
      booking_id: bookingId,
      action: "updated",
      lifecycle_event: lifecycleEvent,
      unchanged: true,
    };
  }

  if (lifecycleEvent === "appointment_completed" || targetStatus === "completed") {
    if (existing.booking_status !== "completed") {
      const { completeBooking } = await import("@/src/lib/bookings/server");
      await completeBooking({ tenantId, bookingId }, supabase);
    }
    await patchTimelyBookingMetadataOnly(supabase, tenantId, bookingId, metadata);
    return {
      ok: true,
      booking_id: bookingId,
      action: "updated",
      lifecycle_event: lifecycleEvent,
    };
  }

  await ports.updateBooking(
    {
      tenantId,
      bookingId,
      startAt,
      endAt,
      assignedStaffId: nextAssignedStaffId,
      bookingStatus: targetStatus,
      metadata,
    },
    supabase
  );

  return {
    ok: true,
    booking_id: bookingId,
    action: "updated",
    lifecycle_event: lifecycleEvent,
  };
}

export async function processTimelyAppointmentWebhook(
  tenantId: string,
  payload: TimelyAppointmentPayload,
  client?: SupabaseClient,
  ports: Partial<TimelyAppointmentWebhookPorts> = {}
): Promise<ProcessTimelyAppointmentWebhookResult> {
  const supabase = client ?? supabaseAdmin();
  const mergedPorts = {
    ...getDefaultAppointmentPorts(),
    ...ports,
  };
  const tid = tenantId.trim();

  try {
    await assertTenantExists(supabase, tid);

    const extAppt = payload.external_appointment_id.trim();
    const existingId = await loadExistingBookingMapping(supabase, tid, extAppt);
    if (existingId) {
      const synced = await syncExistingTimelyBooking(supabase, tid, existingId, payload, extAppt, mergedPorts);
      if (!synced.ok) return synced;
      return attachConsultationWorkspaceToTimelyAppointmentResult(supabase, tid, synced, mergedPorts);
    }

    const lifecycleEvent = resolveLifecycleEvent(payload, false);
    if (
      lifecycleEvent !== "appointment_created" &&
      lifecycleEvent !== "appointment_updated" &&
      lifecycleEvent !== "appointment_rescheduled"
    ) {
      return {
        ok: false,
        status: 404,
        message: "Timely appointment not found for lifecycle update",
      };
    }

    const patient = await loadPatientForTimelyExternalId(supabase, tid, payload.external_patient_id.trim());
    if (!patient) {
      return {
        ok: false,
        status: 404,
        message: "Timely patient must be synced before appointment",
      };
    }

    const clinicId = await resolveDefaultClinicId(supabase, tid);

    let bookingType: string;
    try {
      bookingType = await resolveServiceBookingType(supabase, tid, payload.service_name);
    } catch (e) {
      if (e instanceof TimelyWebhookHttpError) {
        return { ok: false, status: e.status, message: e.message };
      }
      throw e;
    }

    const staffList = await mergedPorts.loadActiveStaffForTenant(tid, supabase);
    const staffPick = resolveTimelyStaffIdByName(
      staffList.map((s) => ({ id: s.id, full_name: s.full_name })),
      payload.staff_name
    );
    if (staffPick.ambiguous) {
      return { ok: false, status: 422, message: "Staff not found or ambiguous" };
    }

    let assignedStaffId: string | null = staffPick.staffId;

    const startAt = new Date(payload.start_time.trim()).toISOString();
    const endAt = new Date(payload.end_time.trim()).toISOString();
    const metadata = buildTimelyBookingMetadata(payload, extAppt);
    const mappedStatus = mapTimelyStatusToBookingStatus(payload.status ?? null);
    const initialStatus = mappedStatus ?? "scheduled";

    const titleBase = payload.service_name?.trim() || "Timely appointment";

    const tryCreate = async (staffId: string | null) => {
      return mergedPorts.createBooking(
        {
          tenantId: tid,
          leadId: null,
          personId: patient.person_id,
          patientId: patient.patient_id,
          caseId: null,
          clinicId,
          roomId: null,
          roomRequired: false,
          assignedStaffId: staffId,
          assignedUserId: null,
          bookingType,
          title: titleBase,
          description: payload.notes?.trim() || null,
          startAt,
          endAt,
          timezone: null,
          location: null,
          metadata,
          resourceAssignments: [],
          createdByUserId: null,
        },
        supabase
      );
    };

    let booking;
    try {
      booking = await tryCreate(assignedStaffId);
    } catch (e) {
      if (assignedStaffId && isStaffRetryableError(e)) {
        try {
          booking = await tryCreate(null);
          assignedStaffId = null;
        } catch (e2) {
          if (isModelRequiresStaffError(e2)) {
            return { ok: false, status: 422, message: "Staff not found or ambiguous" };
          }
          throw e2;
        }
      } else {
        if (isModelRequiresStaffError(e)) {
          return { ok: false, status: 422, message: "Staff not found or ambiguous" };
        }
        throw e;
      }
    }

    await insertBookingMapping(supabase, tid, extAppt, booking.id);

    if (initialStatus === "cancelled" || initialStatus === "completed" || initialStatus === "no_show") {
      const synced = await syncExistingTimelyBooking(supabase, tid, booking.id, payload, extAppt, mergedPorts);
      if (!synced.ok) return synced;
      return attachConsultationWorkspaceToTimelyAppointmentResult(supabase, tid, synced, mergedPorts);
    }

    const verify = await loadExistingBookingMapping(supabase, tid, extAppt);
    const finalId = verify ?? booking.id;

    return attachConsultationWorkspaceToTimelyAppointmentResult(
      supabase,
      tid,
      {
        ok: true,
        booking_id: finalId,
        action: "created",
        lifecycle_event: lifecycleEvent,
      },
      mergedPorts
    );
  } catch (e) {
    if (e instanceof TimelyWebhookHttpError) {
      return { ok: false, status: e.status, message: e.message };
    }
    const msg = e instanceof Error ? e.message : "Could not sync booking.";
    return { ok: false, status: 500, message: msg };
  }
}
