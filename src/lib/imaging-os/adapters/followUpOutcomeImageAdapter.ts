/**
 * ImagingOS — follow-up outcome / progress imaging adapter (Phase 1 consolidation).
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type FollowUpOutcomeImageAdapterInput = {
  tenant_id: string;
  patient_id: string;
  image_id: string;
  case_id?: string | null;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
  captured_by_staff_id?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildFollowUpOutcomeImageIngestionRequest(
  input: FollowUpOutcomeImageAdapterInput
): ImagingOsImageIngestionRequest {
  const slotSlug = input.protocol_slot_slug?.trim() || undefined;
  return {
    source_system: "fi_os",
    upload_surface: "fi_guided_protocol",
    tenant_id: input.tenant_id,
    patient_id: input.patient_id,
    case_id: input.case_id?.trim() || undefined,
    external_image_id: input.image_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    external_category: slotSlug ?? "follow_up",
    uploaded_by_actor_id: input.captured_by_staff_id?.trim() || undefined,
    uploaded_by_actor_type: input.captured_by_staff_id ? "clinician" : "staff",
    metadata: {
      capture_source: "follow_up_outcome",
      protocol_template_slug: input.protocol_template_slug?.trim() || "follow_up_review",
      ...(slotSlug ? { protocol_slot_slug: slotSlug } : {}),
      ...(input.follow_up_interval ? { follow_up_interval: input.follow_up_interval } : {}),
      ...(input.visit_type ? { visit_type: input.visit_type } : {}),
      ...(input.metadata ?? {}),
    },
  };
}