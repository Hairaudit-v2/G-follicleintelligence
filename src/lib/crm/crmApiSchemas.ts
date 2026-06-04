import { z } from "zod";
import { assertMessagePayloadHasNoForbiddenBodyKeys } from "./messageBodyKeysPolicy";
import {
  CRM_LEAD_DETAIL_PRIORITY_VALUES,
  CRM_LEAD_DETAIL_STATUS_VALUES,
} from "./crmLeadDetailsPolicy";
import { CRM_LEAD_NOTE_VISIBILITY_VALUES } from "./crmLeadNotePolicy";
import { CRM_TASK_ACTIVE_STATUS_VALUES, CRM_TASK_TYPE_VALUES } from "./crmTaskPolicy";
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

const taskActiveStatusTuple = CRM_TASK_ACTIVE_STATUS_VALUES as unknown as [string, ...string[]];
const taskTypeTuple = CRM_TASK_TYPE_VALUES as unknown as [string, ...string[]];

function refineDueAtString(val: string | null | undefined, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (val === undefined || val === null) return;
  const s = String(val).trim();
  if (!s) return;
  if (Number.isNaN(Date.parse(s))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid due_at datetime.", path });
  }
}

export const crmCreateTaskBodySchema = z
  .object({
    adminKey: z.string().optional(),
    title: z.string().min(1).max(512),
    description: z.string().max(8000).optional().nullable(),
    taskType: z.enum(taskTypeTuple).optional(),
    status: z.enum(taskActiveStatusTuple).optional(),
    dueAt: z.string().max(64).optional().nullable(),
    patientId: optionalUuid,
    caseId: optionalUuid,
    assigneeUserId: optionalUuid,
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  })
  .strict()
  .superRefine((body, ctx) => {
    refineDueAtString(body.dueAt ?? undefined, ctx, ["dueAt"]);
  });

export const crmUpdateTaskBodySchema = z
  .object({
    adminKey: z.string().optional(),
    title: z.string().min(1).max(512).optional(),
    description: z.string().max(8000).optional().nullable(),
    taskType: z.string().max(64).optional(),
    status: z.string().max(64).optional(),
    dueAt: z.union([z.string().max(64), z.null()]).optional(),
    assigneeUserId: optionalUuid,
  })
  .strict()
  .superRefine((body, ctx) => {
    refineDueAtString(body.dueAt === null ? undefined : body.dueAt, ctx, ["dueAt"]);
    const keys = ["title", "description", "taskType", "status", "dueAt", "assigneeUserId"] as const;
    const any = keys.some((k) => body[k] !== undefined);
    if (!any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update.",
        path: ["title"],
      });
    }
  });

export const crmCompleteTaskBodySchema = z
  .object({
    adminKey: z.string().optional(),
  })
  .strict();

export const crmReopenTaskBodySchema = z
  .object({
    adminKey: z.string().optional(),
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

const leadNoteVisTuple = CRM_LEAD_NOTE_VISIBILITY_VALUES as unknown as [string, ...string[]];

export const crmCreateLeadNoteBodySchema = z
  .object({
    adminKey: z.string().optional(),
    noteBody: z.string().min(1).max(32000),
    noteVisibility: z.enum(leadNoteVisTuple).optional(),
    isPinned: z.boolean().optional(),
  })
  .strict();

export const crmUpdateLeadNoteBodySchema = z
  .object({
    adminKey: z.string().optional(),
    noteBody: z.string().min(1).max(32000).optional(),
    noteVisibility: z.enum(leadNoteVisTuple).optional(),
    isPinned: z.boolean().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const any = body.noteBody !== undefined || body.noteVisibility !== undefined || body.isPinned !== undefined;
    if (!any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update.",
        path: ["noteBody"],
      });
    }
  });

export const crmArchiveLeadNoteBodySchema = z
  .object({
    adminKey: z.string().optional(),
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

const statusTuple = CRM_LEAD_DETAIL_STATUS_VALUES as unknown as [string, ...string[]];
const priorityTuple = CRM_LEAD_DETAIL_PRIORITY_VALUES as unknown as [string, ...string[]];
const nullOrUuid = z.union([UUID, z.null()]);

/** PATCH /crm/leads/[leadId] — lead details only; never accepts stage fields (use move-stage). */
export const crmUpdateLeadDetailsBodySchema = z
  .object({
    adminKey: z.string().optional(),
    summary: z.string().min(1, "Lead title / summary is required.").max(4000),
    status: z.enum(statusTuple),
    priority: z.union([z.enum(priorityTuple), z.null()]),
    primaryOwnerUserId: nullOrUuid,
    organisationId: nullOrUuid,
    clinicId: nullOrUuid,
    metadata: z.record(z.string(), z.any()).optional(),
    adminMetadataMerge: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export type CrmCreateLeadBody = z.infer<typeof crmCreateLeadBodySchema>;
export type CrmMoveLeadStageBody = z.infer<typeof crmMoveLeadStageBodySchema>;
export type CrmAppendActivityBody = z.infer<typeof crmAppendActivityBodySchema>;
export type CrmCreateTaskBody = z.infer<typeof crmCreateTaskBodySchema>;
export type CrmUpdateTaskBody = z.infer<typeof crmUpdateTaskBodySchema>;
export type CrmCompleteTaskBody = z.infer<typeof crmCompleteTaskBodySchema>;
export type CrmReopenTaskBody = z.infer<typeof crmReopenTaskBodySchema>;
export type CrmCreateNoteBody = z.infer<typeof crmCreateNoteBodySchema>;
export type CrmMessagePreviewBody = z.infer<typeof crmMessagePreviewBodySchema>;
export type CrmUpdateLeadDetailsBody = z.infer<typeof crmUpdateLeadDetailsBodySchema>;
