import "server-only";

import { loadConsultationFormInstance } from "@/src/lib/consultationForms/consultationFormLoad.server";
import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import {
  createConsultationFollowUpTaskFromSummary,
  createConsultationPathologyRecommendationFromSummary,
  createConsultationQuoteDraftFromSummary,
  createSurgeryPlanningDraftFromConsultationSummary,
  loadConsultationHandoffState,
  requireLockedHandoffContext,
} from "@/src/lib/consultationForms/handoff/consultationHandoffMutations.server";
import {
  followUpTaskRecommended,
  pathologyHandoffRecommended,
  surgeryPlanningHandoffEligible,
} from "@/src/lib/consultationForms/handoff/consultationHandoffPure";
import type { ConsultationHandoffBaseInput } from "@/src/lib/consultationForms/handoff/consultationHandoffTypes";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";

import {
  quoteDraftAllowedForAutomationRun,
  type ConsultationAutomationEnabledHandoffs,
  type ConsultationAutomationHandoffKind,
} from "./consultationAutomationPolicy";

export type {
  ConsultationAutomationEnabledHandoffs,
  ConsultationAutomationHandoffKind,
} from "./consultationAutomationPolicy";
export { quoteDraftAllowedForAutomationRun } from "./consultationAutomationPolicy";

export type ConsultationAutomationHandoffRunStatus = "success" | "skipped" | "failed";

export type ConsultationAutomationHandoffResult = {
  handoff: ConsultationAutomationHandoffKind;
  status: ConsultationAutomationHandoffRunStatus;
  reason: string;
  entityId?: string;
  existingEntityId?: string;
  error?: { message: string; code?: string };
};

export type RunConsultationCompletionAutomationOptions = {
  tenantId: string;
  formInstanceId: string;
  actorUserId?: string | null;
  dryRun?: boolean;
  enabledHandoffs?: ConsultationAutomationEnabledHandoffs;
};

export type RunConsultationCompletionAutomationResult = {
  contextReady: boolean;
  contextError?: string;
  tenantId: string;
  formInstanceId: string;
  consultationId: string | null;
  dryRun: boolean;
  handoffs: ConsultationAutomationHandoffResult[];
};

const HANDOFF_ORDER: ConsultationAutomationHandoffKind[] = [
  "follow_up_task",
  "quote_draft",
  "pathology_recommendation",
  "surgery_planning_draft",
];

function isHandoffNominated(
  kind: ConsultationAutomationHandoffKind,
  enabledHandoffs?: ConsultationAutomationEnabledHandoffs
): boolean {
  if (!enabledHandoffs) return true;
  return enabledHandoffs[kind] === true;
}

type LoadedConsultation = ConsultationRow;

function buildHandoffInput(
  tenantId: string,
  consultationId: string,
  formInstanceId: string,
  actorUserId: string | null
): ConsultationHandoffBaseInput {
  return { tenantId, consultationId, formInstanceId, actorUserId };
}

async function runFollowUpHandoff(
  input: ConsultationHandoffBaseInput,
  summary: ConsultationCompletionSummary,
  consultation: LoadedConsultation,
  dryRun: boolean,
  existingTaskId: string | null
): Promise<ConsultationAutomationHandoffResult> {
  const kind: ConsultationAutomationHandoffKind = "follow_up_task";
  if (!followUpTaskRecommended(summary)) {
    return {
      handoff: kind,
      status: "skipped",
      reason: "Follow-up task is not indicated for this completion summary.",
    };
  }
  const leadId = consultation.lead_id?.trim();
  if (!leadId) {
    return { handoff: kind, status: "skipped", reason: "Consultation has no linked CRM lead." };
  }
  if (dryRun) {
    if (existingTaskId) {
      return {
        handoff: kind,
        status: "skipped",
        reason: "Dry run: an open follow-up task already exists for this completion (would reuse).",
        entityId: existingTaskId,
        existingEntityId: existingTaskId,
      };
    }
    return {
      handoff: kind,
      status: "skipped",
      reason: "Dry run: gates passed; would create a follow-up CRM task.",
    };
  }
  try {
    const r = await createConsultationFollowUpTaskFromSummary(input);
    return {
      handoff: kind,
      status: "success",
      reason: r.reused ? "Follow-up task reused (idempotent)." : "Follow-up CRM task created.",
      entityId: r.id,
      ...(r.reused ? { existingEntityId: r.id } : {}),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      handoff: kind,
      status: "failed",
      reason: "Follow-up task mutation failed.",
      error: { message, code: "follow_up_task" },
    };
  }
}

