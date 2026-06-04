/**
 * PATCH /api/tenants/[tenantId]/bookings/[bookingId]
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { bookingUpdateBodySchema } from "@/src/lib/bookings/bookingApiSchemas";
import { updateBooking } from "@/src/lib/bookings/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string; bookingId: string }> }) {
  try {
    const { tenantId, bookingId } = await params;
    if (!tenantId?.trim() || !bookingId?.trim()) return crmJsonError(400, "Missing tenantId or bookingId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = bookingUpdateBodySchema.parse(body);

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

    return crmJsonOk({ booking });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
