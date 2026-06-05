/**
 * PATCH /api/tenants/[tenantId]/appointments/[appointmentId]
 *
 * Reschedule / reassign calendar appointments (drag-and-drop, provider change).
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import {
  appointmentRescheduleBodySchema,
  procedureDetailsToMetadata,
  resolveProviderId,
} from "@/src/lib/bookings/appointmentApiSchemas";
import { AppointmentConflictError, rescheduleCalendarAppointment } from "@/src/lib/bookings/appointmentsApi";
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
  return mapCrmRouteError(e);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; appointmentId: string }> }
) {
  try {
    const { tenantId, appointmentId } = await params;
    if (!tenantId?.trim() || !appointmentId?.trim()) {
      return crmJsonError(400, "Missing tenantId or appointmentId.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = appointmentRescheduleBodySchema.parse(body);
    const providerId = resolveProviderId(parsed);
    const procedureMeta = procedureDetailsToMetadata(parsed.procedureDetails);

    const appointment = await rescheduleCalendarAppointment({
      tenantId,
      appointmentId,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      providerId,
      clinicId: parsed.clinicId,
      procedure: parsed.procedure,
      status: parsed.status,
      title: parsed.title,
      location: parsed.location,
      metadata: parsed.metadata,
      procedureMetadataPatch: procedureMeta,
      skipAvailabilityCheck: parsed.skipAvailabilityCheck,
    });

    return crmJsonOk({ appointment });
  } catch (e) {
    return mapAppointmentRouteError(e);
  }
}
