/**
 * FI OS — Intelligent Photo Attribution & Branding Engine (pure logic).
 */

import { mapExternalCategoryToCanonical } from "@/src/lib/imaging-os/categories";
import {
  normalizeImagingOsTimepoint,
  type ImagingOsTimepoint,
} from "@/src/lib/imaging-os/progression";
import { evaluateImageQualityFromMetadata } from "@/src/lib/imaging-os/quality";
import type { ImagingOsImageQualityEvaluationResult } from "@/src/lib/imaging-os/quality";
import {
  FI_IMAGE_ATTRIBUTION_ENGINE_VERSION,
  FI_IMAGE_ATTRIBUTION_TYPES,
  FI_IMAGE_CAPTURE_SOURCES,
  FI_IMAGE_CAPTURE_TYPES,
  FI_IMAGE_WATERMARK_POSITIONS,
  type FiImageAiDatasetFields,
  type FiImageAttributionSettings,
  type FiImageAttributionType,
  type FiImageCaptureSource,
  type FiImageCaptureType,
  type FiImageMetadata,
  type FiImageProcedureStage,
  type FiImageQualitySnapshot,
  type FiImageTimelineEntry,
  type FiImageWatermarkPosition,
} from "./fiImageAttributionTypes";

export const DEFAULT_FI_IMAGE_ATTRIBUTION_SETTINGS: FiImageAttributionSettings = {
  enable_watermark: true,
  watermark_opacity: 0.25,
  watermark_position: "bottom_right",
  enable_patient_name_overlay: false,
  enable_marketing_export: true,
  auto_classify_on_capture: true,
  block_upload_on_poor_quality: false,
};

export function normalizeFiImageCaptureType(raw: unknown): FiImageCaptureType {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (FI_IMAGE_CAPTURE_TYPES as readonly string[]).includes(s)
    ? (s as FiImageCaptureType)
    : "upload";
}

export function normalizeFiImageCaptureSource(raw: unknown): FiImageCaptureSource {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (FI_IMAGE_CAPTURE_SOURCES as readonly string[]).includes(s)
    ? (s as FiImageCaptureSource)
    : "unknown";
}

export function normalizeFiImageWatermarkPosition(raw: unknown): FiImageWatermarkPosition {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (FI_IMAGE_WATERMARK_POSITIONS as readonly string[]).includes(s)
    ? (s as FiImageWatermarkPosition)
    : "bottom_right";
}

export function clampWatermarkOpacity(raw: unknown): number {
  if (raw == null || String(raw).trim() === "")
    return DEFAULT_FI_IMAGE_ATTRIBUTION_SETTINGS.watermark_opacity;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_FI_IMAGE_ATTRIBUTION_SETTINGS.watermark_opacity;
  return Math.max(0.15, Math.min(0.35, n));
}

export function parseFiImageAttributionSettings(
  metadata: Record<string, unknown> | null | undefined
): FiImageAttributionSettings {
  const root = metadata?.imaging_attribution;
  const src =
    root && typeof root === "object" && !Array.isArray(root)
      ? (root as Record<string, unknown>)
      : {};
  return {
    enable_watermark: src.enable_watermark !== false,
    watermark_opacity: clampWatermarkOpacity(src.watermark_opacity),
    watermark_position: normalizeFiImageWatermarkPosition(src.watermark_position),
    enable_patient_name_overlay: src.enable_patient_name_overlay === true,
    enable_marketing_export: src.enable_marketing_export !== false,
    auto_classify_on_capture: src.auto_classify_on_capture !== false,
    block_upload_on_poor_quality: src.block_upload_on_poor_quality === true,
  };
}

export function formatFiImageCaptureDate(iso: string, locale = "en-AU"): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(ms)
  );
}

