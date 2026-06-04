"use server";

import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  bookingCancelBodySchema,
  bookingCompleteBodySchema,
  bookingCreateBodySchema,
  bookingUpdateBodySchema,
} from "@/src/lib/bookings/bookingApiSchemas";
import { cancelBooking, completeBooking, createBooking, updateBooking } from "@/src/lib/bookings/server";
import { ZodError } from "zod";

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
