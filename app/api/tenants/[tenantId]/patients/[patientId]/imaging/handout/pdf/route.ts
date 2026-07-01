/**
 * GET …/imaging/handout/pdf — patient-safe imaging handout PDF (tenant member read).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import {
  loadPatientSafeImagingExportCardsForPatient,
  patientSafeImagingHandoutPdfInput,
} from "@/src/lib/imaging-os/patientSafeImagingExportLoad.server";
import { renderPatientSafeImagingHandoutPdfBytes } from "@/src/lib/imaging-os/patientSafeImagingHandoutPdfRender.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
  try {
    const { tenantId, patientId } = await params;
    if (!tenantId?.trim() || !patientId?.trim())
      return crmJsonError(400, "Missing route parameters.");

    const adminKey = extractAdminKeyFromRequest(req, null);
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const bundle = await loadPatientSafeImagingExportCardsForPatient({
      tenantId: tenantId.trim(),
      patientId: patientId.trim(),
      includeSignedPreviews: false,
      limit: 24,
    });
    const pdfInput = patientSafeImagingHandoutPdfInput(bundle.cards);
    const bytes = await renderPatientSafeImagingHandoutPdfBytes(pdfInput);

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="imaging-handout-${patientId.trim().slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}