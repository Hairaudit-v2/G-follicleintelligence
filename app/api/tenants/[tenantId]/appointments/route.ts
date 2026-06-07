/**
 * GET  /api/tenants/[tenantId]/appointments?date=&provider=&procedure=
 * POST /api/tenants/[tenantId]/appointments
 *
 * Calendar-first appointment API for Evolved Hair Clinics (PRP, transplant, consults).
 */
import { assertCrmTenantReadAllowed, assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import {
  appointmentCreateBodySchema,
  parseAppointmentListQuery,
  procedureDetailsToMetadata,
  resolveProviderId,
} from "@/src/lib/bookings/appointmentApiSchemas";
import {
  AppointmentConflictError,
  AppointmentStaffHoursError,
  createCalendarAppointment,
  listCalendarAppointments,
} from "@/src/lib/bookings/appointmentsApi";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function mapAppointmentRouteError(e: unknown): NextResponse {
  if (e instanceof AppointmentConflictError) {
    return NextResponse.json(
      {
        ok: false,
        error: e.message,
        conflictingAppointmentId: e.conflictingBookingId,
      },
      { status: 409 }
    );
  }
  if (e instanceof AppointmentStaffHoursError) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
  return mapCrmRouteError(e);
}

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const url = new URL(req.url);
    const query = parseAppointmentListQuery(url.searchParams);

    const { date, appointments } = await listCalendarAppointments({
      tenantId,
      date: query.date,
      staffId: query.staff,
      providerId: query.staff ? null : query.provider,
      procedure: query.procedure,
      clinicId: query.clinicId,
      includeCancelled: query.includeCancelled,
    });

    return crmJsonOk({
      date,
      providerId: query.provider ?? null,
      staffId: query.staff ?? null,
      appointments,
    });
  } catch (e) {
    return mapAppointmentRouteError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = appointmentCreateBodySchema.parse(body);
    const createdByUserId = await tryResolveFiUserIdForTenant(tenantId, req);
    const providerId = parsed.staffId?.trim() ? undefined : resolveProviderId(parsed);
    const procedureMeta = procedureDetailsToMetadata(parsed.procedureDetails);

    const appointment = await createCalendarAppointment({
      tenantId,
      procedure: parsed.procedure,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      ...(parsed.staffId !== undefined ? { assignedStaffId: parsed.staffId } : {}),
      providerId: providerId ?? null,
      clinicId: parsed.clinicId ?? null,
      leadId: parsed.leadId ?? null,
      personId: parsed.personId ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      title: parsed.title ?? null,
      description: parsed.description ?? null,
      timezone: parsed.timezone ?? null,
      location: parsed.location ?? null,
      status: parsed.status,
      metadata: parsed.metadata,
      procedureMetadataPatch: procedureMeta,
      createdByUserId,
      skipAvailabilityCheck: parsed.skipAvailabilityCheck,
    });

    return crmJsonOk({ appointment }, 201);
  } catch (e) {
    return mapAppointmentRouteError(e);
  }
}
