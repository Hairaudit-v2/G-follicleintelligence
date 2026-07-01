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
  IiohrImagesUploadedPayload,
} from "@/src/types/fi-events";

/**
 * HTTP-ingest allow-list (`parseFiEventEnvelope`).
 *
 * **Cross-system (default policy may still block emit):** producer-shaped events intended
 * for shared intelligence envelopes / future bus — must appear in
 * `@follicle/intelligence-core` `INTELLIGENCE_EVENT_NAMES` (see drift tests).
 *
 * **Local-only (FI ingest only):** accepted for idempotency / logging but not treated as
 * cross-system graph/export signals by default — `clinic.ai.usage`.
 */
export const fiEventTypeSchema = [
  "hli.intake.submitted",
  "hli.document.uploaded",
  "hairaudit.case.submitted",
  "hairaudit.images.uploaded",
  "iiohr.images.uploaded",
  "clinic.ai.usage",
] as const;

/** Ingest event types documented as FI-local / telemetry; excluded from cross-system drift set. */
export const FI_INGEST_LOCAL_ONLY_EVENT_TYPES = ["clinic.ai.usage"] as const;

export type FiIngestLocalOnlyEventType = (typeof FI_INGEST_LOCAL_ONLY_EVENT_TYPES)[number];

/** Ingest names intended for cross-system contract alignment (subset of `fiEventTypeSchema`). */
export const FI_INGEST_CROSS_SYSTEM_EVENT_TYPES = fiEventTypeSchema.filter(
  (t): t is Exclude<(typeof fiEventTypeSchema)[number], FiIngestLocalOnlyEventType> =>
    !(FI_INGEST_LOCAL_ONLY_EVENT_TYPES as readonly string[]).includes(t)
);

const fiSourceSystemSchema = ["hli", "hairaudit", "iiohr", "clinic"] as const;
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
    case "iiohr.images.uploaded":
      return sourceSystem === "iiohr";
    case "clinic.ai.usage":
      return sourceSystem === "clinic";
  }
}

function parseIdentifiers(input: unknown): NonNullable<FiEventEnvelope["identifiers"]> | undefined {
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

  const full_name = asTrimmedString(intake.full_name);
  const email = asTrimmedString(intake.email);
  const dob = asTrimmedString(intake.dob);
  const sex = asTrimmedString(intake.sex);
  if (!full_name) return { ok: false, error: "payload.intake.full_name is required." };
  if (!email) return { ok: false, error: "payload.intake.email is required." };
  if (!dob) return { ok: false, error: "payload.intake.dob is required." };
  if (!sex) return { ok: false, error: "payload.intake.sex is required." };

  const selectionsRaw = parseSelections(intake.selections);
  const selections = selectionsRaw && !Array.isArray(selectionsRaw) ? selectionsRaw : undefined;

  return {
    ok: true,
    data: {
      intake: {
        full_name,
        email,
        dob,
        sex,
        country: asOptionalTrimmedString(intake.country),
        primary_concern: asOptionalTrimmedString(intake.primary_concern),
        selections,
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
    return {
      ok: false,
      error: "payload.document.kind must be blood_pdf, blood_csv, or supporting_docs.",
    };
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

function parseHairAuditCasePayload(
  input: unknown
): ValidationResult<HairAuditCaseSubmittedPayload> {
  const payload = isRecord(input) ? input : {};
  const casePayload = isRecord(payload.case) ? payload.case : null;
  if (!casePayload) return { ok: false, error: "payload.case is required." };

  const primaryConcern =
    asOptionalTrimmedString(casePayload.primary_concern) ??
    asOptionalTrimmedString(casePayload.concern);

  const caseSelectionsRaw = parseSelections(casePayload.selections);
  const caseSelections =
    caseSelectionsRaw && !Array.isArray(caseSelectionsRaw) ? caseSelectionsRaw : undefined;

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
        selections: caseSelections,
        notes: asOptionalTrimmedString(casePayload.notes),
      },
    },
  };
}

function parseHairAuditImagesPayload(
  input: unknown
): ValidationResult<HairAuditImagesUploadedPayload> {
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

function parseIiohrImagesPayload(input: unknown): ValidationResult<IiohrImagesUploadedPayload> {
  const payload = isRecord(input) ? input : {};
  const academy_case_id = asTrimmedString(payload.academy_case_id);
  const original_filename = asTrimmedString(payload.original_filename);
  const storage_path = asOptionalTrimmedString(payload.storage_path);
  const image_url = asOptionalTrimmedString(payload.image_url);

  if (!academy_case_id) {
    return { ok: false, error: "payload.academy_case_id is required." };
  }
  if (!original_filename) {
    return { ok: false, error: "payload.original_filename is required." };
  }
  if (!storage_path && !image_url) {
    return {
      ok: false,
      error: "payload.storage_path or payload.image_url is required.",
    };
  }

  const metadataRaw = payload.metadata;
  const metadata =
    metadataRaw && isRecord(metadataRaw) ? (metadataRaw as Record<string, unknown>) : undefined;
  const uploaded_at = asOptionalTrimmedString(payload.uploaded_at);
  if (uploaded_at && !isIsoDateString(uploaded_at)) {
    return { ok: false, error: "payload.uploaded_at must be ISO datetime." };
  }

  return {
    ok: true,
    data: {
      academy_case_id,
      patient_id: asOptionalTrimmedString(payload.patient_id),
      patient_external_id: asOptionalTrimmedString(payload.patient_external_id),
      professional_id: asOptionalTrimmedString(payload.professional_id),
      global_professional_id: asOptionalTrimmedString(payload.global_professional_id),
      storage_path,
      image_url,
      mime_type: asOptionalTrimmedString(payload.mime_type),
      original_filename,
      canonical_view: asOptionalTrimmedString(payload.canonical_view),
      external_view: asOptionalTrimmedString(payload.external_view),
      uploaded_at,
      size_bytes: typeof payload.size_bytes === "number" ? payload.size_bytes : undefined,
      metadata,
    },
  };
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
  "iiohr.images.uploaded": parseIiohrImagesPayload,
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
  | IiohrImagesUploadedPayload
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