export function inferFiImageProcedureStage(args: {
  capture_source?: string | null;
  visit_type?: string | null;
  imaging_protocol_template_slug?: string | null;
  image_category?: string | null;
  follow_up_interval?: string | null;
  imaging_library_axis?: string | null;
}): FiImageProcedureStage {
  const capture = String(args.capture_source ?? "")
    .trim()
    .toLowerCase();
  const visit = String(args.visit_type ?? "")
    .trim()
    .toLowerCase();
  const template = String(args.imaging_protocol_template_slug ?? "")
    .trim()
    .toLowerCase();

  if (capture === "surgery_os") return "surgery_day";
  if (capture === "follow_up_outcome") return "follow_up";
  const category = String(args.image_category ?? "")
    .trim()
    .toLowerCase();
  const followUp = String(args.follow_up_interval ?? "")
    .trim()
    .toLowerCase();
  const axis = String(args.imaging_library_axis ?? "")
    .trim()
    .toLowerCase();

  if (axis.includes("audit") || visit.includes("audit") || template.includes("audit"))
    return "audit";
  if (template.includes("surgery_day") || visit.includes("surgery_day") || visit.includes("intra"))
    return "surgery_day";
  if (
    category === "post_op" ||
    visit.includes("post_op") ||
    visit.includes("post-op") ||
    template.includes("post")
  ) {
    return "post_op";
  }
  if (
    template.includes("follow_up") ||
    visit.includes("follow_up") ||
    visit.includes("follow-up") ||
    category === "progress" ||
    category === "after" ||
    followUp.length > 0
  ) {
    return "follow_up";
  }
  if (
    template.includes("transplant_planning") ||
    template.includes("pre_op") ||
    visit.includes("pre_op") ||
    category === "before"
  ) {
    return "pre_op";
  }
  if (
    template.includes("hair_loss_consultation") ||
    visit.includes("baseline") ||
    category === "consult"
  ) {
    return "baseline";
  }
  return "unknown";
}

const ATTRIBUTION_TYPE_ALIASES: Record<string, FiImageAttributionType> = {
  front: "frontal_hairline",
  frontal: "frontal_hairline",
  frontal_hairline: "frontal_hairline",
  hairline: "frontal_hairline",
  left: "left_temple",
  left_profile: "left_temple",
  left_temple: "left_temple",
  temporal_left: "left_temple",
  right: "right_temple",
  right_profile: "right_temple",
  right_temple: "right_temple",
  temporal_right: "right_temple",
  crown: "crown",
  top: "crown",
  vertex: "crown",
  donor: "donor_zone",
  donor_zone: "donor_zone",
  immediate_post_op: "immediate_post_op",
  post_op: "immediate_post_op",
  recipient: "recipient_zone",
  recipient_zone: "recipient_zone",
  scalp: "scalp_close_up",
  scalp_close_up: "scalp_close_up",
  beard: "beard",
  eyebrow: "eyebrow",
  trichoscopy: "trichoscopy",
  microscopic: "trichoscopy",
};

