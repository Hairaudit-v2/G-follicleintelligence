/**
 * FI-CALENDAR-WRITEBACK-1A — API handlers for CalendarOS operational mutations.
 */
import "server-only";

import { NextResponse } from "next/server";

import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { writebackCalendarOsEvent } from "@/src/lib/calendar/calendarOsWriteback.server";
import {
  linkCalendarOsEventPatient,
  loadCalendarOsPatientMatchSuggestions,
} from "@/src/lib/calendar/calendarOsPatientLink.server";
import { convertExternalCalendarEventToFiosAppointment } from "@/src/lib/calendar/calendarOsConvertExternal.server";
import { searchCalendarIdentityLinkCandidates } from "@/src/lib/calendar/calendarPersonIdentityResolve.server";
import { createAndLinkPatientFromGoogleHydration } from "@/src/lib/calendar/calendarOsCreatePatientFromGoogle.server";
import { resolveDevelopmentClinicAccessForTenant } from "@/src/lib/fiOs/developmentClinicAccess.server";
import {
  resolveCalendarAppointmentCapabilities,
  calendarCapabilitySatisfies,
} from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isFiOsElevatedOsOperatorRole } from "@/src/lib/fiOs/fiOsRoles";

async function resolveActorCaps(tenantId: string) {
  const access = await resolveDevelopmentClinicAccessForTenant(tenantId);
  const elevated =
    access.allowed &&
    (isFiOsElevatedOsOperatorRole(access.fiUserRole) ||
      access.fiUserRole === "fi_admin" ||
      access.fiUserRole === "admin" ||
      access.fiUserRole === "owner");
  const caps = resolveCalendarAppointmentCapabilities({
    canView: true,
    canMutateBookings: access.allowed,
    googleWritebackReady: true,
    isElevatedOperator: Boolean(elevated),
  });
  return { access, caps, actorAuthUserId: await resolveAuthUserId(null) };
}

/** PATCH /api/tenants/[tenantId]/calendar/appointments/[eventId] */
export async function handlePatchCalendarOsAppointment(
  tenantId: string,
  eventId: string,
  request: Request
): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(request, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request });

    const { caps, actorAuthUserId } = await resolveActorCaps(tenantId);
    if (!calendarCapabilitySatisfies(caps, "appointment.edit")) {
      return crmJsonError(403, "No appointment edit permission.");
    }
    if (!calendarCapabilitySatisfies(caps, "calendar.google_writeback")) {
      return crmJsonError(403, "Google write-back capability required.");
    }

    const interactionSource =
      body.interactionSource === "calendar_drag" || body.interactionSource === "calendar_quick_edit"
        ? body.interactionSource
        : "calendar_quick_edit";

    const result = await writebackCalendarOsEvent({
      tenantId,
      eventId,
      interactionSource,
      actingUserId: actorAuthUserId,
      requireEtagMatch: Boolean(body.requireEtagMatch),
      patch: {
        title: body.title != null ? String(body.title) : undefined,
        description: body.description !== undefined ? (body.description as string | null) : undefined,
        location: body.location !== undefined ? (body.location as string | null) : undefined,
        startTime: body.startAt != null ? String(body.startAt) : body.startTime != null ? String(body.startTime) : undefined,
        endTime: body.endAt != null ? String(body.endAt) : body.endTime != null ? String(body.endTime) : undefined,
        eventType: body.eventType !== undefined ? (body.eventType as string | null) : body.procedure != null ? String(body.procedure) : undefined,
        assignedStaffId:
          body.staffId !== undefined
            ? (body.staffId as string | null)
            : body.assignedStaffId !== undefined
              ? (body.assignedStaffId as string | null)
              : undefined,
        clinicId: body.clinicId !== undefined ? (body.clinicId as string | null) : undefined,
        roomId: body.roomId !== undefined ? (body.roomId as string | null) : undefined,
        bookingStatus: body.status !== undefined ? (body.status as string | null) : undefined,
        notes: body.notes !== undefined ? (body.notes as string | null) : undefined,
      },
    });

    if (!result.ok) {
      const status =
        result.code === "concurrent_edit"
          ? 409
          : result.code === "classification_blocked" || result.code === "etag_required"
            ? 400
            : result.code === "not_found"
              ? 404
              : 502;
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          code: result.code,
          writebackStatus: result.writebackStatus,
          googleEventId: result.googleEventId,
          auditId: result.auditId,
        },
        { status }
      );
    }

    return crmJsonOk({
      event: result.event,
      classification: result.classification,
      writebackStatus: result.writebackStatus,
      googleEtag: result.googleEtag,
      auditId: result.auditId,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

/** POST /api/tenants/[tenantId]/calendar/appointments/[eventId]/link-patient */
export async function handleLinkCalendarOsPatient(
  tenantId: string,
  eventId: string,
  request: Request
): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(request, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request });

    const { caps, actorAuthUserId } = await resolveActorCaps(tenantId);
    if (!calendarCapabilitySatisfies(caps, "appointment.link_patient")) {
      return crmJsonError(403, "No patient link permission.");
    }

    const result = await linkCalendarOsEventPatient({
      tenantId,
      eventId,
      patientId: body.patientId != null ? String(body.patientId) : null,
      consultationId: body.consultationId != null ? String(body.consultationId) : null,
      enquiryId: body.enquiryId != null ? String(body.enquiryId) : null,
      confirmed: Boolean(body.confirmed),
      promoteToPatient: Boolean(body.promoteToPatient),
      reviewPossibleDuplicate: Boolean(body.reviewPossibleDuplicate),
      actingUserId: actorAuthUserId,
      actingUserLabel: body.actingUserLabel != null ? String(body.actingUserLabel) : null,
    });

    if (!result.ok) {
      const status =
        result.code === "not_confirmed" ||
        result.code === "invalid_patient" ||
        result.code === "invalid_consultation" ||
        result.code === "identity_conflict"
          ? 400
          : result.code === "not_found"
            ? 404
            : 500;
      return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status });
    }

    return crmJsonOk(result);
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

