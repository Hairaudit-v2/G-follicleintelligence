"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import {
  PATIENT_JOURNEY_STATES,
  type PatientJourneyState,
} from "@/src/lib/patientJourney/patientJourneyStateCore";
import { applyPatientJourneyTransition } from "@/src/lib/patientJourney/patientJourneyStateMutations.server";
import { loadPatientJourneySnapshot } from "@/src/lib/patientJourney/patientJourneyState.server";

const manualOverrideBodySchema = z
  .object({
    adminKey: z.string().optional(),
    toState: z.enum(PATIENT_JOURNEY_STATES as unknown as [PatientJourneyState, ...PatientJourneyState[]]),
    reason: z.string().min(3).max(2000),
    overrideExpiresAt: z.string().datetime().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    caseId: z.string().uuid().optional().nullable(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

/**
 * Manual patient journey override — writes timeline, CRM activity, and transition audit log.
 */
export async function manualOverridePatientJourneyStateAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true; state: PatientJourneyState } | { ok: false; error: string }> {
  try {
    const parsed = manualOverrideBodySchema.parse(body ?? {});
    const tid = tenantId.trim();
    const pid = patientId.trim();

    await assertCrmTenantWriteAllowed({
      tenantId: tid,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);

    const snapshot = await loadPatientJourneySnapshot(tid, pid);
    const result = await applyPatientJourneyTransition({
      tenantId: tid,
      patientId: pid,
      toState: parsed.toState,
      reason: "manual_override",
      source: "manual",
      actorFiUserId: fiUserId,
      overrideExpiresAt: parsed.overrideExpiresAt ?? null,
      derivedState: snapshot.derivedState,
      leadId: parsed.leadId ?? null,
      caseId: parsed.caseId ?? null,
      detail: { manual_reason: parsed.reason },
    });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/reception-board`);

    return { ok: true, state: result.row.currentState };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function syncPatientJourneyStateAction(
  tenantId: string,
  patientId: string,
  body?: unknown
): Promise<{ ok: true; state: PatientJourneyState } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    const tid = tenantId.trim();
    const pid = patientId.trim();
    await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey, request: undefined });

    const { syncPatientJourneyStateFromRecords } = await import(
      "@/src/lib/patientJourney/patientJourneyState.server"
    );
    const { snapshot } = await syncPatientJourneyStateFromRecords(tid, pid);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    return { ok: true, state: snapshot.state };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}