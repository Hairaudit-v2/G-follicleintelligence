/**
 * ImagingOS Phase 7A — patient-safe visual summary report mapper (pure).
 */

import { mapToFiImageAttributionType } from "@/src/lib/patientImages/fiImageAttributionCore";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import {
  derivePatientSafeExportStatus,
  patientSafeStatusMessage,
} from "./patientSafeImagingExportCore";
import { redactMetadataForPatientExport } from "./patientSafeImagingExportCore";
import {
  defaultPatientVisualSummaryApproval,
  patientVisualSummaryPatientAccessAllowed,
  readPatientVisualSummaryApproval,
} from "./patientVisualSummaryApprovalCore";
import {
  PATIENT_VISUAL_SUMMARY_DISCLAIMER,
  PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
  PATIENT_VISUAL_SUMMARY_VERSION,
  type PatientVisualSummaryAuditSummary,
  type PatientVisualSummaryDensityZone,
  type PatientVisualSummaryGraftTypeSummary,
  type PatientVisualSummaryPhotoPanelItem,
  type PatientVisualSummaryPhotoSlot,
  type PatientVisualSummaryRecipientZone,
  type PatientVisualSummaryReport,
  type PatientVisualSummaryReportType,
  type PatientVisualSummaryStaffRecord,
  type PatientVisualSummaryTimelineMilestone,
} from "./patientVisualSummaryReportTypes";

export const DEFAULT_RECIPIENT_ZONES: Omit<
  PatientVisualSummaryRecipientZone,
  "graftCount" | "densityRange" | "graftTypeMix" | "notes"
>[] = [
  {
    zoneId: "zone_1",
    label: "Zone 1 — Hairline",
    description: "Front hairline and temple transition",
  },
  {
    zoneId: "zone_2",
    label: "Zone 2 — First 1–1.5 cm",
    description: "Immediately behind the hairline",
  },
  {
    zoneId: "zone_3",
    label: "Zone 3 — Mid frontal",
    description: "Central frontal region",
  },
  {
    zoneId: "zone_4",
    label: "Zone 4 — Posterior frontal / transition",
    description: "Transition into native hair",
  },
];

export const PATIENT_SAFE_HAIRLINE_PRINCIPLE_PHRASES = [
  "soft natural hairline",
  "irregular micro-pattern",
  "density gradient",
  "transition into native hair",
  "temple blending",
] as const;

export const HEALING_TIMELINE_MILESTONES: PatientVisualSummaryTimelineMilestone[] = [
  { month: 1, label: "Shedding phase may occur" },
  { month: 3, label: "Early growth may begin" },
  { month: 6, label: "Visible improvement often develops" },
  { month: 9, label: "Density continues maturing" },
  { month: 12, label: "Result assessment window" },
];

export const MONITORING_ITEMS = [
  "Healing",
  "Shedding",
  "Redness",
  "Donor recovery",
  "Growth progress",
  "Density maturation",
  "Follow-up photos",
] as const;

const FORBIDDEN_REPORT_PATTERNS = [
  /\bnorwood\b/i,
  /\bludwig\b/i,
  /\bdiagnosis\b/i,
  /\bpredict/i,
  /\boutcome.?score\b/i,
  /\bconfidence\b/i,
  /\bstaff.?note/i,
  /\breview.?note/i,
  /\bguarantee/i,
  /\bguaranteed\b/i,
  /\bsurvival\b/i,
  /\bsimulation\b/i,
] as const;

const PHOTO_SLOT_LABELS: Record<PatientVisualSummaryPhotoSlot, string> = {
  immediate_post_op: "Immediate post-op",
  day_1_post_op: "Day 1 post-op",
  donor: "Donor",
  recipient: "Recipient",
  graft_tray: "Graft tray",
};

export type PatientVisualSummaryGraftCompositionInput = {
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
} | null;

export type PatientVisualSummaryReportBuildInput = {
  reportType: PatientVisualSummaryReportType;
  generatedAt?: string;
  patientName: string;
  useInitials?: boolean;
  clinicName?: string | null;
  procedureOrAuditDate?: string | null;
  images: Array<{
    image: PatientImageRow;
    previewSignedUrl?: string | null;
  }>;
  graftComposition?: PatientVisualSummaryGraftCompositionInput;
  staffRecord?: PatientVisualSummaryStaffRecord | null;
  recipientStrategyNotes?: string | null;
  surgicalPlanSummary?: string | null;
  caseMetadata?: Record<string, unknown> | null;
  surgeryId?: string | null;
  longitudinalComparisonAvailable?: boolean;
};

export function formatPatientDisplayName(name: string, useInitials?: boolean): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "—") return "Patient";
  if (!useInitials) return trimmed;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Patient";
  return parts.map((p) => `${p[0]?.toUpperCase() ?? ""}.`).join(" ");
}

