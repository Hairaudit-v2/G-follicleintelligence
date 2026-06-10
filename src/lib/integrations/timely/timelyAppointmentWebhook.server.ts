import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CreateBookingParams } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { z } from "zod";
import type { timelyAppointmentWebhookSchema } from "./timelyWebhookSchemas";
import { TimelyWebhookHttpError } from "./timelyWebhookHttp.server";

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

export type ProcessTimelyAppointmentWebhookResult =
  | { ok: true; booking_id: string; duplicate?: boolean }
  | { ok: false; status: number; message: string };

export type TimelyAppointmentWebhookPorts = {
  createBooking: (params: CreateBookingParams, client?: SupabaseClient) => Promise<FiBookingRow>;
  loadActiveStaffForTenant: (
    tenantId: string,
    client?: SupabaseClient
  ) => Promise<{ id: string; full_name: string }[]>;
};

function getDefaultAppointmentPorts(): TimelyAppointmentWebhookPorts {
  return {
    createBooking: async (params, client) => {
      const { createBooking } = await import("@/src/lib/bookings/server");
      return createBooking(params, client);
    },
    loadActiveStaffForTenant: async (tenantId, client) => {
      const { loadActiveStaffForTenant } = await import("@/src/lib/staff/staff.server");
      return loadActiveStaffForTenant(tenantId, client);
    },
  };
}

export async function processTimelyAppointmentWebhook(
  tenantId: string,
  payload: TimelyAppointmentPayload,
  client?: SupabaseClient,
  ports: Partial<TimelyAppointmentWebhookPorts> = {}
): Promise<ProcessTimelyAppointmentWebhookResult> {
  const supabase = client ?? supabaseAdmin();
  const { createBooking: createBookingFn, loadActiveStaffForTenant: loadStaffFn } = {
    ...getDefaultAppointmentPorts(),
    ...ports,
  };
  const tid = tenantId.trim();

  try {
    await assertTenantExists(supabase, tid);

    const extAppt = payload.external_appointment_id.trim();
    const existingId = await loadExistingBookingMapping(supabase, tid, extAppt);
    if (existingId) {
      return { ok: true, booking_id: existingId, duplicate: true };
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

    const staffList = await loadStaffFn(tid, supabase);
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

    const metadata: Record<string, unknown> = {
      source_system: SOURCE,
      external_appointment_id: extAppt,
      external_patient_id: payload.external_patient_id.trim(),
      ...(payload.service_name?.trim() ? { service_name: payload.service_name.trim() } : {}),
      ...(payload.staff_name?.trim() ? { staff_name: payload.staff_name.trim() } : {}),
      ...(payload.notes != null && String(payload.notes).trim() ? { notes: String(payload.notes).trim() } : {}),
      ...(payload.status?.trim() ? { original_status: payload.status.trim() } : {}),
    };

    const titleBase = payload.service_name?.trim() || "Timely appointment";

    const tryCreate = async (staffId: string | null) => {
      return createBookingFn(
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

    const verify = await loadExistingBookingMapping(supabase, tid, extAppt);
    const finalId = verify ?? booking.id;

    return { ok: true, booking_id: finalId };
  } catch (e) {
    if (e instanceof TimelyWebhookHttpError) {
      return { ok: false, status: e.status, message: e.message };
    }
    const msg = e instanceof Error ? e.message : "Could not create booking.";
    return { ok: false, status: 500, message: msg };
  }
}