export function mapToFiImageAttributionType(args: {
  ai_category?: string | null;
  anatomical_region?: string | null;
  image_category?: string | null;
  protocol_slot_slug?: string | null;
}): FiImageAttributionType {
  const candidates = [
    args.ai_category,
    args.anatomical_region,
    args.protocol_slot_slug,
    args.image_category,
  ]
    .map((v) =>
      String(v ?? "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  for (const c of candidates) {
    if ((FI_IMAGE_ATTRIBUTION_TYPES as readonly string[]).includes(c))
      return c as FiImageAttributionType;
    const mapped = ATTRIBUTION_TYPE_ALIASES[c];
    if (mapped) return mapped;
    const canonical = mapExternalCategoryToCanonical(c).canonical;
    const fromCanonical = ATTRIBUTION_TYPE_ALIASES[canonical];
    if (fromCanonical) return fromCanonical;
  }
  return "unknown";
}

export function buildFiImageMetadata(args: {
  patient_id: string;
  patient_full_name: string;
  clinic_id: string | null;
  clinic_name: string | null;
  practitioner_id: string | null;
  practitioner_name: string | null;
  capture_timestamp: string;
  capture_type: FiImageCaptureType;
  capture_source: FiImageCaptureSource;
  anatomical_region: string | null;
  visit_type: string | null;
  procedure_stage: FiImageProcedureStage;
  image_type: FiImageAttributionType;
  image_type_confidence: number | null;
}): FiImageMetadata {
  return {
    patient_id: args.patient_id,
    patient_full_name: args.patient_full_name,
    clinic_id: args.clinic_id,
    clinic_name: args.clinic_name,
    practitioner_id: args.practitioner_id,
    practitioner_name: args.practitioner_name,
    capture_date: formatFiImageCaptureDate(args.capture_timestamp),
    capture_timestamp: args.capture_timestamp,
    capture_type: args.capture_type,
    capture_source: args.capture_source,
    anatomical_region: args.anatomical_region,
    visit_type: args.visit_type,
    procedure_stage: args.procedure_stage,
    image_type: args.image_type,
    image_type_confidence: args.image_type_confidence,
    attribution_engine_version: FI_IMAGE_ATTRIBUTION_ENGINE_VERSION,
  };
}

export function evaluateFiImageQuality(args: {
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  content_type?: string | null;
  image_type?: FiImageAttributionType;
  metadata_hints?: Record<string, unknown>;
}): { quality: ImagingOsImageQualityEvaluationResult; snapshot: FiImageQualitySnapshot } {
  const evaluation = evaluateImageQualityFromMetadata({
    width: args.width ?? undefined,
    height: args.height ?? undefined,
    size_bytes: args.size_bytes ?? undefined,
    content_type: args.content_type ?? undefined,
    metadata: args.metadata_hints ?? {},
  });

  const alert_message = buildFiImageQualityAlertMessage(evaluation);

  return {
    quality: evaluation,
    snapshot: {
      quality_status: evaluation.quality_status,
      quality_score: evaluation.quality_score,
      is_clinically_usable: evaluation.is_clinically_usable,
      warnings: evaluation.warnings,
      blockers: evaluation.blockers,
      alert_message,
      width: args.width ?? null,
      height: args.height ?? null,
    },
  };
}

export function buildFiImageQualityAlertMessage(
  quality: ImagingOsImageQualityEvaluationResult
): string | null {
  if (quality.is_clinically_usable) return null;
  if (quality.blockers.some((b) => /blur/i.test(b))) {
    return "Image quality too low. Please retake photo — image appears blurry.";
  }
  if (quality.blockers.some((b) => /light/i.test(b))) {
    return "Image quality too low. Please retake photo — lighting is insufficient.";
  }
  if (quality.blockers.some((b) => /angle/i.test(b))) {
    return "Image quality too low. Please retake photo — angle is incorrect.";
  }
  if (quality.blockers.some((b) => /scalp visibility/i.test(b))) {
    return "Image quality too low. Please retake photo — scalp visibility is incomplete.";
  }
  if (quality.blockers.some((b) => /dimension|distance|size/i.test(b))) {
    return "Image quality too low. Please retake photo — framing or distance is incorrect.";
  }
  return "Image quality too low. Please retake photo.";
}

const PROCEDURE_STAGE_LABELS: Record<FiImageProcedureStage, string> = {
  baseline: "Baseline",
  pre_op: "Pre Surgery",
  surgery_day: "Surgery Day",
  post_op: "Immediate Post Op",
  follow_up: "Follow Up",
  audit: "Audit",
  unknown: "Clinical Progress",
};

const TIMEPOINT_LABELS: Partial<Record<ImagingOsTimepoint, string>> = {
  baseline: "Baseline",
  pre_op: "Pre Surgery",
  immediate_post_op: "Immediate Post Op",
  day_14: "Day 14",
  month_3: "Month 3",
  month_6: "Month 6",
  month_9: "Month 9",
  month_12: "Month 12",
  month_18: "Month 18",
  month_24: "Month 24",
  annual_review: "Annual Review",
};

export function buildFiImageTimelineLabel(args: {
  procedure_stage: FiImageProcedureStage;
  visit_type?: string | null;
  follow_up_interval?: string | null;
  image_type?: FiImageAttributionType;
}): string {
  const followUp = String(args.follow_up_interval ?? "").trim();
  if (followUp) {
    const tp = normalizeImagingOsTimepoint(followUp);
    const fromTp = TIMEPOINT_LABELS[tp];
    if (fromTp) return fromTp;
  }
  const visitTp = normalizeImagingOsTimepoint(args.visit_type);
  const fromVisit = TIMEPOINT_LABELS[visitTp];
  if (fromVisit && visitTp !== "unknown") return fromVisit;
  return PROCEDURE_STAGE_LABELS[args.procedure_stage] ?? "Clinical Capture";
}

export function buildFiImageTimelineEntry(args: {
  image_id: string;
  capture_timestamp: string;
  procedure_stage: FiImageProcedureStage;
  visit_type?: string | null;
  follow_up_interval?: string | null;
  image_type: FiImageAttributionType;
}): FiImageTimelineEntry {
  return {
    image_id: args.image_id,
    label: buildFiImageTimelineLabel(args),
    procedure_stage: args.procedure_stage,
    capture_timestamp: args.capture_timestamp,
    image_type: args.image_type,
    sort_order: timelineSortOrder(args.procedure_stage, args.follow_up_interval, args.visit_type),
  };
}

function timelineSortOrder(
  stage: FiImageProcedureStage,
  followUpInterval?: string | null,
  visitType?: string | null
): number {
  const stageOrder: Record<FiImageProcedureStage, number> = {
    baseline: 10,
    pre_op: 20,
    surgery_day: 30,
    post_op: 40,
    follow_up: 50,
    audit: 60,
    unknown: 70,
  };
  const base = stageOrder[stage] ?? 70;
  const tp = normalizeImagingOsTimepoint(followUpInterval ?? visitType);
  const tpOrder: Partial<Record<ImagingOsTimepoint, number>> = {
    day_14: 5,
    month_3: 10,
    month_6: 20,
    month_9: 30,
    month_12: 40,
    month_18: 50,
    month_24: 60,
    annual_review: 70,
  };
  return base + (tpOrder[tp] ?? 0);
}

export function sortFiImageTimelineEntries(
  entries: FiImageTimelineEntry[]
): FiImageTimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return Date.parse(a.capture_timestamp) - Date.parse(b.capture_timestamp);
  });
}

