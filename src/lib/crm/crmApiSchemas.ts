import { z } from "zod";
import { assertMessagePayloadHasNoForbiddenBodyKeys } from "./messageBodyKeysPolicy";
import { normaliseOptionalLeadSource } from "./leadSourceMappingPolicy";

const UUID = z.string().uuid();

const optionalUuid = z.union([UUID, z.null()]).optional();

const personResolutionSchema = z.object({
  source_system: z.string().max(128).optional().nullable(),
  source_person_id: z.string().max(512).optional().nullable(),
  source_patient_id: z.string().max(512).optional().nullable(),
  display_name: z.string().max(512).optional().nullable(),
  email: z.string().max(254).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  date_of_birth: z.string().max(32).optional().nullable(),
  sex: z.string().max(32).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

function hasPersonResolutionSignal(p: z.infer<typeof personResolutionSchema>): boolean {
  const email = p.email?.trim();
  const phone = p.phone?.trim();
  const display = p.display_name?.trim();
  return Boolean(
    p.source_person_id?.trim() ||
      p.source_patient_id?.trim() ||
      (email && email.length > 0) ||
      (phone && phone.length > 0) ||
      (display && display.length > 0)
  );
}

/** POST /crm/leads — requires non-empty summary, optional external source pair, and `personId` or resolvable `person`. */
export const crmCreateLeadBodySchema = z
  .object({
    adminKey: z.string().optional(),
    organisationId: optionalUuid,
    clinicId: optionalUuid,
    patientId: optionalUuid,
    caseId: optionalUuid,
    primaryOwnerUserId: optionalUuid,
    status: z.string().max(64).optional(),
    priority: z.string().max(64).optional().nullable(),
    summary: z.string().min(1, "Lead title / summary is required.").max(4000),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
    pipelineKey: z.string().max(128).optional(),
    sourceSystem: z.string().max(128).optional().nullable(),
    sourceLeadId: z.string().max(512).optional().nullable(),
    personId: UUID.optional(),
    person: personResolutionSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    try {
      normaliseOptionalLeadSource(val.sourceSystem, val.sourceLeadId);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : "Invalid source system / lead id pair.",
      });
    }
    if (val.personId) return;
    if (val.person && hasPersonResolutionSignal(val.person)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide personId or person with at least one of: email, phone, display_name, source_person_id, source_patient_id.",
    });
  });

export const crmMoveLeadStageBodySchema = z
  .object({
    adminKey: z.string().optional(),
    toStageId: UUID,
    changedBy: optionalUuid,
    reason: z.string().max(2000).optional().nullable(),
    source: z.string().max(64).optional(),
  })
  .strict();

export const crmAppendActivityBodySchema = z
  .object({
    adminKey: z.string().optional(),
    activityKind: z.string().min(1).max(128),
    title: z.string().max(512).optional().nullable(),
    detail: z.record(z.string(), z.any()).optional().nullable(),
    occurredAt: z.string().max(64).optional().nullable(),
    patientId: optionalUuid,
    caseId: optionalUuid,
  })
  .strict();

export const crmCreateTaskBodySchema = z
  .object({
    adminKey: z.string().optional(),
    title: z.string().min(1).max(512),
    description: z.string().max(8000).optional().nullable(),
    taskType: z.string().max(64).optional(),
    status: z.string().max(64).optional(),
    dueAt: z.string().max(64).optional().nullable(),
    patientId: optionalUuid,
    caseId: optionalUuid,
    assigneeUserId: optionalUuid,
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  })
  .strict();

export const crmCreateNoteBodySchema = z
  .object({
    adminKey: z.string().optional(),
    body: z.string().min(1).max(32000),
    visibility: z.string().max(32).optional(),
    authorUserId: optionalUuid,
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  })
  .strict();

const previewRecordSchema = z
  .record(z.string(), z.any())
  .superRefine((val, ctx) => {
    try {
      assertMessagePayloadHasNoForbiddenBodyKeys(val as Record<string, unknown>);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : "Invalid message preview payload.",
      });
    }
  });

export const crmMessagePreviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patientId: optionalUuid,
    caseId: optionalUuid,
    preview: previewRecordSchema,
  })
  .strict();

export const crmPipelineStagesQuerySchema = z
  .object({
    organisationId: z.string().uuid().optional().nullable(),
    clinicId: z.string().uuid().optional().nullable(),
    pipelineKey: z.string().max(128).optional().nullable(),
  })
  .strict();

export type CrmCreateLeadBody = z.infer<typeof crmCreateLeadBodySchema>;
export type CrmMoveLeadStageBody = z.infer<typeof crmMoveLeadStageBodySchema>;
export type CrmAppendActivityBody = z.infer<typeof crmAppendActivityBodySchema>;
export type CrmCreateTaskBody = z.infer<typeof crmCreateTaskBodySchema>;
export type CrmCreateNoteBody = z.infer<typeof crmCreateNoteBodySchema>;
export type CrmMessagePreviewBody = z.infer<typeof crmMessagePreviewBodySchema>;