/** GET /api/tenants/[tenantId]/calendar/appointments/[eventId]/patient-suggestions */
export async function handleCalendarOsPatientSuggestions(
  tenantId: string,
  eventId: string,
  request: Request
): Promise<NextResponse> {
  try {
    const adminKey = extractAdminKeyFromRequest(request, {});
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request });
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || "";

    const [legacy, search] = await Promise.all([
      loadCalendarOsPatientMatchSuggestions({ tenantId, eventId }),
      searchCalendarIdentityLinkCandidates({ tenantId, eventId, query }),
    ]);

    if (!legacy.ok) return crmJsonError(404, legacy.error);
    if (!search.ok) return crmJsonError(404, search.error);

    return crmJsonOk({
      suggestions: legacy.suggestions,
      hydration: legacy.hydration,
      patients: search.patients,
      consultations: search.consultations,
      enquiries: search.enquiries,
      verifiedMatches: search.verifiedMatches,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

/** POST /api/tenants/[tenantId]/calendar/appointments/[eventId]/create-patient-from-google */
export async function handleCreatePatientFromGoogleHydration(
  tenantId: string,
  eventId: string,
  request: Request
): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(request, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request });

    const { caps, actorAuthUserId } = await resolveActorCaps(tenantId);
    if (!calendarCapabilitySatisfies(caps, "appointment.link_patient")) {
      return crmJsonError(403, "No patient link permission.");
    }

    const result = await createAndLinkPatientFromGoogleHydration({
      tenantId,
      eventId,
      confirmed: Boolean(body.confirmed),
      actingUserId: actorAuthUserId,
      actingUserLabel: body.actingUserLabel != null ? String(body.actingUserLabel) : null,
    });

    if (!result.ok) {
      const status =
        result.code === "not_confirmed" || result.code === "missing_hydration"
          ? 400
          : result.code === "not_found"
            ? 404
            : 500;
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code, patientId: result.patientId },
        { status }
      );
    }

    return crmJsonOk(result);
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

/** POST /api/tenants/[tenantId]/calendar/appointments/[eventId]/convert */
export async function handleConvertExternalCalendarEvent(
  tenantId: string,
  eventId: string,
  request: Request
): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(request, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request });

    const { caps, actorAuthUserId } = await resolveActorCaps(tenantId);
    if (!calendarCapabilitySatisfies(caps, "appointment.convert_external")) {
      return crmJsonError(403, "No permission to convert external events.");
    }

    const result = await convertExternalCalendarEventToFiosAppointment({
      tenantId,
      eventId,
      actingUserId: actorAuthUserId,
      actingUserLabel: body.actingUserLabel != null ? String(body.actingUserLabel) : null,
      clinicId: body.clinicId !== undefined ? (body.clinicId as string | null) : undefined,
      assignedStaffId:
        body.assignedStaffId !== undefined
          ? (body.assignedStaffId as string | null)
          : body.staffId !== undefined
            ? (body.staffId as string | null)
            : undefined,
      roomId: body.roomId !== undefined ? (body.roomId as string | null) : undefined,
      promoteConsultationIfNeeded: body.promoteConsultationIfNeeded !== false,
      selectedPatientId: body.selectedPatientId != null ? String(body.selectedPatientId) : null,
      selectedConsultationId:
        body.selectedConsultationId != null ? String(body.selectedConsultationId) : null,
      createNewPatient: Boolean(body.createNewPatient),
      newPatientPersonId: body.newPatientPersonId != null ? String(body.newPatientPersonId) : null,
      idempotencyKey: body.idempotencyKey != null ? String(body.idempotencyKey) : null,
    });

    if (!result.ok) {
      const status =
        result.code === "already_converted" || result.code === "classification_blocked"
          ? 409
          : result.code === "not_found"
            ? 404
            : result.code === "ambiguous_identity" || result.code === "identity_conflict"
              ? 409
              : 400;
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          code: result.code,
          suggestions: result.suggestions,
          identityState: result.identityState,
        },
        { status }
      );
    }

    return crmJsonOk(result);
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
