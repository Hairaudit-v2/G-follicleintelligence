"use server";

import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { createCrmLeadWithPerson } from "@/src/lib/crm/leads";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { endIsoFromStartAndProcedure, servicesByBookingType } from "@/src/lib/bookings/servicesCatalog";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { BOOKING_TYPES, isAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";
import { createBooking } from "@/src/lib/bookings/server";

const procedureSchema = z.enum([...BOOKING_TYPES] as [string, ...string[]]);

const quickCallInBodySchema = z
  .object({
    adminKey: z.string().optional(),
    firstName: z.string().min(1, "First name is required.").max(120),
    surname: z.string().min(1, "Surname is required.").max(120),
    mobile: z.string().min(6, "Mobile is required.").max(40),
    email: z.union([z.string().email(), z.literal("")]).optional(),
    /** UTC instant for booking start */
    startAt: z.string().min(1, "Start time is required."),
    bookingType: procedureSchema.optional(),
    notes: z.string().max(8000).optional().nullable(),
    clinicId: z.string().uuid().optional().nullable(),
    assignedStaffId: z.string().uuid().optional().nullable(),
    assignedUserId: z.string().uuid().optional().nullable(),
    /** Stored on `fi_bookings.timezone` (clinic-local scheduling). */
    calendarTimezone: z.string().min(1).max(128).optional(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export type QuickCallInBookingResult = {
  ok: true;
  leadId: string;
  bookingId: string;
  booking: Awaited<ReturnType<typeof createBooking>>;
} | { ok: false; error: string };

/**
 * Front-desk phone intake: CRM lead (source Phone) + linked consultation booking + reminder sync via {@link createBooking}.
 */
export async function quickCallInConsultationAction(
  tenantId: string,
  body: unknown
): Promise<QuickCallInBookingResult> {
  try {
    const parsed = quickCallInBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const startMs = Date.parse(parsed.startAt.trim());
    if (!Number.isFinite(startMs)) throw new Error("Invalid start time.");

    const bookingType = (parsed.bookingType ?? "consultation").trim();
    if (!isAllowedBookingType(bookingType)) throw new Error("Invalid procedure type.");

    const catalog = servicesByBookingType(await loadFiServicesForTenant(tenantId.trim()));
    const endAt = endIsoFromStartAndProcedure(parsed.startAt.trim(), bookingType, catalog);
    const tz = (parsed.calendarTimezone ?? "Australia/Perth").trim() || "Australia/Perth";

    const displayName = `${parsed.firstName.trim()} ${parsed.surname.trim()}`.trim();
    const summary = `Phone call-in — ${displayName}`;

    const { person } = await resolveOrCreatePerson(
      {
        tenant_id: tenantId.trim(),
        source_system: "fi_phone_call_in",
        display_name: displayName,
        phone: parsed.mobile.trim(),
        email: parsed.email?.trim() || null,
        metadata: {
          first_name: parsed.firstName.trim(),
          surname: parsed.surname.trim(),
        },
      },
      undefined
    );

    const { patient } = await resolveOrCreatePatient(
      {
        tenant_id: tenantId.trim(),
        person_id: person.id,
        source_system: "fi_phone_call_in",
        primary_clinic_id: parsed.clinicId?.trim() || null,
      },
      undefined
    );

    const leadMetadata: Record<string, unknown> = {
      source: "Phone",
      intake_channel: "phone_call_in",
    };

    const lead = await createCrmLeadWithPerson(
      {
        tenantId: tenantId.trim(),
        personId: person.id,
        patientId: patient.id,
        clinicId: parsed.clinicId?.trim() || undefined,
        summary,
        status: "open",
        metadata: leadMetadata,
        pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
      },
      undefined
    );

    const createdByUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const description = [parsed.notes?.trim()].filter(Boolean).join("\n") || null;
    const title = `${bookingType === "consultation" ? "Consultation" : bookingType} — ${displayName}`;

    const booking = await createBooking({
      tenantId: tenantId.trim(),
      leadId: lead.id,
      personId: person.id,
      patientId: patient.id,
      caseId: null,
      clinicId: parsed.clinicId?.trim() || null,
      assignedStaffId: parsed.assignedStaffId?.trim() || null,
      assignedUserId: parsed.assignedUserId?.trim() || null,
      bookingType,
      title,
      description,
      startAt: parsed.startAt.trim(),
      endAt,
      timezone: tz,
      location: null,
      metadata: {
        intake: "phone_call_in",
        procedure_label: bookingType,
      },
      createdByUserId,
    });

    return { ok: true, leadId: lead.id, bookingId: booking.id, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
