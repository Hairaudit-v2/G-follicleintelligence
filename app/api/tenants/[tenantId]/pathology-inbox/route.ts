/**
 * GET  /api/tenants/[tenantId]/pathology-inbox — list pending inbound documents
 * POST /api/tenants/[tenantId]/pathology-inbox — manual PDF upload to inbox
 */
import { assertCrmTenantReadAllowed, assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { loadPathologyInboxDocuments } from "@/src/lib/pathology/pathologyInboxLoad.server";
import { uploadInboundPathologyDocument } from "@/src/lib/pathology/pathologyInboxMutations.server";
import type { PathologyInboundMatchStatus } from "@/src/lib/pathology/pathologyInboxTypes";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<PathologyInboundMatchStatus | "all">([
  "all",
  "pending",
  "matched",
  "rejected",
  "promoted",
]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const url = new URL(req.url);
    const statusRaw = url.searchParams.get("match_status") ?? "all";
    const matchStatus = VALID_STATUSES.has(statusRaw as PathologyInboundMatchStatus | "all")
      ? (statusRaw as PathologyInboundMatchStatus | "all")
      : "all";

    const documents = await loadPathologyInboxDocuments(tenantId.trim(), { matchStatus });
    return crmJsonOk({ documents });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const form = await req.formData();
    const adminKey = extractAdminKeyFromRequest(req, { adminKey: form.get("adminKey") });
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return crmJsonError(400, "A PDF file is required.");
    }
    const name = file.name?.trim() ? file.name.trim() : "inbound.pdf";
    if (!name.toLowerCase().endsWith(".pdf")) {
      return crmJsonError(400, "Only PDF uploads are supported.");
    }

    const extractedPatientName = form.get("extracted_patient_name");
    const extractedDob = form.get("extracted_dob");
    const extractedMrn = form.get("extracted_mrn");

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);

    const document = await uploadInboundPathologyDocument({
      tenantId: tenantId.trim(),
      pdfBytes,
      originalFilename: name,
      contentType: file.type?.trim() || "application/pdf",
      extractedPatientName:
        extractedPatientName == null || String(extractedPatientName).trim() === ""
          ? null
          : String(extractedPatientName),
      extractedDob:
        extractedDob == null || String(extractedDob).trim() === ""
          ? null
          : String(extractedDob),
      extractedMrn:
        extractedMrn == null || String(extractedMrn).trim() === ""
          ? null
          : String(extractedMrn),
      actingUserId,
    });

    return crmJsonOk({ document }, 201);
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
