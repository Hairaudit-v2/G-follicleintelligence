import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  isStaffUatFrictionType,
  normalizeStaffUatRating,
  type StaffUatFrictionEvent,
} from "@/src/lib/fiOs/staffUatFrictionCore";
import {
  persistStaffUatFeedback,
  persistStaffUatFriction,
} from "@/src/lib/fiOs/staffUatTelemetry.server";

export const dynamic = "force-dynamic";

type TelemetryBody = {
  kind?: string;
  route?: string;
  role?: string;
  screenKey?: string | null;
  rating?: number;
  comment?: string | null;
  frictionType?: string;
  detail?: string | null;
  payload?: Record<string, unknown>;
};

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const body = (await req.json()) as TelemetryBody;
    const kind = String(body.kind ?? "").trim();
    const route = String(body.route ?? "").trim();
    const role = String(body.role ?? "staff").trim() || "staff";

    if (!route) return crmJsonError(400, "route is required.");

    if (kind === "feedback") {
      const rating = normalizeStaffUatRating(body.rating);
      if (!rating) return crmJsonError(400, "rating must be 1–5.");
      const result = await persistStaffUatFeedback({
        tenantId: tenantId.trim(),
        route,
        role,
        screenKey: body.screenKey ?? null,
        rating,
        comment: body.comment ?? null,
      });
      return crmJsonOk({ stored: result.ok });
    }

    if (kind === "friction") {
      const frictionType = String(body.frictionType ?? "").trim();
      if (!isStaffUatFrictionType(frictionType)) {
        return crmJsonError(400, "Invalid frictionType.");
      }
      const event: StaffUatFrictionEvent = {
        frictionType,
        route,
        role,
        screenKey: body.screenKey ?? null,
        detail: body.detail ?? null,
        payload: body.payload,
        occurredAt: new Date().toISOString(),
      };
      const result = await persistStaffUatFriction(tenantId.trim(), event);
      return crmJsonOk({ stored: result.ok });
    }

    return crmJsonError(400, "kind must be feedback or friction.");
  } catch (e) {
    return mapCrmRouteError(e);
  }
}