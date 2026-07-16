"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  formatPatientAiSummaryForNote,
  generatePatientAiSummary,
  isPatientAiSummaryEnabledForTenant,
  setPatientAiSummaryEnabledForTenant,
} from "@/src/lib/patients/ai-summary/patientAiSummary.server";
import type { PatientAiSummaryResult } from "@/src/lib/patients/ai-summary/patientAiSummaryTypes";

const tenantIdSchema = z.string().uuid();
const patientIdSchema = z.string().min(8).max(80);

async function actorId(): Promise<string | null> {
  return resolveAuthUserId(null);
}

export async function generatePatientAiSummaryAction(
  tenantId: string,
  patientId: string,
  opts?: { forceRefresh?: boolean }
): Promise<
  { ok: true; summary: PatientAiSummaryResult; noteText: string } | { ok: false; error: string }
> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const pid = patientIdSchema.parse(patientId);
    const authId = await actorId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await generatePatientAiSummary(
      tid,
      pid,
      { forceRefresh: Boolean(opts?.forceRefresh) },
      { actorAuthUserId: authId }
    );
    if (!result.ok) return result;
    return {
      ok: true,
      summary: result.summary,
      noteText: formatPatientAiSummaryForNote(result.summary),
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to generate AI summary.",
    };
  }
}

export async function getPatientAiSummaryEnabledAction(
  tenantId: string
): Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await actorId();
    if (!authId) return { ok: false, error: "Authentication required." };
    const enabled = await isPatientAiSummaryEnabledForTenant(tid, {
      actorAuthUserId: authId,
    });
    return { ok: true, enabled };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load setting." };
  }
}

export async function setPatientAiSummaryEnabledAction(
  tenantId: string,
  enabled: boolean
): Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await actorId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await setPatientAiSummaryEnabledForTenant(tid, Boolean(enabled), {
      actorAuthUserId: authId,
    });
    if (!result.ok) return result;
    revalidatePath(`/fi-admin/${tid}/settings/clinic-guide`);
    revalidatePath(`/fi-admin/${tid}/configuration`);
    return { ok: true, enabled: Boolean(enabled) };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update setting." };
  }
}
