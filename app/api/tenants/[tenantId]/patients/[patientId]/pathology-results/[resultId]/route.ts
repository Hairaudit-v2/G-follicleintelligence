/**
 * PATCH /api/tenants/[tenantId]/patients/[patientId]/pathology-results/[resultId]
 * JSON body: discriminated union save_draft | mark_reviewed | archive
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmJsonError, crmJsonOk, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { patchPathologyResultBodySchema } from "@/src/lib/pathology/pathologyResultApiSchemas";
import { archivePathologyResult, markPathologyResultReviewed, patchPathologyResultDraft } from "@/src/lib/pathology/pathologyResultMutations.server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string; resultId: string }> }
) {
  try {
    const { tenantId, patientId, resultId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !resultId?.trim()) {
      return crmJsonError(400, "Missing tenantId, patientId, or resultId.");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = patchPathologyResultBodySchema.safeParse(body);
    if (!parsed.success) {
      return crmJsonError(400, parsed.error.issues.map((i) => i.message).join(" ") || "Invalid body.");
    }

    const tid = tenantId.trim();
    const pid = patientId.trim();
    const rid = resultId.trim();
    const actingUserId = await tryResolveFiUserIdForTenant(tid, req);

    if (parsed.data.action === "save_draft") {
      const out = await patchPathologyResultDraft(tid, pid, rid, {
        resultDate: parsed.data.result_date.trim(),
        providerName: parsed.data.provider_name?.trim() ? parsed.data.provider_name.trim() : null,
        pathologyRequestId: parsed.data.pathology_request_id ?? null,
        clinicalSummary: parsed.data.clinical_summary?.trim() ? parsed.data.clinical_summary.trim() : null,
        items: parsed.data.items.map((i) => ({
          test_code: i.test_code ?? null,
          test_label: i.test_label,
          result_value: i.result_value ?? "",
          result_unit: i.result_unit ?? null,
          reference_range: i.reference_range ?? null,
          flag: i.flag,
        })),
      });
      return crmJsonOk({
        pathology_result: out.result,
        items: out.items,
        linked_request: out.linkedRequest,
      });
    }

    if (parsed.data.action === "mark_reviewed") {
      const result = await markPathologyResultReviewed(tid, pid, rid, parsed.data.clinical_summary ?? null, actingUserId);
      return crmJsonOk({ pathology_result: result });
    }

    const result = await archivePathologyResult(tid, pid, rid);
    return crmJsonOk({ pathology_result: result });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
