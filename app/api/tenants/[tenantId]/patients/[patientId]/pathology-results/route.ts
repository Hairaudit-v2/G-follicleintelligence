/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/pathology-results
 * multipart/form-data: result_date, provider_name, pathology_request_id (optional), clinical_summary (optional),
 * status (draft|reviewed), items (JSON string), file (optional PDF), adminKey (optional)
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  createPathologyResultFormSchema,
  pathologyResultItemInputSchema,
} from "@/src/lib/pathology/pathologyResultApiSchemas";
import { createPathologyResult } from "@/src/lib/pathology/pathologyResultMutations.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim())
      return crmJsonError(400, "Missing tenantId or patientId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const form = await req.formData();
    const adminKey = extractAdminKeyFromRequest(req, { adminKey: form.get("adminKey") });
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const resultDate = form.get("result_date");
    const providerName = form.get("provider_name");
    const pathologyRequestId = form.get("pathology_request_id");
    const clinicalSummary = form.get("clinical_summary");
    const statusRaw = form.get("status");
    const itemsRaw = form.get("items");

    let itemsParsed: unknown = [];
    if (itemsRaw != null && String(itemsRaw).trim()) {
      try {
        itemsParsed = JSON.parse(String(itemsRaw));
      } catch {
        return crmJsonError(400, "items must be valid JSON.");
      }
    }
    const itemsArr = Array.isArray(itemsParsed) ? itemsParsed : [];
    const items: {
      test_label: string;
      result_value: string;
      flag: "low" | "normal" | "high" | "critical" | "unknown";
      test_code?: string | null;
      result_unit?: string | null;
      reference_range?: string | null;
    }[] = [];
    for (const row of itemsArr) {
      const ir = pathologyResultItemInputSchema.safeParse(row);
      if (!ir.success) {
        return crmJsonError(
          400,
          ir.error.issues.map((i) => i.message).join(" ") || "Invalid marker row."
        );
      }
      items.push(ir.data);
    }

    const parsed = createPathologyResultFormSchema.safeParse({
      result_date: resultDate == null ? "" : String(resultDate),
      provider_name:
        providerName == null || String(providerName).trim() === "" ? null : String(providerName),
      pathology_request_id:
        pathologyRequestId == null || String(pathologyRequestId).trim() === ""
          ? null
          : String(pathologyRequestId),
      clinical_summary:
        clinicalSummary == null || String(clinicalSummary).trim() === ""
          ? null
          : String(clinicalSummary),
      status: statusRaw == null ? "draft" : String(statusRaw),
      items,
    });
    if (!parsed.success) {
      return crmJsonError(
        400,
        parsed.error.issues.map((i) => i.message).join(" ") || "Invalid form."
      );
    }

    const file = form.get("file");
    let pdfBytes: Uint8Array | null = null;
    let originalFilename: string | null = null;
    if (file instanceof File && file.size > 0) {
      const name = file.name?.trim() ? file.name.trim() : "result.pdf";
      if (!name.toLowerCase().endsWith(".pdf")) {
        return crmJsonError(400, "Only PDF uploads are supported.");
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      pdfBytes = buf;
      originalFilename = file.name || "result.pdf";
    }

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);

    const out = await createPathologyResult({
      tenantId: tenantId.trim(),
      patientId: patientId.trim(),
      resultDate: parsed.data.result_date.trim(),
      providerName: parsed.data.provider_name?.trim() ? parsed.data.provider_name.trim() : null,
      pathologyRequestId: parsed.data.pathology_request_id ?? null,
      clinicalSummary: parsed.data.clinical_summary ?? null,
      status: parsed.data.status,
      items: parsed.data.items.map((i) => ({
        test_code: i.test_code ?? null,
        test_label: i.test_label,
        result_value: i.result_value ?? "",
        result_unit: i.result_unit ?? null,
        reference_range: i.reference_range ?? null,
        flag: i.flag,
      })),
      pdfBytes,
      originalFilename,
      actingUserId,
    });

    return crmJsonOk({
      pathology_result: out.result,
      items: out.items,
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
