"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { getCrmShellSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  createFollowUpEncounterBodySchema,
  createLegacyReturningPatientBodySchema,
  updateFollowUpEncounterAiReviewBodySchema,
} from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import {
  canApproveAiImagingSummary,
  canCreateFollowUpEncounter,
  normalizeFollowUpRole,
} from "@/src/lib/followUpEncounters/followUpEncounterPermissions";
import {
  createFollowUpEncounter,
  createFollowUpImagingSession,
  createLegacyReturningPatient,
  loadFollowUpEncountersForPatient,
  loadFollowUpImagingSessionsForPatient,
  searchReturningPatients,
  updateImagingSessionAiReview,
} from "@/src/lib/followUpEncounters/followUpEncounterServer";
import { buildFollowUpImagingCaptureHref, buildFollowUpReturnHref } from "@/src/lib/followUpEncounters/followUpImagingRoutes";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function resolveActorRole(tenantId: string): Promise<string> {
  const session = await getCrmShellSessionIfAllowed(tenantId);
  return session?.role ?? "unknown";
}

export async function createLegacyReturningPatientAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      patientId: string;
      personId: string;
      created: boolean;
      duplicatePrevented: boolean;
      duplicateSummary: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = createLegacyReturningPatientBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const role = normalizeFollowUpRole(await resolveActorRole(tenantId));
    if (!canCreateFollowUpEncounter(role, "legacy_follow_up")) {
      return { ok: false, error: "You do not have permission to register returning patients." };
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const result = await createLegacyReturningPatient(tenantId, parsed, actingUserId);
    if (!result.ok) return result;

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/patients`);
    revalidatePath(`/fi-admin/${tid}/patients/${result.patientId}`);
    return result;
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createFollowUpEncounterAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      encounterId: string;
      patientId: string;
      imagingCaptureHref: string | null;
      returnHref: string;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = createFollowUpEncounterBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const role = normalizeFollowUpRole(await resolveActorRole(tenantId));
    if (!canCreateFollowUpEncounter(role, parsed.encounterType)) {
      return { ok: false, error: "You do not have permission to create this follow-up type." };
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const { encounter } = await createFollowUpEncounter(tenantId, parsed, actingUserId);

    let imagingCaptureHref: string | null = null;
    const needsImaging =
      parsed.encounterType === "photos_only" ||
      parsed.encounterType === "legacy_follow_up" ||
      parsed.encounterType === "post_op_review" ||
      parsed.encounterType === "donor_review";

    if (needsImaging) {
      const { sessionId } = await createFollowUpImagingSession(
        tenantId,
        parsed.patientId,
        encounter.id
      );
      imagingCaptureHref = buildFollowUpImagingCaptureHref(
        tenantId,
        parsed.patientId,
        encounter.id,
        sessionId,
        { bookingId: parsed.bookingId }
      );
    }

    const pid = parsed.patientId.trim();
    const returnHref = buildFollowUpReturnHref(tenantId, {
      bookingId: parsed.bookingId,
      patientId: pid,
      encounterId: encounter.id,
    });

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/returning`);
    if (parsed.bookingId) {
      revalidatePath(`/fi-admin/${tid}/calendar`);
      revalidatePath(`/fi-admin/${tid}/appointments`);
    }

    return {
      ok: true,
      encounterId: encounter.id,
      patientId: pid,
      imagingCaptureHref,
      returnHref,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const searchReturningPatientsSchema = z.object({
  query: z.string().min(2).max(120),
});

export async function searchReturningPatientsAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      patients: Awaited<ReturnType<typeof searchReturningPatients>>;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = searchReturningPatientsSchema.parse(body);
    const session = await getCrmShellSessionIfAllowed(tenantId);
    if (!session) return { ok: false, error: "Not authorised for this tenant workspace." };

    const patients = await searchReturningPatients(tenantId, parsed.query);
    return { ok: true, patients };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateFollowUpAiReviewAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateFollowUpEncounterAiReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const role = normalizeFollowUpRole(await resolveActorRole(tenantId));
    if (!canApproveAiImagingSummary(role)) {
      return { ok: false, error: "You do not have permission to approve AI imaging summaries." };
    }

    // Staff ID resolution deferred — use acting user as audit anchor when staff row unavailable
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    if (!actingUserId) {
      return { ok: false, error: "Could not resolve staff identity for audit trail." };
    }

    await updateImagingSessionAiReview(
      tenantId,
      parsed.sessionId,
      parsed.reviewStatus,
      actingUserId,
      parsed.clinicianNote
    );

    revalidatePath(`/fi-admin/${tenantId.trim()}/imaging/review`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadPatientFollowUpImagingSessionsAction(
  tenantId: string,
  patientId: string
): Promise<
  | { ok: true; sessions: Awaited<ReturnType<typeof loadFollowUpImagingSessionsForPatient>> }
  | { ok: false; error: string }
> {
  try {
    const session = await getCrmShellSessionIfAllowed(tenantId);
    if (!session) return { ok: false, error: "Not authorised." };
    const sessions = await loadFollowUpImagingSessionsForPatient(tenantId, patientId);
    return { ok: true, sessions };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadPatientFollowUpEncountersAction(
  tenantId: string,
  patientId: string
): Promise<
  | { ok: true; encounters: Awaited<ReturnType<typeof loadFollowUpEncountersForPatient>> }
  | { ok: false; error: string }
> {
  try {
    const session = await getCrmShellSessionIfAllowed(tenantId);
    if (!session) return { ok: false, error: "Not authorised." };
    const encounters = await loadFollowUpEncountersForPatient(tenantId, patientId);
    return { ok: true, encounters };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadBookingFollowUpContextAction(
  tenantId: string,
  bookingId: string
): Promise<
  | {
      ok: true;
      context: {
        booking: {
          id: string;
          booking_type: string;
          booking_status: string;
          start_at: string;
          end_at: string;
          patient_id: string | null;
          title: string | null;
        };
        prefill: import("@/src/lib/followUpEncounters/bookingFollowUpContextCore").BookingFollowUpPrefill;
        continuityStatus: import("@/src/lib/followUpEncounters/bookingFollowUpContextCore").BookingContinuityStatus | null;
        continuityLabel: string | null;
        matchedPatientId: string | null;
        duplicatePrevented: boolean;
        duplicateSummary: string | null;
        encountersForBooking: Awaited<ReturnType<typeof loadFollowUpEncountersForPatient>>;
      };
    }
  | { ok: false; error: string }
> {
  try {
    const session = await getCrmShellSessionIfAllowed(tenantId);
    if (!session) return { ok: false, error: "Not authorised." };

    const { loadBookingFollowUpContext } = await import(
      "@/src/lib/followUpEncounters/bookingFollowUpContext.server"
    );
    const ctx = await loadBookingFollowUpContext(tenantId, bookingId);
    if (!ctx) return { ok: false, error: "Booking not found." };

    return {
      ok: true,
      context: {
        booking: {
          id: ctx.booking.id,
          booking_type: ctx.booking.booking_type,
          booking_status: ctx.booking.booking_status,
          start_at: ctx.booking.start_at,
          end_at: ctx.booking.end_at,
          patient_id: ctx.booking.patient_id,
          title: ctx.booking.title,
        },
        prefill: ctx.prefill,
        continuityStatus: ctx.continuityStatus,
        continuityLabel: ctx.continuityLabel,
        matchedPatientId: ctx.matchedPatientId,
        duplicatePrevented: ctx.duplicatePrevented,
        duplicateSummary: ctx.duplicateSummary,
        encountersForBooking: ctx.encountersForBooking,
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
