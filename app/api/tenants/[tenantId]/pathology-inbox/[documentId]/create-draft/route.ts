/**
 * POST /api/tenants/[tenantId]/pathology-inbox/[documentId]/create-draft
 * Create draft pathology result from extracted markers (patient must be matched).
 */
import { z } from "zod";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { createDraftPathologyResultFromExtraction } from "@/src/lib/pathology/pathologyAutoDraftResult.server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  result_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "result_date must be YYYY-MM-DD.")
    .optional(),
  provider_name: z.string().trim().optional().nullable(),
  clinical_summary: z.string().trim().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; documentId: string }> }
) {
  try {
    const { tenantId, documentId } = await params;
    if (!tenantId?.trim() || !documentId?.trim()) {
      return crmJsonError(400, "Missing tenantId or documentId.");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return crmJsonError(
        400,
        parsed.error.issues.map((i) => i.message).join(" ") || "Invalid body."
      );
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);
    const out = await createDraftPathologyResultFromExtraction({
      tenantId: tenantId.trim(),
      documentId: documentId.trim(),
      actingUserId,
      resultDate: parsed.data.result_date,
      providerName: parsed.data.provider_name ?? null,
      clinicalSummary: parsed.data.clinical_summary ?? null,
    });

    return crmJsonOk({
      document: out.inbound,
      pathology_result_id: out.resultId,
      created: out.created,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
