/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/images
 * multipart/form-data: file (required), image_category, caption, taken_at, case_id, booking_id, lead_id, metadata (JSON string), adminKey (optional)
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { createPatientImageRecord } from "@/src/lib/patientImages/patientImagesServer";

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

    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      return crmJsonError(400, "Missing or empty file.");
    }

    const imageCategory = form.get("image_category");
    const caption = form.get("caption");
    const takenAt = form.get("taken_at");
    const caseId = form.get("case_id");
    const bookingId = form.get("booking_id");
    const leadId = form.get("lead_id");
    const consultationId = form.get("consultation_id");
    const imagingLibraryAxis = form.get("imaging_library_axis");
    const clinicId = form.get("clinic_id");
    const capturedByStaffId = form.get("captured_by_staff_id");
    const deviceType = form.get("device_type");
    const anatomicalRegion = form.get("anatomical_region");
    const visitType = form.get("visit_type");
    const followUpInterval = form.get("follow_up_interval");
    const imagingProtocolTemplateSlug = form.get("imaging_protocol_template_slug");
    const imagingProtocolSlotSlug = form.get("imaging_protocol_slot_slug");
    const metadataRaw = form.get("metadata");

    let metadata: unknown = {};
    if (metadataRaw != null && String(metadataRaw).trim()) {
      try {
        metadata = JSON.parse(String(metadataRaw));
      } catch {
        return crmJsonError(400, "metadata must be valid JSON.");
      }
    }
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), req);

    const result = await createPatientImageRecord({
      tenantId: tenantId.trim(),
      patientId: patientId.trim(),
      file,
      imageCategory,
      caption: caption == null ? null : String(caption),
      takenAt: takenAt == null ? null : String(takenAt),
      metadata,
      caseId: caseId == null ? null : String(caseId),
      bookingId: bookingId == null ? null : String(bookingId),
      leadId: leadId == null ? null : String(leadId),
      consultationId: consultationId == null ? null : String(consultationId),
      imagingLibraryAxis,
      clinicId: clinicId == null ? null : String(clinicId),
      capturedByStaffId: capturedByStaffId == null ? null : String(capturedByStaffId),
      deviceType: deviceType == null ? null : String(deviceType),
      anatomicalRegion,
      visitType: visitType == null ? null : String(visitType),
      followUpInterval: followUpInterval == null ? null : String(followUpInterval),
      imagingProtocolTemplateSlug:
        imagingProtocolTemplateSlug == null ? null : String(imagingProtocolTemplateSlug),
      imagingProtocolSlotSlug:
        imagingProtocolSlotSlug == null ? null : String(imagingProtocolSlotSlug),
      actingUserId,
    });

    return crmJsonOk({ image: result.row, changed_keys: result.changed_keys });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
