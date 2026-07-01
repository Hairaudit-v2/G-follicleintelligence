/**
 * ImagingOS — SurgeryOS / intraoperative VIE capture adapter (Phase 1 consolidation).
 */

import type { ImagingOsImageIngestionRequest } from "../intake";

export type SurgeryOsImageAdapterInput = {
  tenant_id: string;
  patient_id: string;
  image_id: string;
  case_id?: string | null;
  booking_id?: string | null;
  storage_bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  procedure_day_id?: string | null;
  captured_by_staff_id?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildSurgeryOsImageIngestionRequest(
  input: SurgeryOsImageAdapterInput
): ImagingOsImageIngestionRequest {
  const slotSlug = input.protocol_slot_slug?.trim() || undefined;
  return {
    source_system: "surgery_os",
    upload_surface: "surgery_workflow",
    tenant_id: input.tenant_id,
    patient_id: input.patient_id,
    case_id: input.case_id?.trim() || undefined,
    external_image_id: input.image_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    ...(input.content_type ? { content_type: input.content_type } : {}),
    ...(input.size_bytes != null ? { size_bytes: input.size_bytes } : {}),
    external_category: slotSlug ?? "immediate_post_op",
    uploaded_by_actor_id: input.captured_by_staff_id?.trim() || undefined,
    uploaded_by_actor_type: input.captured_by_staff_id ? "clinician" : "staff",
    metadata: {
      capture_source: "surgery_os",
      protocol_template_slug: input.protocol_template_slug?.trim() || "surgery_day",
      ...(slotSlug ? { protocol_slot_slug: slotSlug } : {}),
      ...(input.booking_id ? { booking_id: input.booking_id } : {}),
      ...(input.procedure_day_id ? { procedure_day_id: input.procedure_day_id } : {}),
      ...(input.metadata ?? {}),
    },
  };
}