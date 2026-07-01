/**
 * POST /api/tenants/[tenantId]/patients/[patientId]/images
 * multipart/form-data: file (required), image_category, caption, taken_at, case_id, booking_id, lead_id, metadata (JSON string), adminKey (optional)
 */
import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { assertGuidedSessionUploadPreconditions } from "@/src/lib/imagingOs/imagingOsGuidedFields";
import { applyGuidedCaptureToSession } from "@/src/lib/imagingOs/imagingOsGuidedCapture.server";
import { assertPatientTrialConsentRecorded } from "@/src/lib/patients/patientConsentGate.server";
import { createPatientImageRecord } from "@/src/lib/patientImages/patientImagesServer";
import { isFiAdminApiKeyMatch } from "@/src/lib/crm/crmFiAdminApiKeyMatch";
import {
  APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE,
  APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE,
  isAppointmentAdminFallbackEnabled,
} from "@/src/lib/vie/appointmentProcedureCapture";
import {
  assertVieProtocolCapturePolicy,
  normalizeCaptureSource,
} from "@/src/lib/vie/vieCapturePolicy.server";
import { isVieProtocolSlug, getVieProtocol } from "@/src/lib/vie/vieProtocolCatalog";
import {
  buildCaptureReviewPayload,
  stageVieProtocolCapture,
} from "@/src/lib/vie/vieGuidedCapture.server";
import { loadVieCapturePolicyForTenant } from "@/src/lib/vie/vieCapturePolicy.server";
import { toClientImagingQualitySummary } from "@/src/lib/imaging-os/imageQualityMetadata";
import { runVieInstantIntelligence } from "@/src/lib/vie/vieInstantIntelligence.server";
import { previewVieSameAngleAlignment } from "@/src/lib/vie/vieSameAngleAlignment.server";
import {
  buildVieSurgeryImageMetadata,
  isVieCaptureSource,
} from "@/src/lib/surgeryOs/surgeryOsVieCaptureCore";
import { loadResolvedProtocol } from "@/src/lib/imaging-os/protocolCatalogResolver.server";
import { buildProtocolCatalogCaptureMetadata } from "@/src/lib/imaging-os/protocolCaptureMetadataCore";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; patientId: string }> }
) {
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

    await assertPatientTrialConsentRecorded(tid, pid);

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

    const protocolSessionId =
      protocolSessionIdRaw != null ? String(protocolSessionIdRaw).trim() : "";
    const captureSourceStr = captureSource == null ? null : String(captureSource);
    const templateSlugStr =
      imagingProtocolTemplateSlug != null ? String(imagingProtocolTemplateSlug).trim() : null;
    const slotSlugStr =
      imagingProtocolSlotSlug != null ? String(imagingProtocolSlotSlug).trim() : null;

    const captureSourceNormalized = normalizeCaptureSource(captureSourceStr);
    const bookingIdStr = bookingId == null ? "" : String(bookingId).trim();

    if (bookingIdStr && !captureSourceNormalized) {
      return crmJsonError(400, APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE);
    }

    if (captureSourceNormalized === APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE) {
      if (!isAppointmentAdminFallbackEnabled()) {
        return crmJsonError(403, "Admin fallback uploads are disabled for this environment.");
      }
      if (!isFiAdminApiKeyMatch(adminKey, process.env.FI_ADMIN_API_KEY)) {
        return crmJsonError(403, "Admin fallback upload requires a valid admin key.");
      }
    } else {
      try {
        assertVieProtocolCapturePolicy({
          captureSource: captureSourceStr,
          protocolSessionId: protocolSessionId || null,
          protocolTemplateSlug: templateSlugStr,
          protocolSlotSlug: slotSlugStr,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Protocol capture required.";
        return crmJsonError(400, msg);
      }
    }

    if (protocolSessionId) {
      const slotForGuided = slotSlugStr ?? "";
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
    if (protocolSessionId) {
      metadata =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? { ...(metadata as Record<string, unknown>), protocol_session_id: protocolSessionId }
          : { protocol_session_id: protocolSessionId };
    }

    if (templateSlugStr) {
      try {
        const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
        const resolved = await loadResolvedProtocol(tid, templateSlugStr, supabaseAdmin());
        const catalogMeta = buildProtocolCatalogCaptureMetadata(resolved);
        metadata =
          metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? { ...(metadata as Record<string, unknown>), ...catalogMeta }
            : catalogMeta;
      } catch {
        // best-effort — capture proceeds with session metadata only
      }
    }

    const procedureDayIdRaw = form.get("procedure_day_id");
    if (captureSourceNormalized === "surgery_os" && slotSlugStr) {
      const surgeryMeta = buildVieSurgeryImageMetadata({
        caseId: caseId == null ? null : String(caseId),
        bookingId: bookingId == null ? null : String(bookingId),
        procedureDayId: procedureDayIdRaw == null ? null : String(procedureDayIdRaw),
        slotSlug: slotSlugStr,
        protocolSlug: templateSlugStr ?? "surgery_day",
      });
      metadata =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? { ...(metadata as Record<string, unknown>), ...surgeryMeta }
          : surgeryMeta;
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
      imagingProtocolTemplateSlug:
        imagingProtocolTemplateSlug == null ? null : String(imagingProtocolTemplateSlug),
      imagingProtocolSlotSlug:
        imagingProtocolSlotSlug == null ? null : String(imagingProtocolSlotSlug),
      actingUserId,
      captureType: captureType == null ? null : String(captureType),
      captureSource: captureSource == null ? null : String(captureSource),
      imageWidth: parseDim(imageWidthRaw),
      imageHeight: parseDim(imageHeightRaw),
      protocolSessionId: protocolSessionId || null,
    });

    const qualityAlert = result.attribution?.quality?.alert_message;
    if (qualityAlert) {
      return crmJsonError(400, qualityAlert);
    }

    const imagingQualityRaw =
      result.attribution?.metadata_patch &&
      typeof result.attribution.metadata_patch === "object" &&
      !Array.isArray(result.attribution.metadata_patch) &&
      (result.attribution.metadata_patch as Record<string, unknown>).imaging_quality;
    const imaging_quality =
      imagingQualityRaw && typeof imagingQualityRaw === "object" && !Array.isArray(imagingQualityRaw)
        ? toClientImagingQualitySummary(
            imagingQualityRaw as Parameters<typeof toClientImagingQualitySummary>[0]
          )
        : undefined;

    let guided_session:
      | {
          completionPercent: number;
          sessionCompleted: boolean;
          missingRequired: string[];
          nextSlotSlug: string | null;
        }
      | undefined;

    if (protocolSessionId) {
      const slotSlug =
        imagingProtocolSlotSlug != null ? String(imagingProtocolSlotSlug).trim() : "";
      const replacePrevious =
        guidedReplaceRaw === "1" ||
        guidedReplaceRaw === "true" ||
        String(guidedReplaceRaw ?? "").toLowerCase() === "on";
      const isVieWizard = isVieCaptureSource(captureSourceNormalized);

      if (isVieWizard && templateSlugStr && isVieProtocolSlug(templateSlugStr)) {
        const protocol = getVieProtocol(templateSlugStr);
        const requiredTotal = protocol?.slots.filter((s) => s.required).length ?? 0;
        const intel = await runVieInstantIntelligence({
          tenantId: tid,
          patientId: pid,
          patientImageId: result.row.id,
          protocolSessionId,
          protocolTemplateSlug: templateSlugStr,
          protocolSlotSlug: slotSlugStr ?? slotSlug,
          contentType: result.row.content_type ?? file.type,
          fileSizeBytes: file.size,
          imageWidth: parseDim(imageWidthRaw),
          imageHeight: parseDim(imageHeightRaw),
          protocolCompletion: {
            required_complete: 0,
            required_total: requiredTotal,
            percent: 0,
            complete: false,
          },
        });

        guided_session = await stageVieProtocolCapture({
          tenantId: tid,
          patientId: pid,
          sessionId: protocolSessionId,
          slotSlug,
          newImageId: result.row.id,
          intelligence: intel,
          intelligenceId: intel.intelligence_id,
          replacePrevious,
        });

        const policy = await loadVieCapturePolicyForTenant(tid);
        const vie_capture_review = buildCaptureReviewPayload(intel, policy);
        try {
          vie_capture_review.alignment_preview = await previewVieSameAngleAlignment({
            tenantId: tid,
            patientId: pid,
            imageId: result.row.id,
          });
        } catch {
          vie_capture_review.alignment_preview = null;
        }

        revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
        revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
        revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
        revalidatePath(`/fi-admin/${tid}/surgery-os`);

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
          ...(imaging_quality ? { imaging_quality } : {}),
          guided_session,
          vie_capture_review,
        });
      }

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

    let vie_intelligence:
      | {
          quality_score: number;
          quality_band: string;
          protocol_completion: {
            required_complete: number;
            required_total: number;
            percent: number;
            complete: boolean;
          };
        }
      | undefined;

    if (
      protocolSessionId &&
      templateSlugStr &&
      slotSlugStr &&
      isVieProtocolSlug(templateSlugStr) &&
      guided_session &&
      normalizeCaptureSource(captureSourceStr) !== "vie_capture_wizard" &&
      normalizeCaptureSource(captureSourceStr) !== "surgery_os"
    ) {
      const protocol = getVieProtocol(templateSlugStr);
      const requiredTotal = protocol?.slots.filter((s) => s.required).length ?? 0;
      const requiredComplete = Math.round((guided_session.completionPercent / 100) * requiredTotal);
      const intel = await runVieInstantIntelligence({
        tenantId: tid,
        patientId: pid,
        patientImageId: result.row.id,
        protocolSessionId,
        protocolTemplateSlug: templateSlugStr,
        protocolSlotSlug: slotSlugStr,
        contentType: result.row.content_type ?? file.type,
        fileSizeBytes: file.size,
        imageWidth: parseDim(imageWidthRaw),
        imageHeight: parseDim(imageHeightRaw),
        protocolCompletion: {
          required_complete: requiredComplete,
          required_total: requiredTotal,
          percent: guided_session.completionPercent,
          complete: guided_session.sessionCompleted,
        },
      });
      vie_intelligence = {
        quality_score: intel.quality_score,
        quality_band: intel.quality_band,
        protocol_completion: intel.protocol_completion,
      };
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
      ...(imaging_quality ? { imaging_quality } : {}),
      ...(guided_session ? { guided_session } : {}),
      ...(vie_intelligence ? { vie_intelligence } : {}),
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
