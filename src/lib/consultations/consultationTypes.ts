import { z } from "zod";

import { CONSULTATION_TYPE_DEFINITIONS, type ConsultationTypeId as ConfigConsultationTypeId } from "./consultationTypeConfig";

/** Row status — must match `fi_consultations_status_chk`. */
export const CONSULTATION_STATUSES = [
  "draft",
  "in_progress",
  "completed",
  "quoted",
  "accepted",
  "converted_to_case",
  "archived",
] as const;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export type ConsultationTypeId = ConfigConsultationTypeId;

/** MVP structured JSON keys (panels). */
export const CONSULTATION_STRUCTURED_SECTION_KEYS = [
  "summary",
  "assessment",
  "donor",
  "medical",
  "recommendations",
  "brow_design",
  "beard_design",
  "body_hair",
  "regenerative_assessment",
  "medical_hair_loss",
] as const;

export type ConsultationStructuredSectionKey = (typeof CONSULTATION_STRUCTURED_SECTION_KEYS)[number];

/** MVP quote JSON keys (UI mirrors these snake_case fields). */
export const CONSULTATION_QUOTE_DATA_KEYS = [
  "session_size",
  "graft_estimate",
  "price_quoted",
  "other_services",
  "finance_options",
  "quote_status",
] as const;

export type ConsultationQuoteDataKey = (typeof CONSULTATION_QUOTE_DATA_KEYS)[number];

export const consultationStatusSchema = z.enum(CONSULTATION_STATUSES);

const consultationTypeIdLiterals = CONSULTATION_TYPE_DEFINITIONS.map((d) => d.id) as [
  ConsultationTypeId,
  ...ConsultationTypeId[],
];

export const consultationTypeIdSchema = z.enum(consultationTypeIdLiterals);

/** MVP: allow any JSON object shape inside sections / quote. */
export const consultationStructuredDataSchema = z.record(z.string(), z.unknown());

export const consultationQuoteDataSchema = z.record(z.string(), z.unknown());

export type ConsultationRow = {
  id: string;
  tenant_id: string;
  person_id: string | null;
  patient_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  consultation_type: ConsultationTypeId;
  status: ConsultationStatus;
  consultant_name: string | null;
  consultation_date: string | null;
  structured_data: Record<string, unknown>;
  live_notes: string | null;
  recommendation_notes: string | null;
  quote_data: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

/** Editable workspace statuses for server patch (Stage 3C). */
export const CONSULTATION_EDITABLE_STATUSES = ["draft", "in_progress"] as const;
export type ConsultationEditableStatus = (typeof CONSULTATION_EDITABLE_STATUSES)[number];

export const consultationEditableStatusSchema = z.enum(CONSULTATION_EDITABLE_STATUSES);

const optionalUuid = z.string().uuid();

export const consultationCreateDraftBodySchema = z
  .object({
    adminKey: z.string().optional(),
    consultation_type: consultationTypeIdSchema,
    /** Optional foundation patient link (`fi_patients.id`). */
    patient_id: optionalUuid.optional(),
    /** Optional person link (`fi_persons.id`) when no patient is selected. */
    person_id: optionalUuid.optional(),
    /** Optional CRM lead link (`fi_crm_leads.id`). */
    lead_id: optionalUuid.optional(),
  })
  .strict();

export type ConsultationCreateDraftBody = z.infer<typeof consultationCreateDraftBodySchema>;

/**
 * Manual save / patch payload (MVP). Server actions use this for `updateConsultationDraft`.
 * (Named “upsert” in roadmap docs; row insert is separate `consultationCreateDraftBodySchema`.)
 */
const uuidOrNull = z.union([z.string().uuid(), z.null()]);

export const consultationUpsertBodySchema = z
  .object({
    adminKey: z.string().optional(),
    consultation_type: consultationTypeIdSchema.optional(),
    status: consultationEditableStatusSchema.optional(),
    consultant_name: z.string().nullable().optional(),
    /** ISO date `YYYY-MM-DD` or null / empty to clear */
    consultation_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
      .optional(),
    structured_data: consultationStructuredDataSchema.optional(),
    live_notes: z.string().nullable().optional(),
    recommendation_notes: z.string().nullable().optional(),
    quote_data: consultationQuoteDataSchema.optional(),
    patient_id: uuidOrNull.optional(),
    person_id: uuidOrNull.optional(),
    lead_id: uuidOrNull.optional(),
  })
  .strict();

export type ConsultationUpsertBody = z.infer<typeof consultationUpsertBodySchema>;

/** Mark consultation completed (terminal transition from draft / in-progress). */
export const consultationCompleteBodySchema = z
  .object({
    adminKey: z.string().optional(),
  })
  .strict();

export type ConsultationCompleteBody = z.infer<typeof consultationCompleteBodySchema>;

/** @deprecated alias — prefer `consultationUpsertBodySchema` */
export const consultationUpdateDraftBodySchema = consultationUpsertBodySchema;
export type ConsultationUpdateDraftBody = ConsultationUpsertBody;