export function reportTypeLabel(reportType: PatientVisualSummaryReportType): string {
  switch (reportType) {
    case "surgery_post_op_summary":
      return "Post-surgery visual summary";
    case "hairaudit_visual_summary":
      return "HairAudit visual summary";
    default:
      return "Visual summary";
  }
}

export function readPatientVisualSummaryStaffRecord(
  metadata: Record<string, unknown> | null | undefined
): PatientVisualSummaryStaffRecord | null {
  const raw = metadata?.patient_visual_summary_record;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as PatientVisualSummaryStaffRecord;
}

function formatNotRecordedValue<T>(value: T | null | undefined): T | typeof PATIENT_VISUAL_SUMMARY_NOT_RECORDED {
  if (value == null) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  if (typeof value === "number" && !Number.isFinite(value)) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  return value;
}

export function buildGraftTypeSummary(input: {
  composition: PatientVisualSummaryGraftCompositionInput;
  fiveHairGrafts?: number | null;
}): PatientVisualSummaryGraftTypeSummary {
  const c = input.composition;
  if (!c) {
    return {
      singles: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      doubles: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      triples: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      fourPlusHair: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      fiveHair: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
    };
  }
  const hasAny =
    c.singles > 0 || c.doubles > 0 || c.triples > 0 || c.multiples > 0;
  if (!hasAny) {
    return {
      singles: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      doubles: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      triples: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      fourPlusHair: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      fiveHair: formatNotRecordedValue(input.fiveHairGrafts ?? null),
    };
  }
  return {
    singles: c.singles,
    doubles: c.doubles,
    triples: c.triples,
    fourPlusHair: c.multiples,
    fiveHair: formatNotRecordedValue(input.fiveHairGrafts ?? null),
  };
}

type StaffRecipientZoneRow = NonNullable<
  PatientVisualSummaryStaffRecord["recipient_zones"]
>[number];

export function buildRecipientZones(input: {
  staffRecord?: PatientVisualSummaryStaffRecord | null;
}): PatientVisualSummaryRecipientZone[] {
  const staffZones = input.staffRecord?.recipient_zones;
  const staffById = new Map<string, StaffRecipientZoneRow>();
  if (staffZones?.length) {
    for (const z of staffZones) {
      const id = z.zone_id?.trim();
      if (id) staffById.set(id, z);
    }
  }

  return DEFAULT_RECIPIENT_ZONES.map((zone) => {
    const staff = staffById.get(zone.zoneId);
    const graftCount =
      staff?.graft_count != null && Number.isFinite(staff.graft_count)
        ? staff.graft_count
        : undefined;
    const densityRange = staff?.density_range?.trim() || undefined;
    const graftTypeMix = staff?.graft_type_mix;
    const notes = staff?.notes?.trim() || undefined;

    return {
      ...zone,
      ...(graftCount != null ? { graftCount } : {}),
      ...(densityRange ? { densityRange } : {}),
      ...(graftTypeMix && Object.keys(graftTypeMix).length > 0 ? { graftTypeMix } : {}),
      ...(notes ? { notes } : {}),
    };
  });
}

export function formatZoneDisplayValue(
  value: number | string | undefined | null
): string {
  if (value == null) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  if (typeof value === "number" && !Number.isFinite(value)) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  if (typeof value === "string" && !value.trim()) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  return String(value);
}

export function buildDensityZones(
  staffRecord?: PatientVisualSummaryStaffRecord | null
): PatientVisualSummaryDensityZone[] {
  const zones = staffRecord?.density_zones;
  if (!zones?.length) return [];
  const out: PatientVisualSummaryDensityZone[] = [];
  for (const z of zones) {
    const label = z.label?.trim();
    const qualitative = z.qualitative_label?.trim();
    if (!label || !qualitative) continue;
    const graftsPerCm2 =
      z.grafts_per_cm2 != null && Number.isFinite(z.grafts_per_cm2)
        ? z.grafts_per_cm2
        : undefined;
    out.push({
      label,
      qualitativeLabel: qualitative,
      ...(graftsPerCm2 != null ? { graftsPerCm2 } : {}),
    });
  }
  return out;
}