async function runQuoteDraftHandoff(
  input: ConsultationHandoffBaseInput,
  summary: ConsultationCompletionSummary,
  consultation: LoadedConsultation,
  enabledHandoffs: ConsultationAutomationEnabledHandoffs | undefined,
  dryRun: boolean,
  existingQuoteId: string | null
): Promise<ConsultationAutomationHandoffResult> {
  const kind: ConsultationAutomationHandoffKind = "quote_draft";
  if (!quoteDraftAllowedForAutomationRun(enabledHandoffs, summary)) {
    return {
      handoff: kind,
      status: "skipped",
      reason:
        "Quote draft automation skipped: enable `quote_draft` in enabledHandoffs, or use default mode with clear quote/treatment intent in the summary.",
    };
  }
  const leadId = consultation.lead_id?.trim() || null;
  const caseId = consultation.case_id?.trim() || null;
  if (!leadId && !caseId) {
    return {
      handoff: kind,
      status: "skipped",
      reason: "Link a CRM lead or case on the consultation to create a quote draft.",
    };
  }
  if (dryRun) {
    if (existingQuoteId) {
      return {
        handoff: kind,
        status: "skipped",
        reason: "Dry run: a draft quote already exists for this form instance (would reuse).",
        entityId: existingQuoteId,
        existingEntityId: existingQuoteId,
      };
    }
    return {
      handoff: kind,
      status: "skipped",
      reason: "Dry run: gates passed; would create a draft CRM quote.",
    };
  }
  try {
    const r = await createConsultationQuoteDraftFromSummary(input);
    return {
      handoff: kind,
      status: "success",
      reason: r.reused ? "Quote draft reused (idempotent)." : "Draft CRM quote created.",
      entityId: r.id,
      ...(r.reused ? { existingEntityId: r.id } : {}),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      handoff: kind,
      status: "failed",
      reason: "Quote draft mutation failed.",
      error: { message, code: "quote_draft" },
    };
  }
}

async function runPathologyHandoff(
  input: ConsultationHandoffBaseInput,
  summary: ConsultationCompletionSummary,
  consultation: LoadedConsultation,
  dryRun: boolean,
  existingRequestId: string | null
): Promise<ConsultationAutomationHandoffResult> {
  const kind: ConsultationAutomationHandoffKind = "pathology_recommendation";
  if (!pathologyHandoffRecommended(summary)) {
    return {
      handoff: kind,
      status: "skipped",
      reason: "Pathology / screening was not flagged on this completion summary.",
    };
  }
  const patientId = consultation.patient_id?.trim();
  if (!patientId) {
    return { handoff: kind, status: "skipped", reason: "Consultation has no linked patient." };
  }
  if (dryRun) {
    if (existingRequestId) {
      return {
        handoff: kind,
        status: "skipped",
        reason:
          "Dry run: a saved pathology request already exists for this form instance (would reuse).",
        entityId: existingRequestId,
        existingEntityId: existingRequestId,
      };
    }
    return {
      handoff: kind,
      status: "skipped",
      reason: "Dry run: gates passed; would create a pathology request draft.",
    };
  }
  try {
    const r = await createConsultationPathologyRecommendationFromSummary(input);
    return {
      handoff: kind,
      status: "success",
      reason: r.reused ? "Pathology request reused (idempotent)." : "Pathology request created.",
      entityId: r.id,
      ...(r.reused ? { existingEntityId: r.id } : {}),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      handoff: kind,
      status: "failed",
      reason: "Pathology recommendation mutation failed.",
      error: { message, code: "pathology_recommendation" },
    };
  }
}

