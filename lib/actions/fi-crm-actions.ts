"use server";

import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  crmAppendActivityBodySchema,
  crmArchiveLeadCommunicationBodySchema,
  crmArchiveLeadNoteBodySchema,
  crmCompleteTaskBodySchema,
  crmConvertLeadBodySchema,
  crmCreateLeadBodySchema,
  crmCreateLeadCommunicationBodySchema,
  crmCreateLeadNoteBodySchema,
  crmCreateNoteBodySchema,
  crmCreateTaskBodySchema,
  crmMessagePreviewBodySchema,
  crmMoveLeadStageBodySchema,
  crmReopenTaskBodySchema,
  crmUpdateLeadCommunicationBodySchema,
  crmUpdateLeadDetailsBodySchema,
  crmUpdateLeadNoteBodySchema,
  crmUpdateTaskBodySchema,
} from "@/src/lib/crm/crmApiSchemas";
import { assertMessagePayloadHasNoForbiddenBodyKeys } from "@/src/lib/crm/messageBodyKeysPolicy";
import {
  appendCrmActivityEvent,
  archiveCrmLeadCommunication,
  archiveCrmLeadNote,
  completeCrmTask,
  createCrmLeadCommunication,
  createCrmLeadNote,
  createCrmLeadWithPerson,
  createCrmMessagePreview,
  createCrmNoteForLead,
  createCrmTask,
  executeCrmLeadConversion,
  moveCrmLeadToStage,
  reopenCrmTask,
  updateCrmLeadCommunication,
  updateCrmLeadDetails,
  updateCrmLeadNote,
  updateCrmTask,
} from "@/src/lib/crm/server";
import { z, ZodError } from "zod";
import { getCrmShellSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellLeadSlideOverPayload, type CrmLeadShellSlideOverPayload } from "@/src/lib/crm/crmShellLoaders";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function crmCreateLeadAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; lead: Awaited<ReturnType<typeof createCrmLeadWithPerson>> } | { ok: false; error: string }> {
  try {
    const parsed = crmCreateLeadBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    if (parsed.personId) {
      const lead = await createCrmLeadWithPerson({
        tenantId,
        organisationId: parsed.organisationId ?? undefined,
        clinicId: parsed.clinicId ?? undefined,
        patientId: parsed.patientId ?? undefined,
        caseId: parsed.caseId ?? undefined,
        primaryOwnerUserId: parsed.primaryOwnerUserId ?? undefined,
        status: parsed.status,
        priority: parsed.priority ?? undefined,
        summary: parsed.summary,
        metadata: parsed.metadata ?? undefined,
        pipelineKey: parsed.pipelineKey,
        sourceSystem: parsed.sourceSystem ?? undefined,
        sourceLeadId: parsed.sourceLeadId ?? undefined,
        personId: parsed.personId,
      });
      return { ok: true, lead };
    }

    if (parsed.person) {
      const lead = await createCrmLeadWithPerson({
        tenantId,
        organisationId: parsed.organisationId ?? undefined,
        clinicId: parsed.clinicId ?? undefined,
        patientId: parsed.patientId ?? undefined,
        caseId: parsed.caseId ?? undefined,
        primaryOwnerUserId: parsed.primaryOwnerUserId ?? undefined,
        status: parsed.status,
        priority: parsed.priority ?? undefined,
        summary: parsed.summary,
        metadata: parsed.metadata ?? undefined,
        pipelineKey: parsed.pipelineKey,
        sourceSystem: parsed.sourceSystem ?? undefined,
        sourceLeadId: parsed.sourceLeadId ?? undefined,
        person: {
          source_system: parsed.person.source_system ?? undefined,
          source_person_id: parsed.person.source_person_id ?? undefined,
          source_patient_id: parsed.person.source_patient_id ?? undefined,
          display_name: parsed.person.display_name ?? undefined,
          email: parsed.person.email ?? undefined,
          phone: parsed.person.phone ?? undefined,
          date_of_birth: parsed.person.date_of_birth ?? undefined,
          sex: parsed.person.sex ?? undefined,
          metadata: parsed.person.metadata ?? undefined,
        },
      });
      return { ok: true, lead };
    }

    return { ok: false, error: "Provide personId or person with resolution fields." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function crmMoveLeadStageAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<
  | { ok: true; lead: Awaited<ReturnType<typeof moveCrmLeadToStage>>["lead"]; timelineEventId: string | null }
  | { ok: false; error: string }
> {
  try {
    const parsed = crmMoveLeadStageBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const result = await moveCrmLeadToStage({
      tenantId,
      leadId,
      toStageId: parsed.toStageId,
      changedBy: parsed.changedBy ?? null,
      reason: parsed.reason ?? null,
      source: parsed.source,
    });
    return { ok: true, lead: result.lead, timelineEventId: result.timelineEventId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function crmAppendActivityAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; event: Awaited<ReturnType<typeof appendCrmActivityEvent>> } | { ok: false; error: string }> {
  try {
    const parsed = crmAppendActivityBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const event = await appendCrmActivityEvent({
      tenantId,
      leadId,
      activityKind: parsed.activityKind,
      title: parsed.title ?? null,
      detail: parsed.detail ?? null,
      occurredAt: parsed.occurredAt ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
    });
    return { ok: true, event };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function crmCreateTaskAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; task: Awaited<ReturnType<typeof createCrmTask>> } | { ok: false; error: string }> {
  try {
    const parsed = crmCreateTaskBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const task = await createCrmTask({
      tenantId,
      leadId,
      title: parsed.title,
      description: parsed.description ?? null,
      taskType: parsed.taskType,
      status: parsed.status,
      dueAt: parsed.dueAt ?? null,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      assigneeUserId: parsed.assigneeUserId ?? null,
      metadata: parsed.metadata ?? null,
    });
    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateCrmTaskAction(
  tenantId: string,
  leadId: string,
  taskId: string,
  body: unknown
): Promise<{ ok: true; task: Awaited<ReturnType<typeof updateCrmTask>> } | { ok: false; error: string }> {
  try {
    const parsed = crmUpdateTaskBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const task = await updateCrmTask({
      tenantId,
      leadId,
      taskId,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.taskType !== undefined ? { taskType: parsed.taskType } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.dueAt !== undefined ? { dueAt: parsed.dueAt } : {}),
      ...(parsed.assigneeUserId !== undefined ? { assigneeUserId: parsed.assigneeUserId } : {}),
    });
    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function completeCrmTaskAction(
  tenantId: string,
  leadId: string,
  taskId: string,
  body: unknown
): Promise<{ ok: true; task: Awaited<ReturnType<typeof completeCrmTask>> } | { ok: false; error: string }> {
  try {
    const parsed = crmCompleteTaskBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const task = await completeCrmTask({ tenantId, leadId, taskId });
    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function reopenCrmTaskAction(
  tenantId: string,
  leadId: string,
  taskId: string,
  body: unknown
): Promise<{ ok: true; task: Awaited<ReturnType<typeof reopenCrmTask>> } | { ok: false; error: string }> {
  try {
    const parsed = crmReopenTaskBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const task = await reopenCrmTask({ tenantId, leadId, taskId });
    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function crmCreateNoteAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; note: Awaited<ReturnType<typeof createCrmNoteForLead>> } | { ok: false; error: string }> {
  try {
    const parsed = crmCreateNoteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const note = await createCrmNoteForLead({
      tenantId,
      leadId,
      body: parsed.body,
      visibility: parsed.visibility,
      authorUserId: parsed.authorUserId ?? null,
      metadata: parsed.metadata ?? null,
    });
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createCrmLeadNoteAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; note: Awaited<ReturnType<typeof createCrmLeadNote>> } | { ok: false; error: string }> {
  try {
    const parsed = crmCreateLeadNoteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const authorUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const note = await createCrmLeadNote({
      tenantId,
      leadId,
      noteBody: parsed.noteBody,
      noteVisibility: parsed.noteVisibility,
      isPinned: parsed.isPinned,
      authorUserId,
    });
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateCrmLeadNoteAction(
  tenantId: string,
  leadId: string,
  noteId: string,
  body: unknown
): Promise<{ ok: true; note: Awaited<ReturnType<typeof updateCrmLeadNote>> } | { ok: false; error: string }> {
  try {
    const parsed = crmUpdateLeadNoteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const note = await updateCrmLeadNote({
      tenantId,
      leadId,
      noteId,
      ...(parsed.noteBody !== undefined ? { noteBody: parsed.noteBody } : {}),
      ...(parsed.noteVisibility !== undefined ? { noteVisibility: parsed.noteVisibility } : {}),
      ...(parsed.isPinned !== undefined ? { isPinned: parsed.isPinned } : {}),
    });
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function archiveCrmLeadNoteAction(
  tenantId: string,
  leadId: string,
  noteId: string,
  body: unknown
): Promise<{ ok: true; note: Awaited<ReturnType<typeof archiveCrmLeadNote>> } | { ok: false; error: string }> {
  try {
    const parsed = crmArchiveLeadNoteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const note = await archiveCrmLeadNote({ tenantId, leadId, noteId });
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createCrmLeadCommunicationAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; communication: Awaited<ReturnType<typeof createCrmLeadCommunication>> } | { ok: false; error: string }> {
  try {
    const parsed = crmCreateLeadCommunicationBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actorUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const communication = await createCrmLeadCommunication({
      tenantId,
      leadId,
      communicationType: parsed.communicationType,
      direction: parsed.direction,
      outcome: parsed.outcome,
      subject: parsed.subject,
      preview: parsed.preview,
      externalMessageId: parsed.externalMessageId,
      externalThreadId: parsed.externalThreadId,
      contactAt: parsed.contactAt,
      nextFollowUpAt: parsed.nextFollowUpAt,
      metadata: parsed.metadata,
      actorUserId,
    });
    return { ok: true, communication };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateCrmLeadCommunicationAction(
  tenantId: string,
  leadId: string,
  communicationId: string,
  body: unknown
): Promise<{ ok: true; communication: Awaited<ReturnType<typeof updateCrmLeadCommunication>> } | { ok: false; error: string }> {
  try {
    const parsed = crmUpdateLeadCommunicationBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const communication = await updateCrmLeadCommunication({
      tenantId,
      leadId,
      communicationId,
      ...(parsed.communicationType !== undefined ? { communicationType: parsed.communicationType } : {}),
      ...(parsed.direction !== undefined ? { direction: parsed.direction } : {}),
      ...(parsed.outcome !== undefined ? { outcome: parsed.outcome } : {}),
      ...(parsed.subject !== undefined ? { subject: parsed.subject } : {}),
      ...(parsed.preview !== undefined ? { preview: parsed.preview } : {}),
      ...(parsed.contactAt !== undefined ? { contactAt: parsed.contactAt } : {}),
      ...(parsed.nextFollowUpAt !== undefined ? { nextFollowUpAt: parsed.nextFollowUpAt } : {}),
      ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
    });
    return { ok: true, communication };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function archiveCrmLeadCommunicationAction(
  tenantId: string,
  leadId: string,
  communicationId: string,
  body: unknown
): Promise<{ ok: true; communication: Awaited<ReturnType<typeof archiveCrmLeadCommunication>> } | { ok: false; error: string }> {
  try {
    const parsed = crmArchiveLeadCommunicationBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const communication = await archiveCrmLeadCommunication({ tenantId, leadId, communicationId });
    return { ok: true, communication };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function convertCrmLeadAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; result: Awaited<ReturnType<typeof executeCrmLeadConversion>> } | { ok: false; error: string }> {
  try {
    const parsed = crmConvertLeadBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const convertedByUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const result = await executeCrmLeadConversion({
      tenantId,
      leadId,
      seedCase: parsed.seedCase ?? false,
      caseType: parsed.caseType,
      treatmentInterest: parsed.treatmentInterest,
      conversionNote: parsed.conversionNote,
      convertedByUserId,
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function crmCreateMessagePreviewAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; message: Awaited<ReturnType<typeof createCrmMessagePreview>> } | { ok: false; error: string }> {
  try {
    if (body && typeof body === "object") {
      assertMessagePayloadHasNoForbiddenBodyKeys(body as Record<string, unknown>);
    }
    const parsed = crmMessagePreviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const message = await createCrmMessagePreview({
      tenantId,
      leadId,
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
      preview: parsed.preview as Record<string, unknown>,
    });
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateCrmLeadDetailsAction(
  tenantId: string,
  leadId: string,
  body: unknown
): Promise<{ ok: true; lead: Awaited<ReturnType<typeof updateCrmLeadDetails>> } | { ok: false; error: string }> {
  try {
    const parsed = crmUpdateLeadDetailsBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const lead = await updateCrmLeadDetails({
      tenantId,
      leadId,
      summary: parsed.summary,
      status: parsed.status,
      priority: parsed.priority,
      primaryOwnerUserId: parsed.primaryOwnerUserId,
      organisationId: parsed.organisationId,
      clinicId: parsed.clinicId,
      metadata: parsed.metadata,
      adminMetadataMerge: parsed.adminMetadataMerge ?? null,
      fiAdminKey: parsed.adminKey ?? null,
    });
    return { ok: true, lead };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const crmLeadSlideOverLoadSchema = z.object({
  tenantId: z.string().uuid(),
  leadId: z.string().uuid(),
});

export async function crmLoadLeadSlideOverBundleAction(
  tenantId: string,
  leadId: string
): Promise<{ ok: true; data: CrmLeadShellSlideOverPayload } | { ok: false; error: string }> {
  try {
    const parsed = crmLeadSlideOverLoadSchema.parse({ tenantId, leadId });
    const session = await getCrmShellSessionIfAllowed(parsed.tenantId);
    if (!session) return { ok: false, error: "Not signed in or CRM access denied for this tenant." };
    const data = await loadCrmShellLeadSlideOverPayload(parsed.tenantId, parsed.leadId);
    if (!data) return { ok: false, error: "Lead not found." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
