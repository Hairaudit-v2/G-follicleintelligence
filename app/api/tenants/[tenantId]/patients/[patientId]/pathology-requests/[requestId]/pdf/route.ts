/**
 * GET …/pathology-requests/[requestId]/pdf — download pathology request as PDF (tenant member read).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import {
  buildPathologyPdfInputFromDetail,
  buildPathologyPdfStoragePath,
  loadPathologyRequestDetail,
  PATHOLOGY_PATIENT_PDF_BUCKET,
} from "@/src/lib/pathology/pathologyRequestLoad.server";
import { persistPathologyRequestPdfStorage } from "@/src/lib/pathology/pathologyRequestMutations.server";
import { renderPathologyBloodRequestPdfBytes } from "@/src/lib/pathology/pathologyPdfRender.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string; patientId: string; requestId: string }> }) {
  try {
    const { tenantId, patientId, requestId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !requestId?.trim()) return crmJsonError(400, "Missing route parameters.");

    const adminKey = extractAdminKeyFromRequest(req, null);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const bundle = await loadPathologyRequestDetail(tenantId, patientId, requestId);
    if (!bundle) return crmJsonError(404, "Pathology request not found.");

    const pdfInput = buildPathologyPdfInputFromDetail(bundle);
    const bytes = await renderPathologyBloodRequestPdfBytes(pdfInput);

    const supabase = supabaseAdmin();
    const storagePath = buildPathologyPdfStoragePath(tenantId.trim(), patientId.trim(), requestId.trim());
    const { error: upErr } = await supabase.storage
      .from(PATHOLOGY_PATIENT_PDF_BUCKET)
      .upload(storagePath, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      await persistPathologyRequestPdfStorage(
        {
          tenantId: tenantId.trim(),
          patientId: patientId.trim(),
          requestId: requestId.trim(),
          bucket: PATHOLOGY_PATIENT_PDF_BUCKET,
          storagePath,
        },
        supabase
      );
    }

    const filename = `pathology-request-${requestId.trim().slice(0, 8)}.pdf`;
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
