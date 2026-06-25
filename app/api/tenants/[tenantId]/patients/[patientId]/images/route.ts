/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/images
 * multipart/form-data: file (required), image_category, caption, taken_at, case_id, booking_id, lead_id, metadata (JSON string), adminKey (optional)
 */
import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmJsonError, crmJsonOk, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { assertGuidedSessionUploadPreconditions } from "@/src/lib/imagingOs/imagingOsGuidedFields";
import { applyGuidedCaptureToSession } from "@/src/lib/imagingOs/imagingOsGuidedCapture.server";
import { createPatientImageRecord } from "@/src/lib/patientImages/patientImagesServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; patientId: string }> }) {
  try {
    const { tenantId, patientId } = await params;
    const tid = tenantId?.trim() ?? "";
    const pid = patientId?.trim() ?? "";
    if (!tid || !pid) return crmJsonError(400, "Missing tenantId or patientId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const form = await req.formData();
    const adminKey = extractAdminKeyFromRequest(req, { adminKey: form.get("adminKey") });
    await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey, request: req });

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
    const protocolSessionIdRaw = form.get("protocol_session_id");
    const guidedReplaceRaw = form.get("guided_replace");
    const captureType = form.get("capture_type");
    const captureSource = form.get("capture_source");
    const imageWidthRaw = form.get("image_width");
    const imageHeightRaw = form.get("image_height");
    const metadataRaw = form.get("metadata");

    const protocolSessionId = protocolSessionIdRaw != null ? String(protocolSessionIdRaw).trim() : "";
    if (protocolSessionId) {
      const slotForGuided = imagingProtocolSlotSlug != null ? String(imagingProtocolSlotSlug).trim() : "";
      try {
        assertGuidedSessionUploadPreconditions({
          tenantId: tid,
          patientId: pid,
          protocolSessionId,
          slotSlug: slotForGuided,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid guided capture request.";
        return crmJsonError(400, msg);
      }
    }

    let metadata: unknown = {};
    if (metadataRaw != null && String(metadataRaw).trim()) {
      try {
        metadata = JSON.parse(String(metadataRaw));
      } catch {
        return crmJsonError(400, "metadata must be valid JSON.");
      }
    }
    const actingUserId = await tryResolveFiUserIdForTenant(tid, req);

    const parseDim = (raw: FormDataEntryValue | null): number | null => {
      if (raw == null) return null;
      const n = Number(String(raw).trim());
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };

    const result = await createPatientImageRecord({
      tenantId: tid,
      patientId: pid,
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
      imagingProtocolTemplateSlug: imagingProtocolTemplateSlug == null ? null : String(imagingProtocolTemplateSlug),
      imagingProtocolSlotSlug: imagingProtocolSlotSlug == null ? null : String(imagingProtocolSlotSlug),
      actingUserId,
      captureType: captureType == null ? null : String(captureType),
      captureSource: captureSource == null ? null : String(captureSource),
      imageWidth: parseDim(imageWidthRaw),
      imageHeight: parseDim(imageHeightRaw),
    });

    let guided_session:
      | {
          completionPercent: number;
          sessionCompleted: boolean;
          missingRequired: string[];
          nextSlotSlug: string | null;
        }
      | undefined;

    if (protocolSessionId) {
      const slotSlug = imagingProtocolSlotSlug != null ? String(imagingProtocolSlotSlug).trim() : "";
      const replacePrevious =
        guidedReplaceRaw === "1" ||
        guidedReplaceRaw === "true" ||
        String(guidedReplaceRaw ?? "").toLowerCase() === "on";
      guided_session = await applyGuidedCaptureToSession({
        tenantId: tid,
        patientId: pid,
        sessionId: protocolSessionId,
        newImageId: result.row.id,
        slotSlug,
        replacePrevious,
        templateSlugFromImageRow: result.row.imaging_protocol_template_slug,
      });
    }

    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);

    return crmJsonOk({
      image: result.row,
      changed_keys: result.changed_keys,
      ...(result.attribution
        ? {
            attribution: {
              quality: result.attribution.quality,
              classification: result.attribution.classification,
              timeline_entry: result.attribution.timeline_entry,
              watermark_applied: result.attribution.watermark_applied,
              marketing_version_created: result.attribution.marketing_version_created,
            },
          }
        : {}),
      ...(guided_session ? { guided_session } : {}),
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
