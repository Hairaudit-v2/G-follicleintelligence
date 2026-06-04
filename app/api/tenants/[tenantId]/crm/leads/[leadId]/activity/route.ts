/**
 * GET …/activity — activity timeline
 * POST …/activity — append activity event
 */
import { assertCrmTenantReadAllowed, assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { crmAppendActivityBodySchema } from "@/src/lib/crm/crmApiSchemas";
import { appendCrmActivityEvent, loadCrmActivityTimelineForLead } from "@/src/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    const events = await loadCrmActivityTimelineForLead(tenantId, leadId, { limit: Number.isFinite(limit) ? limit : undefined });
    return crmJsonOk({ events });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; leadId: string }> }) {
  try {
    const { tenantId, leadId } = await params;
    if (!tenantId?.trim() || !leadId?.trim()) return crmJsonError(400, "Missing tenantId or leadId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = crmAppendActivityBodySchema.parse(body);

    const event = await appendCrmActivityEvent({
      tenantId,
      leadId,
      activityKind: parsed.activityKind,
      title: parsed.title ?? null,
      detail: parsed.detail ?? null,
      occurredAt: parsed.occurredAt ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
    });

    return crmJsonOk({ event });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
