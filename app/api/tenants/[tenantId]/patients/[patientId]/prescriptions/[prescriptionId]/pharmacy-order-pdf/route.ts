/**
 * GET …/prescriptions/[prescriptionId]/pharmacy-order-pdf — download compound order PDF (tenant member read).
 *
 * Query: `pharmacyId` (live build) **or** `transmissionId` (frozen snapshot from a transmission row).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import {
  loadCompoundPharmacyById,
  loadPharmacyTransmissionById,
  type PharmacyOrderPayloadSnapshotV1,
} from "@/src/lib/prescribing/fiPharmacyLoaders.server";
import { loadPrescriptionDetail } from "@/src/lib/prescribing/fiPrescribingLoaders.server";
import {
  buildPharmacyOrderPdfContext,
  pharmacyOrderPdfContextFromSnapshot,
} from "@/src/lib/prescribing/pharmacyOrderPayload.server";
import { renderPharmacyOrderPdfBytes } from "@/src/lib/prescribing/pharmacyOrderPdf.server";

export const dynamic = "force-dynamic";

function parseSnapshotV1(raw: unknown): PharmacyOrderPayloadSnapshotV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  return o as unknown as PharmacyOrderPayloadSnapshotV1;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string; prescriptionId: string }> }
) {
  try {
    const { tenantId, patientId, prescriptionId } = await params;
    if (!tenantId?.trim() || !patientId?.trim() || !prescriptionId?.trim()) {
      return crmJsonError(400, "Missing route parameters.");
    }

    const adminKey = extractAdminKeyFromRequest(req, null);
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const tid = tenantId.trim();
    const pid = patientId.trim();
    const rid = prescriptionId.trim();

    const bundle = await loadPrescriptionDetail(tid, rid);
    if (!bundle) return crmJsonError(404, "Prescription not found.");
    if (bundle.prescription.patient_id !== pid)
      return crmJsonError(400, "Patient does not match prescription.");

    const url = new URL(req.url);
    const transmissionId = url.searchParams.get("transmissionId")?.trim() || "";
    const pharmacyId = url.searchParams.get("pharmacyId")?.trim() || "";

    const branding = await resolveEffectiveBranding({ tenantId: tid });
    const brandProps = {
      brand_name: branding.brand_name,
      clinic_display_name: branding.clinic_display_name,
      accent_colour: branding.accent_colour,
    };

    let pdfCtx;
    if (transmissionId) {
      const tx = await loadPharmacyTransmissionById(tid, transmissionId);
      if (!tx || tx.prescription_id !== rid) return crmJsonError(404, "Transmission not found.");
      const snap = parseSnapshotV1(tx.payload_snapshot);
      if (!snap) return crmJsonError(400, "Invalid transmission snapshot.");
      pdfCtx = pharmacyOrderPdfContextFromSnapshot(snap, brandProps);
    } else if (pharmacyId) {
      const pharmacy = await loadCompoundPharmacyById(tid, pharmacyId);
      if (!pharmacy) return crmJsonError(404, "Pharmacy not found.");
      pdfCtx = await buildPharmacyOrderPdfContext({
        tenantId: tid,
        prescriptionId: rid,
        pharmacy,
        branding: brandProps,
      });
    } else {
      return crmJsonError(400, "Provide pharmacyId or transmissionId query parameter.");
    }

    const bytes = await renderPharmacyOrderPdfBytes(pdfCtx);
    const filename = `pharmacy-order-${rid.slice(0, 8)}.pdf`;
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
