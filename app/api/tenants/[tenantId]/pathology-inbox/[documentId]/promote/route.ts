/**
 * POST /api/tenants/[tenantId]/pathology-inbox/[documentId]/promote
 * Body JSON: { status: "draft"|"reviewed", result_date?, provider_name?, clinical_summary?, items? }
 */
import { z } from "zod";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { promoteInboundPathologyDocument } from "@/src/lib/pathology/pathologyInboxMutations.server";
import { pathologyResultItemInputSchema } from "@/src/lib/pathology/pathologyResultApiSchemas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(["draft", "reviewed"]).default("draft"),
  result_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "result_date must be YYYY-MM-DD.")
    .optional(),
  provider_name: z.string().trim().optional().nullable(),
  clinical_summary: z.string().trim().optional().nullable(),
  patient_id: z.string().trim().optional(),
  items: z.array(pathologyResultItemInputSchema).optional(),
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return crmJsonError(400, "Invalid JSON body.");
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
    const resultDate =
      parsed.data.result_date?.trim() ||
      new Date().toISOString().slice(0, 10);

    const out = await promoteInboundPathologyDocument({
      tenantId: tenantId.trim(),
      documentId: documentId.trim(),
      patientId: parsed.data.patient_id,
      resultDate,
      providerName: parsed.data.provider_name ?? null,
      clinicalSummary: parsed.data.clinical_summary ?? null,
      status: parsed.data.status,
      items: (parsed.data.items ?? []).map((i) => ({
        test_code: i.test_code ?? null,
        test_label: i.test_label,
        result_value: i.result_value ?? "",
        result_unit: i.result_unit ?? null,
        reference_range: i.reference_range ?? null,
        flag: i.flag,
      })),
      actingUserId,
    });

    return crmJsonOk({
      document: out.inbound,
      pathology_result_id: out.resultId,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
