/**
 * Compatibility adapter: flat PatientImageIngestionContext → discriminated ingest context.
 */

import { normalizeFiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionCore";
import {
  extractFollowUpEncounterId,
  isLegacyFollowUpIngestContext,
} from "./legacyFollowUpIngestCore";
import { validateLegacyFollowUpIngestContext } from "./legacyFollowUpIngestCore";
import type {
  ConsultationOsIngestContext,
  FlatPatientImageIngestionContext,
  GenericFiOsIngestContext,
  HairauditIngestContext,
  HliIngestContext,
  IiohrIngestContext,
  ImagingOsWizardIngestContext,
  IngestContextValidationResult,
  LegacyFollowUpIngestContext,
  ParsedPatientImageIngestContext,
  PatientPortalIngestContext,
  SurgeryOsIngestContext,
  UnknownIngestContext,
  VieCaptureWizardIngestContext,
} from "./patientImageIngestContextTypes";

function normalizeUploadSource(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isFollowUpReviewTemplate(templateSlug: string | null | undefined): boolean {
  return normalizeUploadSource(templateSlug) === "follow_up_review";
}

function buildSharedBase(input: FlatPatientImageIngestionContext) {
  return {
    tenant_id: input.tenant_id,
    patient_id: input.patient_id,
    image_id: input.image_id,
    case_id: input.case_id,
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path,
    content_type: input.content_type,
    size_bytes: input.size_bytes,
    fi_event_id: input.fi_event_id,
    fi_upload_id: input.fi_upload_id,
    metadata: input.metadata,
    capture_source: normalizeFiImageCaptureSource(input.capture_source),
    upload_source: input.upload_source?.trim() ? normalizeUploadSource(input.upload_source) : null,
    image_category: input.image_category,
    external_category: input.external_category,
    protocol_template_slug: input.protocol_template_slug,
    protocol_slot_slug: input.protocol_slot_slug,
    follow_up_interval: input.follow_up_interval,
    visit_type: input.visit_type,
  };
}

function protocolFields(input: FlatPatientImageIngestionContext) {
  return {
    protocol_template_slug: input.protocol_template_slug,
    protocol_slot_slug: input.protocol_slot_slug,
    follow_up_interval: input.follow_up_interval,
    visit_type: input.visit_type,
  };
}

function attributionFields(input: FlatPatientImageIngestionContext) {
  return {
    image_category: input.image_category,
    external_category: input.external_category,
    anatomical_region: input.anatomical_region,
    captured_by_staff_id: input.captured_by_staff_id,
  };
}

function resolveIngestKind(input: FlatPatientImageIngestionContext): ParsedPatientImageIngestContext["kind"] {
  const base = buildSharedBase(input);
  const captureSource = base.capture_source;
  const rawCaptureSource = normalizeUploadSource(input.capture_source);
  const uploadSource = base.upload_source ?? "";

  if (uploadSource === "hairaudit" || captureSource === "hairaudit" || rawCaptureSource === "hairaudit") {
    return "hairaudit";
  }
  if (uploadSource === "hair_longevity" || rawCaptureSource === "hli") {
    return "hli";
  }
  if (captureSource === "iiohr_academy" || uploadSource === "iiohr") {
    return "iiohr";
  }
  if (captureSource === "surgery_os") {
    return "surgery_os";
  }
  if (
    isLegacyFollowUpIngestContext({
      capture_source: captureSource,
      protocol_template_slug: input.protocol_template_slug,
    })
  ) {
    return "legacy_follow_up";
  }
  if (captureSource === "consultation_os" || input.consultation_id?.trim()) {
    return "consultation_os";
  }
  if (captureSource === "patient_portal") {
    return "patient_portal";
  }
  if (captureSource === "imaging_os_wizard") {
    return "imaging_os_wizard";
  }
  if (captureSource === "vie_capture_wizard") {
    return "vie_capture_wizard";
  }
  if (captureSource === "unknown") {
    return "unknown";
  }
  return "generic_fi_os";
}

/**
 * Parse legacy flat ingest input into a discriminated capture context.
 * Normalizes capture_source via {@link normalizeFiImageCaptureSource}.
 */
export function parsePatientImageIngestionContext(
  input: FlatPatientImageIngestionContext
): ParsedPatientImageIngestContext {
  const shared = buildSharedBase(input);
  const kind = resolveIngestKind(input);

  switch (kind) {
    case "hairaudit":
      return {
        kind,
        ...shared,
        legacy_upload_type: input.legacy_upload_type,
        hairaudit_image_type: input.hairaudit_image_type,
      } satisfies HairauditIngestContext;

    case "hli":
      return {
        kind,
        ...shared,
        legacy_upload_type: input.legacy_upload_type,
        hli_document_kind: input.hli_document_kind,
      } satisfies HliIngestContext;

    case "iiohr":
      return {
        kind,
        ...shared,
        legacy_upload_type: input.legacy_upload_type,
        hairaudit_image_type: input.hairaudit_image_type,
      } satisfies IiohrIngestContext;

    case "consultation_os":
      return {
        kind,
        ...shared,
        consultation_id: input.consultation_id?.trim() || "",
        form_instance_id: input.form_instance_id,
        ...attributionFields(input),
      } satisfies ConsultationOsIngestContext;

    case "surgery_os":
      return {
        kind,
        ...shared,
        booking_id: input.booking_id,
        procedure_day_id: input.procedure_day_id,
        captured_by_staff_id: input.captured_by_staff_id,
        ...protocolFields(input),
      } satisfies SurgeryOsIngestContext;

    case "legacy_follow_up":
      return {
        kind,
        ...shared,
        captured_by_staff_id: input.captured_by_staff_id,
        follow_up_encounter_id: extractFollowUpEncounterId(input.metadata),
        ...protocolFields(input),
      } satisfies LegacyFollowUpIngestContext;

    case "patient_portal":
      return {
        kind,
        ...shared,
        image_category: input.image_category,
        external_category: input.external_category,
        ...protocolFields(input),
      } satisfies PatientPortalIngestContext;

    case "imaging_os_wizard":
      return {
        kind,
        ...shared,
        consultation_id: input.consultation_id,
        ...protocolFields(input),
        ...attributionFields(input),
      } satisfies ImagingOsWizardIngestContext;

    case "vie_capture_wizard":
      return {
        kind,
        ...shared,
        consultation_id: input.consultation_id,
        ...protocolFields(input),
        ...attributionFields(input),
      } satisfies VieCaptureWizardIngestContext;

    case "unknown":
      return {
        kind,
        ...shared,
        consultation_id: input.consultation_id,
        ...protocolFields(input),
        ...attributionFields(input),
      } satisfies UnknownIngestContext;

    default:
      return {
        kind: "generic_fi_os",
        ...shared,
        consultation_id: input.consultation_id,
        ...protocolFields(input),
        ...attributionFields(input),
      } satisfies GenericFiOsIngestContext;
  }
}

export function validateSurgeryOsIngestContext(
  ctx: SurgeryOsIngestContext
): IngestContextValidationResult {
  const issues: IngestContextValidationResult["issues"] = [];
  if (!ctx.booking_id?.trim() && !ctx.case_id?.trim()) {
    issues.push({
      field: "booking_id",
      message: "surgery_os ingest expects booking_id or case_id for workflow linkage",
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateHairauditIngestContext(
  ctx: HairauditIngestContext
): IngestContextValidationResult {
  const issues: IngestContextValidationResult["issues"] = [];
  const caseId = ctx.case_id?.trim() || ctx.patient_id?.trim();
  if (!caseId) {
    issues.push({
      field: "case_id",
      message: "hairaudit ingest expects case_id or patient_id",
    });
  }
  const externalImageId = ctx.fi_upload_id?.trim() || ctx.image_id?.trim();
  if (!externalImageId) {
    issues.push({
      field: "external_image_id",
      message: "hairaudit ingest expects fi_upload_id or image_id",
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateImagingOsWizardIngestContext(
  ctx: ImagingOsWizardIngestContext
): IngestContextValidationResult {
  const issues: IngestContextValidationResult["issues"] = [];
  if (!ctx.protocol_template_slug?.trim()) {
    issues.push({
      field: "protocol_template_slug",
      message: "imaging_os_wizard ingest expects protocol_template_slug for session taxonomy",
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateVieCaptureWizardIngestContext(
  ctx: VieCaptureWizardIngestContext
): IngestContextValidationResult {
  const issues: IngestContextValidationResult["issues"] = [];
  if (!ctx.protocol_template_slug?.trim()) {
    issues.push({
      field: "protocol_template_slug",
      message: "vie_capture_wizard ingest expects protocol_template_slug for session taxonomy",
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateParsedPatientImageIngestContext(
  ctx: ParsedPatientImageIngestContext
): IngestContextValidationResult {
  switch (ctx.kind) {
    case "surgery_os":
      return validateSurgeryOsIngestContext(ctx);
    case "hairaudit":
      return validateHairauditIngestContext(ctx);
    case "imaging_os_wizard":
      return validateImagingOsWizardIngestContext(ctx);
    case "vie_capture_wizard":
      return validateVieCaptureWizardIngestContext(ctx);
    case "legacy_follow_up":
      return validateLegacyFollowUpIngestContext(ctx);
    default:
      return { valid: true, issues: [] };
  }
}