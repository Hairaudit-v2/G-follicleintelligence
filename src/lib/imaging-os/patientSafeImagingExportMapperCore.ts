/**
 * ImagingOS Phase 7 — map patient images to redacted export cards (pure logic).
 */

import {
  buildFiImageTimelineLabel,
  inferFiImageProcedureStage,
} from "@/src/lib/patientImages/fiImageAttributionCore";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import {
  buildPatientSafeImagingExportCard,
  patientSafeExportCardIsRedacted,
  redactMetadataForPatientExport,
  type PatientSafeImagingExportCard,
} from "./patientSafeImagingExportCore";

export type PatientSafeImagingExportCardWithPreview = PatientSafeImagingExportCard & {
  preview_signed_url?: string | null;
};

function formatSessionType(slug: string | null): string | null {
  if (!slug?.trim()) return null;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatViewLabel(image: PatientImageRow): string | null {
  const slot = image.imaging_protocol_slot_slug?.trim();
  if (slot) return slot.replace(/_/g, " ");
  const region = image.anatomical_region?.trim();
  if (region) return region.replace(/_/g, " ");
  const category = image.image_category?.trim();
  if (category && category !== "other") return category.replace(/_/g, " ");
  return null;
}

export function mapPatientImageToSafeExportCard(image: PatientImageRow): PatientSafeImagingExportCard {
  const metadata = redactMetadataForPatientExport(image.metadata ?? {});
  const procedureStage = inferFiImageProcedureStage({
    visit_type: image.visit_type,
    imaging_protocol_template_slug: image.imaging_protocol_template_slug,
    image_category: image.image_category,
    follow_up_interval: image.follow_up_interval,
    imaging_library_axis: image.imaging_library_axis,
  });
  return buildPatientSafeImagingExportCard({
    imageId: image.id,
    takenAt: image.taken_at,
    createdAt: image.created_at,
    viewLabel: formatViewLabel(image),
    sessionType: formatSessionType(image.imaging_protocol_template_slug),
    progressLabel: buildFiImageTimelineLabel({
      procedure_stage: procedureStage,
      visit_type: image.visit_type,
      follow_up_interval: image.follow_up_interval,
    }),
    metadata,
    aiImageReviewStatus: image.ai_image_review_status,
  });
}

export function mapPatientImagesToSafeExportCards(
  images: PatientImageRow[]
): PatientSafeImagingExportCard[] {
  return images
    .filter((img) => img.image_status === "active")
    .map((img) => mapPatientImageToSafeExportCard(img))
    .filter((card) => patientSafeExportCardIsRedacted(card));
}

export function patientSafeExportCardsAreRedacted(cards: PatientSafeImagingExportCard[]): boolean {
  return cards.every((card) => patientSafeExportCardIsRedacted(card));
}