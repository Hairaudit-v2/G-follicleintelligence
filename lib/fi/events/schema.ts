/**
 * Event ingestion schema + validation for additive FI event facade.
 * Follows the repo's existing ValidationResult-style parser convention.
 */

import type { ValidationResult } from "@/lib/fi/validation";
import type {
  FiEventEnvelope,
  FiEventType,
  FiSourceSystem,
  HliIntakeSubmittedPayload,
  HliDocumentUploadedPayload,
  HairAuditCaseSubmittedPayload,
  HairAuditImagesUploadedPayload,
} from "@/src/types/fi-events";

export const fiEventTypeSchema = [
  "hli.intake.submitted",
  "hli.document.uploaded",
  "hairaudit.case.submitted",
  "hairaudit.images.uploaded",
  "clinic.ai.usage",
] as const;

const fiSourceSystemSchema = ["hli", "hairaudit", "clinic"] as const;
const hliDocumentKinds = ["blood_pdf", "blood_csv", "supporting_docs"] as const;

export type HliIntakePayload = HliIntakeSubmittedPayload;
export type UploadedDocumentPayload = HliDocumentUploadedPayload;
export type HairAuditCasePayload = HairAuditCaseSubmittedPayload;
export type HairAuditImagesPayload = HairAuditImagesUploadedPayload;
export type ClinicAiUsagePayload = {
  usage: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalTrimmedString(value: unknown): string | undefined {
  const trimmed = asTrimmedString(value);
  return trimmed || undefined;
}

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function isAllowedEventType(value: string): value is FiEventType {
  return fiEventTypeSchema.includes(value as FiEventType);
}

function isAllowedSourceSystem(value: string): value is FiSourceSystem {
  return fiSourceSystemSchema.includes(value as FiSourceSystem);
}

function isCompatibleSourceSystem(eventType: FiEventType, sourceSystem: FiSourceSystem): boolean {
  switch (eventType) {
    case "hli.intake.submitted":
    case "hli.document.uploaded":
      return sourceSystem === "hli";
    case "hairaudit.case.submitted":
    case "hairaudit.images.uploaded":
      return sourceSystem === "hairaudit";
    case "clinic.ai.usage":
      return sourceSystem === "clinic";
  }
}

function parseIdentifiers(
  input: unknown
): NonNullable<FiEventEnvelope["identifiers"]> | undefined {
  if (!isRecord(input)) return undefined;
  return {
    source_patient_id: asOptionalTrimmedString(input.source_patient_id),
    source_case_id: asOptionalTrimmedString(input.source_case_id),
    source_clinic_id: asOptionalTrimmedString(input.source_clinic_id),
    source_doctor_id: asOptionalTrimmedString(input.source_doctor_id),
  };
}

function parseSelections(value: unknown): Record<string, unknown> | unknown[] | undefined {
  if (isRecord(value)) return value;
  if (Array.isArray(value)) return value;
  return undefined;
}

function parseHliIntakePayload(input: unknown): ValidationResult<HliIntakeSubmittedPayload> {
  const payload = isRecord(input) ? input : {};
  const intake = isRecord(payload.intake) ? payload.intake : null;
  if (!intake) return { ok: false, error: "payload.intake is required." };

  return {
    ok: true,
    data: {
      intake: {
        full_name: asOptionalTrimmedString(intake.full_name),
        email: asOptionalTrimmedString(intake.email),
        dob: asOptionalTrimmedString(intake.dob),
        sex: asOptionalTrimmedString(intake.sex),
        country: asOptionalTrimmedString(intake.country),
        primary_concern: asOptionalTrimmedString(intake.primary_concern),
        selections: parseSelections(intake.selections),
        notes: asOptionalTrimmedString(intake.notes),
      },
    },
  };
}

function parseHliDocumentPayload(input: unknown): ValidationResult<HliDocumentUploadedPayload> {
  const payload = isRecord(input) ? input : {};
  const document = isRecord(payload.document) ? payload.document : null;
  if (!document) return { ok: false, error: "payload.document is required." };

  const kind = asTrimmedString(document.kind);
  const filename = asTrimmedString(document.filename);
  const storage_path = asTrimmedString(document.storage_path);
  if (!hliDocumentKinds.includes(kind as (typeof hliDocumentKinds)[number])) {
    return { ok: false, error: "payload.document.kind must be blood_pdf, blood_csv, or supporting_docs." };
  }
  if (!filename) return { ok: false, error: "payload.document.filename is required." };
  if (!storage_path) return { ok: false, error: "payload.document.storage_path is required." };

  return {
    ok: true,
    data: {
      document: {
        kind: kind as HliDocumentUploadedPayload["document"]["kind"],
        filename,
        storage_path,
        mime_type: asOptionalTrimmedString(document.mime_type),
        size_bytes: typeof document.size_bytes === "number" ? document.size_bytes : undefined,
      },
    },
  };
}

function parseHairAuditCasePayload(input: unknown): ValidationResult<HairAuditCaseSubmittedPayload> {
  const payload = isRecord(input) ? input : {};
  const casePayload = isRecord(payload.case) ? payload.case : null;
  if (!casePayload) return { ok: false, error: "payload.case is required." };

  const primaryConcern =
    asOptionalTrimmedString(casePayload.primary_concern) ??
    asOptionalTrimmedString(casePayload.concern);

  return {
    ok: true,
    data: {
      case: {
        patient_name: asOptionalTrimmedString(casePayload.patient_name),
        email: asOptionalTrimmedString(casePayload.email),
        dob: asOptionalTrimmedString(casePayload.dob),
        sex: asOptionalTrimmedString(casePayload.sex),
        primary_concern: primaryConcern,
        country: asOptionalTrimmedString(casePayload.country),
        selections: parseSelections(casePayload.selections),
        notes: asOptionalTrimmedString(casePayload.notes),
      },
    },
  };
}

function parseHairAuditImagesPayload(input: unknown): ValidationResult<HairAuditImagesUploadedPayload> {
  const payload = isRecord(input) ? input : {};
  const images = Array.isArray(payload.images) ? payload.images : null;
  if (!images || images.length === 0) {
    return { ok: false, error: "payload.images must be a non-empty array." };
  }

  const parsedImages: HairAuditImagesUploadedPayload["images"] = [];
  for (const image of images) {
    if (!isRecord(image)) return { ok: false, error: "payload.images contains invalid item." };
    const type = asTrimmedString(image.type);
    const filename = asTrimmedString(image.filename);
    const storage_path = asTrimmedString(image.storage_path);
    if (!type) return { ok: false, error: "payload.images[].type is required." };
    if (!filename) return { ok: false, error: "payload.images[].filename is required." };
    if (!storage_path) return { ok: false, error: "payload.images[].storage_path is required." };

    parsedImages.push({
      type,
      filename,
      storage_path,
      mime_type: asOptionalTrimmedString(image.mime_type),
      size_bytes: typeof image.size_bytes === "number" ? image.size_bytes : undefined,
    });
  }

  return { ok: true, data: { images: parsedImages } };
}

function parseClinicAiUsagePayload(input: unknown): ValidationResult<ClinicAiUsagePayload> {
  const payload = isRecord(input) ? input : {};
  const usage = isRecord(payload.usage) ? payload.usage : null;
  if (!usage) return { ok: false, error: "payload.usage is required." };
  return { ok: true, data: { usage } };
}

export const fiEventPayloadSchemaMap = {
  "hli.intake.submitted": parseHliIntakePayload,
  "hli.document.uploaded": parseHliDocumentPayload,
  "hairaudit.case.submitted": parseHairAuditCasePayload,
  "hairaudit.images.uploaded": parseHairAuditImagesPayload,
  "clinic.ai.usage": parseClinicAiUsagePayload,
} as const;

export const fiEventEnvelopeSchema = {
  eventTypes: fiEventTypeSchema,
  sourceSystems: fiSourceSystemSchema,
  parse: parseFiEventEnvelope,
} as const;

export function parseFiEventPayload(
  eventType: FiEventType,
  payload: unknown
): ValidationResult<
  | HliIntakeSubmittedPayload
  | HliDocumentUploadedPayload
  | HairAuditCaseSubmittedPayload
  | HairAuditImagesUploadedPayload
  | ClinicAiUsagePayload
> {
  return fiEventPayloadSchemaMap[eventType](payload);
}

export function parseFiEventEnvelope(input: unknown): ValidationResult<FiEventEnvelope> {
  const body = isRecord(input) ? input : {};
  const tenant_id = asTrimmedString(body.tenant_id);
  const event_type_raw = asTrimmedString(body.event_type);
  const source_system_raw = asTrimmedString(body.source_system);
  const source_event_id = asTrimmedString(body.source_event_id);
  const occurred_at = asOptionalTrimmedString(body.occurred_at);
  const identifiers = parseIdentifiers(body.identifiers);

  if (!tenant_id) return { ok: false, error: "tenant_id is required." };
  if (!isAllowedEventType(event_type_raw)) {
    return { ok: false, error: "Unsupported event_type." };
  }
  if (!isAllowedSourceSystem(source_system_raw)) {
    return { ok: false, error: "Unsupported source_system." };
  }
  if (!isCompatibleSourceSystem(event_type_raw, source_system_raw)) {
    return { ok: false, error: "source_system must match event_type." };
  }
  if (!source_event_id) return { ok: false, error: "source_event_id is required." };
  if (occurred_at && !isIsoDateString(occurred_at)) {
    return { ok: false, error: "occurred_at must be ISO datetime." };
  }
  if (!isRecord(body.payload)) return { ok: false, error: "payload must be an object." };

  const payloadResult = parseFiEventPayload(event_type_raw, body.payload);
  if (!payloadResult.ok) return payloadResult;

  return {
    ok: true,
    data: {
      tenant_id,
      event_type: event_type_raw,
      source_system: source_system_raw,
      source_event_id,
      occurred_at,
      identifiers,
      payload: payloadResult.data as Record<string, unknown>,
    },
  };
}

export const validateFiEventEnvelope = parseFiEventEnvelope;
