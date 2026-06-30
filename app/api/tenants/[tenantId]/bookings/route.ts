/**
 * GET /api/tenants/[tenantId]/bookings?start=&end=
 * POST /api/tenants/[tenantId]/bookings
 */
import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  bookingCreateBodySchema,
  bookingListQuerySchema,
} from "@/src/lib/bookings/bookingApiSchemas";
import { createBooking, loadBookingsForTenantRange } from "@/src/lib/bookings/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const url = new URL(req.url);
    const parsed = bookingListQuerySchema.parse({
      start: url.searchParams.get("start") ?? "",
      end: url.searchParams.get("end") ?? "",
    });

    const bookings = await loadBookingsForTenantRange(tenantId, parsed.start, parsed.end);
    return crmJsonOk({ bookings });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey,
      request: req,
      staffPinFloorAction: "calendar.quick_book",
    });

    const parsed = bookingCreateBodySchema.parse(body);
    const createdByUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const booking = await createBooking({
      tenantId,
      leadId: parsed.leadId ?? null,
      personId: parsed.personId ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      clinicId: parsed.clinicId ?? null,
      roomId: parsed.roomId ?? null,
      roomRequired: parsed.roomRequired,
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
      resourceAssignments: parsed.resourceAssignments,
      createdByUserId,
    });

    return crmJsonOk({ booking });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
