"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { readFiProcedureDayEnabled } from "@/src/lib/procedureDay/procedureDayEnv.server";
import { assertProcedureDayMutationAllowed } from "@/src/lib/procedureDay/procedureDayMutationAccess.server";
import {
  advanceProcedureDayStage,
  completeProcedureDaySession,
  dischargeProcedureDayPatient,
  recordProcedureDayMetric,
  startProcedureDaySession,
} from "@/src/lib/procedureDay/procedureDayMutations.server";
import {
  procedureDayAdvanceStageSchema,
  procedureDayBookingIdSchema,
  procedureDayCompleteSchema,
  procedureDayDischargeSchema,
  procedureDayGraftIncrementSchema,
  procedureDayMetricSchema,
} from "@/src/lib/procedureDay/procedureDayWorkflowTypes";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function assertLiveWorkflowEnabled(): void {
  if (!readFiProcedureDayEnabled()) {
    throw new Error("Procedure Day live workflow is disabled (FI_PROCEDURE_DAY_ENABLED).");
  }
}

function revalidateProcedureDayPaths(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/procedure-day`);
  revalidatePath(`/fi-admin/${tid}/surgery-os`);
  revalidatePath(`/fi-admin/${tid}/reception-board`);
}

export async function startProcedureDaySessionAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertLiveWorkflowEnabled();
    const parsed = procedureDayBookingIdSchema.parse(body);
    const actor = await assertProcedureDayMutationAllowed(tenantId, parsed.adminKey);
    await startProcedureDaySession(tenantId, parsed.booking_id, actor);
    revalidateProcedureDayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function advanceProcedureDayStageAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertLiveWorkflowEnabled();
    const parsed = procedureDayAdvanceStageSchema.parse(body);
    const actor = await assertProcedureDayMutationAllowed(tenantId, parsed.adminKey);
    await advanceProcedureDayStage(tenantId, parsed.booking_id, actor, parsed.to_stage);
    revalidateProcedureDayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function recordProcedureDayMetricAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertLiveWorkflowEnabled();
    const parsed = procedureDayMetricSchema.parse(body);
    const actor = await assertProcedureDayMutationAllowed(tenantId, parsed.adminKey);
    await recordProcedureDayMetric(tenantId, parsed.booking_id, actor, {
      metric: parsed.metric,
      value: parsed.value,
      increment: parsed.increment,
    });
    revalidateProcedureDayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function incrementProcedureDayGraftAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertLiveWorkflowEnabled();
    const parsed = procedureDayGraftIncrementSchema.parse(body);
    const actor = await assertProcedureDayMutationAllowed(tenantId, parsed.adminKey);
    const metric =
      parsed.field === "grafts_extracted"
        ? "grafts_extracted"
        : parsed.field === "grafts_implanted"
          ? "grafts_implanted"
          : "hairs_counted";
    await recordProcedureDayMetric(tenantId, parsed.booking_id, actor, {
      metric,
      value: 0,
      increment: parsed.delta,
    });
    revalidateProcedureDayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function completeProcedureDaySessionAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertLiveWorkflowEnabled();
    const parsed = procedureDayCompleteSchema.parse(body);
    const actor = await assertProcedureDayMutationAllowed(tenantId, parsed.adminKey);
    await completeProcedureDaySession(tenantId, parsed.booking_id, actor, {
      postOpSummary: parsed.post_op_summary,
      createFollowUpTask: parsed.create_follow_up_task,
    });
    revalidateProcedureDayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function dischargeProcedureDayPatientAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertLiveWorkflowEnabled();
    const parsed = procedureDayDischargeSchema.parse(body);
    const actor = await assertProcedureDayMutationAllowed(tenantId, parsed.adminKey);
    await dischargeProcedureDayPatient(tenantId, parsed.booking_id, actor, parsed.discharge_notes);
    revalidateProcedureDayPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}