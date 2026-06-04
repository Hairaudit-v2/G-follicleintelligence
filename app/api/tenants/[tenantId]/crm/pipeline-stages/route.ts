/**
 * GET /api/tenants/[tenantId]/crm/pipeline-stages
 * Lazy-seeds default stages when none exist for the scope (first read).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { crmPipelineStagesQuerySchema } from "@/src/lib/crm/crmApiSchemas";
import { ensureDefaultPipelineStages } from "@/src/lib/crm/server";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { normaliseOrgClinicScope } from "@/src/lib/crm/scope";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const url = new URL(req.url);
    const parsed = crmPipelineStagesQuerySchema.parse({
      organisationId: url.searchParams.get("organisationId"),
      clinicId: url.searchParams.get("clinicId"),
      pipelineKey: url.searchParams.get("pipelineKey"),
    });

    const { organisationId, clinicId } = normaliseOrgClinicScope({
      organisationId: parsed.organisationId ?? undefined,
      clinicId: parsed.clinicId ?? undefined,
    });

    const pipelineKey = (parsed.pipelineKey?.trim() || DEFAULT_CRM_PIPELINE_KEY).trim() || DEFAULT_CRM_PIPELINE_KEY;

    const { stages } = await ensureDefaultPipelineStages({
      tenantId,
      organisationId,
      clinicId,
      pipelineKey,
    });

    return crmJsonOk({ stages });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
