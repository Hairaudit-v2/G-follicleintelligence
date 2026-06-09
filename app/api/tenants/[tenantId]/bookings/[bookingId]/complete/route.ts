/**
 * POST /api/tenants/[tenantId]/bookings/[bookingId]/complete
 */
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { bookingCompleteBodySchema } from "@/src/lib/bookings/bookingApiSchemas";
import { completeBooking } from "@/src/lib/bookings/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; bookingId: string }> }) {
  try {
    const { tenantId, bookingId } = await params;
    if (!tenantId?.trim() || !bookingId?.trim()) return crmJsonError(400, "Missing tenantId or bookingId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey,
      request: req,
      staffPinFloorAction: "patient.check_in",
    });

    bookingCompleteBodySchema.parse(body);

    const booking = await completeBooking({ tenantId, bookingId });

    return crmJsonOk({ booking });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
