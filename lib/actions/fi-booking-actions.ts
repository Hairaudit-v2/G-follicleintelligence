"use server";

import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  bookingCancelBodySchema,
  bookingCompleteBodySchema,
  bookingCreateBodySchema,
  bookingUpdateBodySchema,
} from "@/src/lib/bookings/bookingApiSchemas";
import {
  markInstructionsSent,
  mergeAppointmentProcedureMetadata,
  type AppointmentProcedureMetadata,
} from "@/src/lib/bookings/appointmentMetadata";
import { loadAppointmentSlideOverPayload } from "@/src/lib/bookings/appointmentSlideOverLoader";
import type { AppointmentSlideOverPayload } from "@/src/lib/bookings/appointmentSlideOverLoader";
import { loadBookingForTenant } from "@/src/lib/bookings/bookings";
import { cancelBooking, completeBooking, createBooking, updateBooking } from "@/src/lib/bookings/server";
import { getCrmShellSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadCrmLeadById, appendCrmActivityEvent } from "@/src/lib/crm/server";
import { z, ZodError } from "zod";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function createBookingAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof createBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = bookingCreateBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const createdByUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const booking = await createBooking({
      tenantId,
      leadId: parsed.leadId ?? null,
      personId: parsed.personId ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      clinicId: parsed.clinicId ?? null,
      assignedStaffId: parsed.assignedStaffId ?? null,
      assignedUserId: parsed.assignedUserId ?? null,
      bookingType: parsed.bookingType,
      title: parsed.title ?? null,
      description: parsed.description ?? null,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      timezone: parsed.timezone ?? null,
      location: parsed.location ?? null,
      metadata: parsed.metadata ?? {},
      createdByUserId,
    });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateBookingAction(
  tenantId: string,
  bookingId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof updateBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = bookingUpdateBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const booking = await updateBooking({
      tenantId,
      bookingId,
      leadId: parsed.leadId,
      personId: parsed.personId,
      patientId: parsed.patientId,
      caseId: parsed.caseId,
      clinicId: parsed.clinicId,
      assignedStaffId: parsed.assignedStaffId,
      assignedUserId: parsed.assignedUserId,
      bookingType: parsed.bookingType ?? undefined,
      bookingStatus: parsed.bookingStatus ?? undefined,
      title: parsed.title,
      description: parsed.description,
      startAt: parsed.startAt ?? undefined,
      endAt: parsed.endAt ?? undefined,
      timezone: parsed.timezone,
      location: parsed.location,
      metadata: parsed.metadata ?? undefined,
    });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelBookingAction(
  tenantId: string,
  bookingId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof cancelBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = bookingCancelBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const cancelledByUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const booking = await cancelBooking({
      tenantId,
      bookingId,
      cancellationReason: parsed.cancellationReason ?? null,
      cancelledByUserId,
    });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function completeBookingAction(
  tenantId: string,
  bookingId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof completeBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = bookingCompleteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const booking = await completeBooking({ tenantId, bookingId });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const appointmentSlideOverLoadSchema = z.object({
  tenantId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

export async function loadAppointmentSlideOverBundleAction(
  tenantId: string,
  appointmentId: string
): Promise<{ ok: true; data: AppointmentSlideOverPayload } | { ok: false; error: string }> {
  try {
    const parsed = appointmentSlideOverLoadSchema.parse({ tenantId, appointmentId });
    const session = await getCrmShellSessionIfAllowed(parsed.tenantId);
    if (!session) return { ok: false, error: "Not signed in or CRM access denied for this tenant." };
    const data = await loadAppointmentSlideOverPayload(parsed.tenantId, parsed.appointmentId);
    if (!data) return { ok: false, error: "Appointment not found." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const appointmentProcedurePatchSchema = z
  .object({
    adminKey: z.string().optional(),
    graftCountEstimate: z.string().max(200).optional().nullable(),
    donorArea: z.string().max(500).optional().nullable(),
    technique: z.string().max(200).optional().nullable(),
    specialInstructions: z.string().max(4000).optional().nullable(),
    surgeonUserId: z.string().uuid().optional().nullable(),
    consultantUserId: z.string().uuid().optional().nullable(),
    techUserId: z.string().uuid().optional().nullable(),
  })
  .strict();

export async function updateAppointmentProcedureAction(
  tenantId: string,
  appointmentId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof updateBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = appointmentProcedurePatchSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const existing = await loadBookingForTenant(tenantId, appointmentId);
    if (!existing) return { ok: false, error: "Appointment not found." };
    const patch: Partial<AppointmentProcedureMetadata> = {};
    if (parsed.graftCountEstimate !== undefined) patch.graft_count_estimate = parsed.graftCountEstimate;
    if (parsed.donorArea !== undefined) patch.donor_area = parsed.donorArea;
    if (parsed.technique !== undefined) patch.technique = parsed.technique;
    if (parsed.specialInstructions !== undefined) patch.special_instructions = parsed.specialInstructions;
    if (parsed.surgeonUserId !== undefined) patch.surgeon_user_id = parsed.surgeonUserId;
    if (parsed.consultantUserId !== undefined) patch.consultant_user_id = parsed.consultantUserId;
    if (parsed.techUserId !== undefined) patch.tech_user_id = parsed.techUserId;
    const metadata = mergeAppointmentProcedureMetadata(existing.metadata ?? {}, patch);
    const booking = await updateBooking({
      tenantId,
      bookingId: appointmentId,
      leadId: existing.lead_id,
      personId: existing.person_id,
      patientId: existing.patient_id,
      caseId: existing.case_id,
      metadata,
    });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function linkAppointmentPatientFromLeadAction(
  tenantId: string,
  appointmentId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof updateBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = z.object({ adminKey: z.string().optional() }).strict().parse(body ?? {});
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const existing = await loadBookingForTenant(tenantId, appointmentId);
    if (!existing) return { ok: false, error: "Appointment not found." };
    const lid = existing.lead_id?.trim();
    if (!lid) return { ok: false, error: "This appointment has no linked lead." };
    const lead = await loadCrmLeadById(lid, tenantId);
    if (!lead) return { ok: false, error: "Lead not found." };
    const pid = lead.patient_id?.trim();
    if (!pid) {
      return { ok: false, error: "Convert the lead to a patient first, then link the appointment." };
    }
    if (existing.patient_id === pid) return { ok: true, booking: existing };
    const booking = await updateBooking({
      tenantId,
      bookingId: appointmentId,
      leadId: existing.lead_id,
      personId: existing.person_id ?? lead.person_id,
      patientId: pid,
      caseId: existing.case_id,
    });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const sendInstructionsSchema = z
  .object({
    adminKey: z.string().optional(),
    kind: z.enum(["pre_op", "post_op"]),
  })
  .strict();

export async function sendAppointmentInstructionsAction(
  tenantId: string,
  appointmentId: string,
  body: unknown
): Promise<{ ok: true; booking: Awaited<ReturnType<typeof updateBooking>> } | { ok: false; error: string }> {
  try {
    const parsed = sendInstructionsSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const existing = await loadBookingForTenant(tenantId, appointmentId);
    if (!existing) return { ok: false, error: "Appointment not found." };
    const label = parsed.kind === "pre_op" ? "Pre-op instructions" : "Post-op instructions";
    const metadata = markInstructionsSent(existing.metadata ?? {}, parsed.kind);
    if (existing.lead_id?.trim()) {
      await appendCrmActivityEvent({
        tenantId,
        leadId: existing.lead_id.trim(),
        activityKind: "appointment.instructions_sent",
        title: label,
        detail: { appointmentId: existing.id, kind: parsed.kind },
        patientId: existing.patient_id,
        caseId: existing.case_id,
      });
    }
    const booking = await updateBooking({
      tenantId,
      bookingId: appointmentId,
      leadId: existing.lead_id,
      personId: existing.person_id,
      patientId: existing.patient_id,
      caseId: existing.case_id,
      metadata,
    });
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