export function buildMarketingExportCaption(args: {
  clinic_name: string | null;
  procedure_stage: FiImageProcedureStage;
  follow_up_interval?: string | null;
  visit_type?: string | null;
}): { headline: string; subline: string } {
  const clinic = args.clinic_name?.trim() || "Clinic";
  const stageLabel = buildFiImageTimelineLabel({
    procedure_stage: args.procedure_stage,
    follow_up_interval: args.follow_up_interval,
    visit_type: args.visit_type,
  });
  return {
    headline: clinic,
    subline:
      stageLabel.includes("Month") || stageLabel.includes("Day")
        ? `${stageLabel} Results`
        : stageLabel,
  };
}

export function buildFiImageAiDatasetFields(args: {
  patient_metadata?: Record<string, unknown>;
  person_metadata?: Record<string, unknown>;
  age_years?: number | null;
}): FiImageAiDatasetFields {
  const pm = args.patient_metadata ?? {};
  const person = args.person_metadata ?? {};
  const clinical =
    pm.clinical && typeof pm.clinical === "object" && !Array.isArray(pm.clinical)
      ? (pm.clinical as Record<string, unknown>)
      : {};
  const hair =
    pm.hair && typeof pm.hair === "object" && !Array.isArray(pm.hair)
      ? (pm.hair as Record<string, unknown>)
      : {};

  const read = (...vals: unknown[]): string | null => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return null;
  };

  const readNum = (...vals: unknown[]): number | null => {
    for (const v of vals) {
      const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  return {
    hair_loss_stage: read(clinical.hair_loss_stage, hair.norwood_stage, pm.norwood_stage),
    ethnicity: read(person.ethnicity, pm.ethnicity, clinical.ethnicity),
    age: args.age_years ?? readNum(person.age, pm.age),
    donor_density: read(clinical.donor_density, hair.donor_density),
    graft_count: readNum(clinical.graft_count, pm.graft_count),
    medication_status: read(clinical.medication_status, pm.medication_status),
    treatment_type: read(clinical.treatment_type, pm.treatment_type, hair.treatment_type),
    growth_outcome: read(clinical.growth_outcome, pm.growth_outcome),
  };
}

export function mergeFiImageAttributionMetadata(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...existing, ...patch };
}
