/**
 * ImagingOS Phase 7 — SurgeryOS read-only longitudinal intelligence surfacing (pure).
 */

import { buildImagingDeepLinks, listAvailableImagingDeepLinks } from "@/src/lib/imaging-os/imagingDeepLinksCore";
import type { SurgeryOsVieCaptureSummary, SurgeryOsViePhaseCaptureStatus } from "./surgeryOsVieCapture.types";

export type SurgeryOsLongitudinalSlotStatus =
  | "complete"
  | "partial"
  | "missing"
  | "pending_review"
  | "retake_required";

export type SurgeryOsLongitudinalSlotIntelligence = {
  slot_slug: string;
  label: string;
  phase: string;
  status: SurgeryOsLongitudinalSlotStatus;
  review_required: boolean;
  retake_required: boolean;
};

export type SurgeryOsLongitudinalSurfacing = {
  slots: SurgeryOsLongitudinalSlotIntelligence[];
  review_queue_href: string;
  patient_twin_href: string;
  imaging_gallery_href: string;
  vie_compare_href: string;
  pending_review_count: number;
  retake_required_count: number;
  staff_review_required: boolean;
  deep_links: ReturnType<typeof listAvailableImagingDeepLinks>;
};

function phaseStatusFromCapture(
  phase: SurgeryOsViePhaseCaptureStatus
): SurgeryOsLongitudinalSlotStatus {
  if (phase.pendingReviewCount > 0) return "pending_review";
  if (phase.acceptedCount >= phase.requiredTotal && phase.requiredTotal > 0) return "complete";
  if (phase.acceptedCount > 0) return "partial";
  return "missing";
}

function deriveSlotStatuses(capture: SurgeryOsVieCaptureSummary): SurgeryOsLongitudinalSlotIntelligence[] {
  const retakeWarnings = capture.warnings.filter((w) => w.kind === "pending_low_quality");
  const retakeSlots = new Set(retakeWarnings.map((w) => w.slotSlug).filter(Boolean) as string[]);

  return capture.phases.map((phase) => {
    const status = phaseStatusFromCapture(phase);
    const retake_required =
      phase.pendingReviewCount > 0 &&
      Boolean(phase.nextRecommendedSlot && retakeSlots.has(phase.nextRecommendedSlot));
    const effectiveStatus: SurgeryOsLongitudinalSlotStatus = retake_required
      ? "retake_required"
      : status;
    return {
      slot_slug: phase.nextRecommendedSlot ?? phase.phase,
      label: phase.label,
      phase: phase.phase,
      status: effectiveStatus,
      review_required: effectiveStatus === "pending_review" || retake_required,
      retake_required,
    };
  });
}

export function buildSurgeryOsLongitudinalSurfacing(input: {
  tenantId: string;
  capture: SurgeryOsVieCaptureSummary;
}): SurgeryOsLongitudinalSurfacing {
  const tid = input.tenantId.trim();
  const pid = input.capture.patientId;
  const slots = deriveSlotStatuses(input.capture);
  const pending_review_count = slots.filter((s) => s.status === "pending_review").length;
  const retake_required_count = slots.filter((s) => s.retake_required).length;
  const staff_review_required =
    pending_review_count > 0 ||
    retake_required_count > 0 ||
    input.capture.graftTrayStatus === "pending_review" ||
    input.capture.immediatePostOpStatus === "pending_review" ||
    Boolean(input.capture.outcomeReadiness?.clinical_review_recommended);

  const deepLinks = listAvailableImagingDeepLinks(
    buildImagingDeepLinks({
      tenantId: tid,
      patientId: pid,
      imageId: null,
      caseId: input.capture.caseId,
      protocolSessionId: input.capture.sessionId,
      reviewRequired: staff_review_required,
    })
  );

  return {
    slots,
    review_queue_href: `/fi-admin/${tid}/imaging/review`,
    patient_twin_href: `/fi-admin/${tid}/patients/${pid}/twin`,
    imaging_gallery_href: `/fi-admin/${tid}/patients/${pid}?tab=gallery`,
    vie_compare_href: `/fi-admin/${tid}/patients/${pid}/imaging?tab=compare`,
    pending_review_count,
    retake_required_count,
    staff_review_required,
    deep_links: deepLinks,
  };
}