async function runSurgeryPlanningHandoff(
  input: ConsultationHandoffBaseInput,
  summary: ConsultationCompletionSummary,
  consultation: LoadedConsultation,
  dryRun: boolean,
  existingPlanId: string | null
): Promise<ConsultationAutomationHandoffResult> {
  const kind: ConsultationAutomationHandoffKind = "surgery_planning_draft";
  const caseId = consultation.case_id?.trim() || null;
  if (!surgeryPlanningHandoffEligible(summary, caseId)) {
    return {
      handoff: kind,
      status: "skipped",
      reason:
        "Surgery planning handoff requires proceed_surgery outcome, a linked case, and plan details in the summary.",
    };
  }
  if (dryRun) {
    if (existingPlanId) {
      return {
        handoff: kind,
        status: "skipped",
        reason: "Dry run: surgery plan already linked to this form instance (would reuse).",
        entityId: existingPlanId,
        existingEntityId: existingPlanId,
      };
    }
    return {
      handoff: kind,
      status: "skipped",
      reason: "Dry run: gates passed; would upsert a draft surgery plan for the case.",
    };
  }
  try {
    const r = await createSurgeryPlanningDraftFromConsultationSummary(input);
    return {
      handoff: kind,
      status: "success",
      reason: r.reused
        ? "Surgery plan handoff reused (idempotent)."
        : "Surgery planning draft applied to case plan.",
      entityId: r.id,
      ...(r.reused ? { existingEntityId: r.id } : {}),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      handoff: kind,
      status: "failed",
      reason: "Surgery planning draft mutation failed.",
      error: { message, code: "surgery_planning_draft" },
    };
  }
}

/**
 * Trusted-server orchestration of consultation completion handoffs (CRM task, quote draft, pathology, surgery plan).
 *
 * Preconditions match `requireLockedHandoffContext` in handoff mutations: the form instance must be **locked**
 * with a valid `rules_v1` completion summary. Call **after** completion succeeds (or from tooling with the same state).
 *
 * Does **not** wire into `completeConsultationFormInstance` yet (see design doc).
 */
export async function runConsultationCompletionAutomation(
  options: RunConsultationCompletionAutomationOptions
): Promise<RunConsultationCompletionAutomationResult> {
  const tenantId = options.tenantId?.trim() ?? "";
  const formInstanceId = options.formInstanceId?.trim() ?? "";
  const dryRun = Boolean(options.dryRun);
  const actorUserId = options.actorUserId?.trim() || null;
  const enabledHandoffs = options.enabledHandoffs;

  if (!tenantId || !formInstanceId) {
    throw new Error(
      "runConsultationCompletionAutomation requires non-empty tenantId and formInstanceId."
    );
  }

  const empty: RunConsultationCompletionAutomationResult = {
    contextReady: false,
    tenantId,
    formInstanceId,
    consultationId: null,
    dryRun,
    handoffs: [],
  };

  let consultationId: string | null = null;
  try {
    const inst = await loadConsultationFormInstance(tenantId, formInstanceId);
    if (!inst) {
      return {
        ...empty,
        contextError: "Form instance not found for this tenant.",
      };
    }
    consultationId = inst.consultation_id.trim() || null;
    if (!consultationId) {
      return { ...empty, contextError: "Form instance is missing consultation_id." };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ...empty, contextError: `Failed to load form instance: ${message}` };
  }

  let summary: ConsultationCompletionSummary;
  let consultation: LoadedConsultation;
  try {
    const ctx = await requireLockedHandoffContext(tenantId, consultationId!, formInstanceId);
    summary = ctx.summary;
    consultation = ctx.consultation;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ...empty,
      consultationId,
      contextError: message,
    };
  }

  const input = buildHandoffInput(tenantId, consultationId!, formInstanceId, actorUserId);

  const existing = await loadConsultationHandoffState(tenantId, consultationId!, formInstanceId);

  const handoffs: ConsultationAutomationHandoffResult[] = [];

  for (const kind of HANDOFF_ORDER) {
    if (!isHandoffNominated(kind, enabledHandoffs)) {
      handoffs.push({
        handoff: kind,
        status: "skipped",
        reason: "Handoff not selected (enabledHandoffs filter).",
      });
      continue;
    }

    let row: ConsultationAutomationHandoffResult;
    switch (kind) {
      case "follow_up_task":
        row = await runFollowUpHandoff(
          input,
          summary,
          consultation,
          dryRun,
          existing.followUpTaskId
        );
        break;
      case "quote_draft":
        row = await runQuoteDraftHandoff(
          input,
          summary,
          consultation,
          enabledHandoffs,
          dryRun,
          existing.quoteId
        );
        break;
      case "pathology_recommendation":
        row = await runPathologyHandoff(
          input,
          summary,
          consultation,
          dryRun,
          existing.pathologyRequestId
        );
        break;
      case "surgery_planning_draft":
        row = await runSurgeryPlanningHandoff(
          input,
          summary,
          consultation,
          dryRun,
          existing.surgeryPlanId
        );
        break;
    }
    handoffs.push(row);
  }

  return {
    contextReady: true,
    tenantId,
    formInstanceId,
    consultationId,
    dryRun,
    handoffs,
  };
}
