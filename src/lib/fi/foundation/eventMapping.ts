/**
 * Maps FI producer event types to foundation vocabulary (case_type, timeline, media).
 * Conservative defaults — see docs/design/09-foundation-dual-write-event-ingest.md.
 */

import type { FiEventType } from "@/src/types/fi-events";

/** Stored on fi_cases.metadata.case_type via resolveOrCreateCaseFoundation. */
export type FoundationCaseType =
  | "hair_loss_assessment"
  | "audit"
  | "media"
  | "hair_transplant"
  | "surgery_evidence"
  | "general_case_event";

export type FoundationTimelineSpec = {
  event_kind: string;
  title: string;
};

/**
 * HairAudit image `type` → fi_media_assets.asset_type (conservative: generic scalp views stay `media`).
 */
export function mapHairAuditImageToAssetType(imageType: string): FoundationCaseType {
  const n = String(imageType ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (!n) return "media";
  const surgeryHints = [
    "transplant",
    "fue",
    "graft",
    "surgery",
    "surgical",
    "postop",
    "post_op",
    "post-op",
    "strip",
  ];
  if (surgeryHints.some((h) => n.includes(h))) {
    if (
      n.includes("post") ||
      n.includes("immediate") ||
      n.includes("day0") ||
      n.includes("day_0")
    ) {
      return "surgery_evidence";
    }
    return "hair_transplant";
  }
  return "media";
}

/** HLI document kind → foundation media asset_type. */
export function mapHliDocumentKindToMediaAssetType(kind: string): FoundationCaseType {
  const k = String(kind ?? "")
    .toLowerCase()
    .trim();
  if (k === "blood_pdf" || k === "blood_csv") return "hair_loss_assessment";
  return "media";
}

export function getFoundationCaseTypeForEvent(eventType: FiEventType): FoundationCaseType {
  switch (eventType) {
    case "hli.intake.submitted":
      return "hair_loss_assessment";
    case "hairaudit.case.submitted":
      return "audit";
    case "hli.document.uploaded":
      return "media";
    case "hairaudit.images.uploaded":
      return "general_case_event";
    case "iiohr.images.uploaded":
      return "media";
    case "clinic.ai.usage":
      return "general_case_event";
    default:
      return "general_case_event";
  }
}

/**
 * Curated timeline rows only for clinically / operationally meaningful producer events.
 * All current HairAudit + HLI ingest event types qualify; internal-only types would return null here later.
 */
export function getFoundationTimelineSpec(eventType: FiEventType): FoundationTimelineSpec | null {
  switch (eventType) {
    case "hli.intake.submitted":
      return { event_kind: "intake_submitted", title: "HLI intake submitted" };
    case "hli.document.uploaded":
      return { event_kind: "media_uploaded", title: "HLI document uploaded" };
    case "hairaudit.case.submitted":
      return { event_kind: "audit_case_submitted", title: "HairAudit case submitted" };
    case "hairaudit.images.uploaded":
      return { event_kind: "hairaudit_media_uploaded", title: "HairAudit images uploaded" };
    case "iiohr.images.uploaded":
      return { event_kind: "iiohr_academy_image_uploaded", title: "IIOHR academy image uploaded" };
    case "clinic.ai.usage":
      return null;
    default:
      return null;
  }
}

/**
 * For a batch of HairAudit images, pick a single timeline kind/title when evidence looks surgical.
 */
export function getHairAuditImagesTimelineSpec(imageTypes: string[]): FoundationTimelineSpec {
  const anySurgery = imageTypes.some((t) => {
    const at = mapHairAuditImageToAssetType(t);
    return at === "hair_transplant" || at === "surgery_evidence";
  });
  if (anySurgery) {
    return {
      event_kind: "surgery_evidence_uploaded",
      title: "Surgery / transplant evidence uploaded",
    };
  }
  return { event_kind: "hairaudit_media_uploaded", title: "HairAudit images uploaded" };
}