export function extractPatientSafeHairlinePrinciples(input: {
  staffRecord?: PatientVisualSummaryStaffRecord | null;
  recipientStrategyNotes?: string | null;
  surgicalPlanSummary?: string | null;
}): string[] {
  const fromStaff = input.staffRecord?.hairline_principles?.filter((p) => p.trim()) ?? [];
  if (fromStaff.length > 0) {
    return fromStaff.filter((p) => patientSafeReportTextIsAllowed(p));
  }

  const haystack = [input.recipientStrategyNotes, input.surgicalPlanSummary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return [];

  const found: string[] = [];
  for (const phrase of PATIENT_SAFE_HAIRLINE_PRINCIPLE_PHRASES) {
    if (haystack.includes(phrase.toLowerCase())) {
      found.push(phrase.charAt(0).toUpperCase() + phrase.slice(1));
    }
  }
  return found.filter((p) => patientSafeReportTextIsAllowed(p));
}

function imageMatchesPhotoSlot(image: PatientImageRow, slot: PatientVisualSummaryPhotoSlot): boolean {
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

function pickBestImageForSlot(
  images: PatientVisualSummaryReportBuildInput["images"],
  slot: PatientVisualSummaryPhotoSlot
): PatientVisualSummaryReportBuildInput["images"][number] | null {
  const matches = images.filter(({ image }) => imageMatchesPhotoSlot(image, slot));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => {
    const ta = Date.parse(a.image.taken_at ?? a.image.created_at);
    const tb = Date.parse(b.image.taken_at ?? b.image.created_at);
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  })[0];
}

export function buildPhotoPanel(
  images: PatientVisualSummaryReportBuildInput["images"]
): PatientVisualSummaryPhotoPanelItem[] {
  const slots: PatientVisualSummaryPhotoSlot[] = [
    "immediate_post_op",
    "day_1_post_op",
    "donor",
    "recipient",
    "graft_tray",
  ];

  return slots.map((slot) => {
    const match = pickBestImageForSlot(images, slot);
    if (!match) {
      return {
        slot,
        label: PHOTO_SLOT_LABELS[slot],
        image_id: null,
        preview_signed_url: null,
        photo_date: null,
        status_message: PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
      };
    }
    const metadata = redactMetadataForPatientExport(match.image.metadata ?? {});
    const status = derivePatientSafeExportStatus({
      metadata,
      aiImageReviewStatus: match.image.ai_image_review_status,
    });
    return {
      slot,
      label: PHOTO_SLOT_LABELS[slot],
      image_id: match.image.id,
      preview_signed_url: match.previewSignedUrl ?? null,
      photo_date: match.image.taken_at ?? match.image.created_at ?? null,
      status_message: patientSafeStatusMessage(status),
    };
  });
}

function deriveAuditImageQualityStatus(images: PatientImageRow[]): string {
  let pass = 0;
  let review = 0;
  let unknown = 0;
  for (const img of images) {
    const quality = img.metadata?.imaging_quality;
    if (quality && typeof quality === "object" && !Array.isArray(quality)) {
      const qs = (quality as { quality_status?: string }).quality_status;
      if (qs === "pass") pass += 1;
      else if (qs === "review" || qs === "fail") review += 1;
      else unknown += 1;
    } else {
      unknown += 1;
    }
  }
  if (images.length === 0) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  if (review > 0) return "Clinical team review recommended";
  if (pass > 0 && unknown === 0) return "Image quality suitable for review";
  if (pass > 0) return "Mixed quality — some views suitable";
  return "Images received";
}

function deriveClinicalReviewStatus(images: PatientImageRow[]): string {
  let reviewed = 0;
  let retake = 0;
  let pending = 0;
  for (const img of images) {
    const staff = img.metadata?.imaging_staff_review;
    if (staff && typeof staff === "object" && !Array.isArray(staff)) {
      const status = (staff as { status?: string }).status;
      if (status === "retake_required") retake += 1;
      else if (status === "reviewed" || status === "view_reassigned") reviewed += 1;
      else pending += 1;
    } else if (img.ai_image_review_status === "pending") {
      pending += 1;
    } else {
      pending += 1;
    }
  }
  if (images.length === 0) return PATIENT_VISUAL_SUMMARY_NOT_RECORDED;
  if (retake > 0) return "Retake requested for some views";
  if (reviewed === images.length) return "Clinical team review complete";
  if (reviewed > 0) return "Partial clinical review complete";
  return "Clinical team review in progress";
}

function collectUploadedViews(images: PatientImageRow[]): string[] {
  const views = new Set<string>();
  for (const img of images) {
    const meta = img.metadata ?? {};
    const canonical =
      typeof meta.canonical_view === "string"
        ? meta.canonical_view
        : img.imaging_protocol_slot_slug ?? img.anatomical_region ?? img.image_category;
    if (canonical?.trim()) {
      views.add(canonical.trim().replace(/_/g, " "));
    }
  }
  return [...views].sort();
}

function collectRetakeViews(images: PatientImageRow[]): string[] {
  const views: string[] = [];
  for (const img of images) {
    const staff = img.metadata?.imaging_staff_review;
    if (staff && typeof staff === "object" && !Array.isArray(staff)) {
      const status = (staff as { status?: string }).status;
      if (status === "retake_required") {
        const view =
          img.imaging_protocol_slot_slug ??
          img.anatomical_region ??
          img.image_category ??
          "view";
        views.push(String(view).replace(/_/g, " "));
      }
    }
  }
  return views;
}

export function buildHairAuditAuditSummary(input: {
  images: PatientImageRow[];
  staffRecord?: PatientVisualSummaryStaffRecord | null;
  longitudinalComparisonAvailable?: boolean;
}): PatientVisualSummaryAuditSummary {
  const uploadedViews = collectUploadedViews(input.images);
  const missingOrRetake = collectRetakeViews(input.images);
  const patientSafeSummary =
    input.staffRecord?.patient_safe_audit_summary?.trim() ||
    (uploadedViews.length > 0
      ? `We received ${uploadedViews.length} clinical view${uploadedViews.length === 1 ? "" : "s"} for review. Our clinical team will assess image quality and completeness.`
      : PATIENT_VISUAL_SUMMARY_NOT_RECORDED);

  return {
    uploadedViews,
    imageQualityStatus: deriveAuditImageQualityStatus(input.images),
    clinicalReviewStatus: deriveClinicalReviewStatus(input.images),
    missingOrRetakeViews: missingOrRetake,
    longitudinalComparisonAvailable: Boolean(input.longitudinalComparisonAvailable),
    patientSafeSummary: patientSafeReportTextIsAllowed(patientSafeSummary)
      ? patientSafeSummary
      : "Clinical photography received for team review.",
  };
}

export function patientSafeReportTextIsAllowed(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return !FORBIDDEN_REPORT_PATTERNS.some((re) => re.test(t));
}

export function patientVisualSummaryReportIsPatientSafe(report: PatientVisualSummaryReport): boolean {
  const texts: string[] = [
    report.header.patientDisplay,
    report.header.clinicName ?? "",
    ...report.hairlinePrinciples,
    ...report.photoPanel.map((p) => p.status_message),
    ...report.graftDistributionZones.map((z) => z.notes ?? ""),
    ...report.densityZones.map((z) => `${z.label} ${z.qualitativeLabel}`),
    report.auditSummary?.patientSafeSummary ?? "",
  ];
  return texts.filter((t) => t.trim()).every((t) => patientSafeReportTextIsAllowed(t));
}

export function buildPatientVisualSummaryReport(
  input: PatientVisualSummaryReportBuildInput
): PatientVisualSummaryReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const staffRecord = input.staffRecord ?? readPatientVisualSummaryStaffRecord(input.caseMetadata);
  const approval =
    readPatientVisualSummaryApproval(input.caseMetadata, input.reportType) ??
    defaultPatientVisualSummaryApproval(input.reportType, input.surgeryId);

  const imageRows = input.images.map((i) => i.image);
  const auditImages =
    input.reportType === "hairaudit_visual_summary"
      ? imageRows.filter(
          (img) =>
            img.metadata?.upload_source === "hairaudit" ||
            (img.metadata?.dual_write as string | undefined)?.includes("imagingos")
        )
      : imageRows;

  const report: PatientVisualSummaryReport = {
    version: PATIENT_VISUAL_SUMMARY_VERSION,
    reportType: input.reportType,
    header: {
      patientDisplay: formatPatientDisplayName(input.patientName, input.useInitials),
      clinicName: input.clinicName?.trim() || null,
      procedureOrAuditDate: input.procedureOrAuditDate ?? null,
      reportType: input.reportType,
      reportTypeLabel: reportTypeLabel(input.reportType),
      generatedAt,
      disclaimer: PATIENT_VISUAL_SUMMARY_DISCLAIMER,
    },
    photoPanel: buildPhotoPanel(input.images),
    graftDistributionZones: buildRecipientZones({ staffRecord }),
    hairlinePrinciples: extractPatientSafeHairlinePrinciples({
      staffRecord,
      recipientStrategyNotes: input.recipientStrategyNotes,
      surgicalPlanSummary: input.surgicalPlanSummary,
    }),
    graftTypeSummary: buildGraftTypeSummary({
      composition: input.graftComposition ?? null,
      fiveHairGrafts: staffRecord?.five_hair_grafts ?? null,
    }),
    densityZones: buildDensityZones(staffRecord),
    healingTimeline: HEALING_TIMELINE_MILESTONES,
    timelineVariationNote: "Timelines vary between patients.",
    monitoringItems: [...MONITORING_ITEMS],
    auditSummary:
      input.reportType === "hairaudit_visual_summary"
        ? buildHairAuditAuditSummary({
            images: auditImages.length > 0 ? auditImages : imageRows,
            staffRecord,
            longitudinalComparisonAvailable: input.longitudinalComparisonAvailable,
          })
        : null,
    approval,
    patientAccessAllowed: patientVisualSummaryPatientAccessAllowed(approval),
  };

  return report;
}