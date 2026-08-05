/**
 * Canonical clinic identity for appointments / bookings (FI-CALENDAR-CLINIC-ALLOCATION-FIX-1A).
 *
 * Prefer the explicit appointment clinic (`fi_bookings.clinic_id` / `clinicId`).
 * Staff and room clinics are guarded legacy fallbacks only — they never override an
 * explicit appointment clinic. Cross-tenant (or otherwise disallowed) clinic ids are
 * rejected and do not fall through to another source when the explicit value was bad.
 */

export type ResolveAppointmentClinicIdInput = {
  /** Canonical: `fi_bookings.clinic_id` / API `clinicId`. */
  appointmentClinicId?: string | null;
  /** Alias / legacy location identity when stored separately (same tenant). */
  appointmentLocationId?: string | null;
  consultationClinicId?: string | null;
  /** Enquiry / CRM lead `clinic_id`. */
  enquiryClinicId?: string | null;
  /** Patient-selected or `fi_patients.primary_clinic_id`. */
  patientSelectedClinicId?: string | null;
  /** Legacy: room's `fi_clinic_rooms.clinic_id`. */
  roomClinicId?: string | null;
  /** Legacy: staff `primary_clinic_id` (lowest precedence). */
  staffClinicId?: string | null;
};

export type ResolveAppointmentClinicIdOptions = {
  /**
   * When set, only ids in this set are accepted (tenant-safe clinic list).
   * An explicit appointment / location id that is not allowed yields `null`
   * (rejected — no silent fall-through to room/staff).
   */
  allowedClinicIds?: ReadonlySet<string> | readonly string[] | null;
};

export type AppointmentClinicSource =
  | "appointment_clinic_id"
  | "appointment_location_id"
  | "consultation_clinic_id"
  | "enquiry_clinic_id"
  | "patient_selected_clinic_id"
  | "room_clinic_id"
  | "staff_clinic_id";

export type ResolveAppointmentClinicIdResult = {
  clinicId: string | null;
  source: AppointmentClinicSource | null;
};

function normId(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t || null;
}

function asAllowedSet(
  allowed: ResolveAppointmentClinicIdOptions["allowedClinicIds"]
): ReadonlySet<string> | null {
  if (allowed == null) return null;
  if (allowed instanceof Set) return allowed;
  return new Set(
    Array.from(allowed)
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

const SOURCE_ORDER: Array<{
  key: keyof ResolveAppointmentClinicIdInput;
  source: AppointmentClinicSource;
  explicit: boolean;
}> = [
  { key: "appointmentClinicId", source: "appointment_clinic_id", explicit: true },
  { key: "appointmentLocationId", source: "appointment_location_id", explicit: true },
  { key: "consultationClinicId", source: "consultation_clinic_id", explicit: false },
  { key: "enquiryClinicId", source: "enquiry_clinic_id", explicit: false },
  { key: "patientSelectedClinicId", source: "patient_selected_clinic_id", explicit: false },
  { key: "roomClinicId", source: "room_clinic_id", explicit: false },
  { key: "staffClinicId", source: "staff_clinic_id", explicit: false },
];

/**
 * Shared precedence for appointment clinic identity.
 * Returns the first present candidate; with `allowedClinicIds`, rejects out-of-tenant ids.
 */
export function resolveAppointmentClinicIdDetailed(
  input: ResolveAppointmentClinicIdInput,
  opts?: ResolveAppointmentClinicIdOptions
): ResolveAppointmentClinicIdResult {
  const allowed = asAllowedSet(opts?.allowedClinicIds ?? null);

  for (const step of SOURCE_ORDER) {
    const id = normId(input[step.key]);
    if (!id) continue;
    if (allowed && !allowed.has(id)) {
      // Explicit assignment outside the tenant must not fall through to room/staff.
      if (step.explicit) return { clinicId: null, source: null };
      continue;
    }
    return { clinicId: id, source: step.source };
  }

  return { clinicId: null, source: null };
}

/** Convenience wrapper — clinic id only (same precedence as detailed). */
export function resolveAppointmentClinicId(
  input: ResolveAppointmentClinicIdInput,
  opts?: ResolveAppointmentClinicIdOptions
): string | null {
  return resolveAppointmentClinicIdDetailed(input, opts).clinicId;
}

/** Map a booking + optional related clinic ids into the shared resolver. */
export function resolveClinicIdForBookingRow(
  booking: {
    clinic_id?: string | null;
    room_id?: string | null;
    assigned_staff_id?: string | null;
  },
  related?: {
    roomClinicId?: string | null;
    staffClinicId?: string | null;
    enquiryClinicId?: string | null;
    consultationClinicId?: string | null;
    patientSelectedClinicId?: string | null;
    appointmentLocationId?: string | null;
    allowedClinicIds?: ResolveAppointmentClinicIdOptions["allowedClinicIds"];
  }
): ResolveAppointmentClinicIdResult {
  return resolveAppointmentClinicIdDetailed(
    {
      appointmentClinicId: booking.clinic_id,
      appointmentLocationId: related?.appointmentLocationId,
      consultationClinicId: related?.consultationClinicId,
      enquiryClinicId: related?.enquiryClinicId,
      patientSelectedClinicId: related?.patientSelectedClinicId,
      roomClinicId: related?.roomClinicId,
      staffClinicId: related?.staffClinicId,
    },
    { allowedClinicIds: related?.allowedClinicIds }
  );
}
