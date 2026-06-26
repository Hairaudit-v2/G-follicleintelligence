"use server";

import { revalidatePath } from "next/cache";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  generateVieOutcomeSummaryForPatient,
  loadVieOutcomeSummaryForPatient,
} from "@/src/lib/vie/vieOutcomeIntelligence.server";
import type { VieOutcomeSummary, VieOutcomeSummaryRow } from "@/src/lib/vie/vieOutcomeTypes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateVieOutcomePaths(tenantId: string, patientId: string) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
  revalidatePath(`/fi-admin/${tid}/surgery-os`);
}

export async function generateVieOutcomeSummaryAction(
  tenantId: string,
  patientId: string,
  body?: { adminKey?: string; caseId?: string | null }
): Promise<{ ok: true; summary: VieOutcomeSummary } | { ok: false; error: string }> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: body?.adminKey, request: undefined });
    const summary = await generateVieOutcomeSummaryForPatient({
      tenantId,
      patientId,
      caseId: body?.caseId ?? null,
    });
    revalidateVieOutcomePaths(tenantId, patientId);
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadVieOutcomeSummaryAction(
  tenantId: string,
  patientId: string,
  caseId?: string | null
): Promise<VieOutcomeSummaryRow | null> {
  return loadVieOutcomeSummaryForPatient(tenantId, patientId, { caseId });
}
