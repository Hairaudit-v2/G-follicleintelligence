/**
 * ImagingOS Phase 7C — detect images eligible for visual summary auto-regeneration.
 */

import { mapToFiImageAttributionType } from "@/src/lib/patientImages/fiImageAttributionCore";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import type { PatientVisualSummaryPhotoSlot } from "./patientVisualSummaryReportTypes";

const SUMMARY_SLOTS: PatientVisualSummaryPhotoSlot[] = [
  "immediate_post_op",
  "day_1_post_op",
  "donor",
  "recipient",
  "graft_tray",
];

export function imageMatchesVisualSummaryPhotoSlot(
  image: Pick<
    PatientImageRow,
    | "ai_image_category"
    | "anatomical_region"
    | "image_category"
    | "imaging_protocol_slot_slug"
    | "follow_up_interval"
  >,
  slot: PatientVisualSummaryPhotoSlot
): boolean {
  const attribution = mapToFiImageAttributionType({
    ai_category: image.ai_image_category,
    anatomical_region: image.anatomical_region,
    image_category: image.image_category,
    protocol_slot_slug: image.imaging_protocol_slot_slug,
  });
  const slotSlug = (image.imaging_protocol_slot_slug ?? "").toLowerCase();
  const category = (image.image_category ?? "").toLowerCase();
  const followUp = (image.follow_up_interval ?? "").toLowerCase();

  switch (slot) {
    case "immediate_post_op":
      return (
        attribution === "immediate_post_op" ||
        category === "post_op" ||
        slotSlug.includes("immediate") ||
        slotSlug.includes("post_op")
      );
    case "day_1_post_op":
      return (
        followUp.includes("day_1") ||
        followUp.includes("day1") ||
        followUp === "1d" ||
        slotSlug.includes("day_1")
      );
    case "donor":
      return attribution === "donor_zone" || category === "donor" || slotSlug.includes("donor");
    case "recipient":
      return attribution === "recipient_zone" || slotSlug.includes("recipient");
    case "graft_tray":
      return slotSlug.includes("graft_tray") || image.ai_image_category === "graft_tray";
    default:
      return false;
  }
}

export function isPatientVisualSummaryEligibleCaptureImage(
  image: Pick<
    PatientImageRow,
    | "ai_image_category"
    | "anatomical_region"
    | "image_category"
    | "imaging_protocol_slot_slug"
    | "follow_up_interval"
  >
): boolean {
  return SUMMARY_SLOTS.some((slot) => imageMatchesVisualSummaryPhotoSlot(image, slot));
}