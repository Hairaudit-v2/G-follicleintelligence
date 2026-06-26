"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  generateVieComparisonPairsForPatient,
  loadVieComparisonPairsForPatient,
  loadVieComparisonTimelineForPatient,
  updateVieComparisonReviewStatus,
} from "@/src/lib/vie/vieLongitudinalComparison.server";
import type { VieComparisonPairRow, VieComparisonReviewStatus, VieProgressionTimeline } from "@/src/lib/vie/vieComparisonTypes";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const reviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    pairId: z.string().uuid(),
    reviewStatus: z.enum(["accepted", "dismissed"]),
  })
  .strict();

export async function generateVieComparisonPairsAction(
  tenantId: string,
  patientId: string,
  body?: { adminKey?: string; caseId?: string | null }
): Promise<{ ok: true; generated_count: number } | { ok: false; error: string }> {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: body?.adminKey, request: undefined });
    const result = await generateVieComparisonPairsForPatient({
      tenantId,
      patientId,
      caseId: body?.caseId ?? null,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/imaging`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/twin`);
    return { ok: true, generated_count: result.generated_count };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadVieComparisonPairsAction(
  tenantId: string,
  patientId: string,
  opts?: { caseId?: string | null; reviewStatus?: VieComparisonReviewStatus | "all" }
): Promise<VieComparisonPairRow[]> {
  return loadVieComparisonPairsForPatient(tenantId, patientId, opts);
}

export async function loadVieComparisonTimelineAction(
  tenantId: string,
  patientId: string,
  caseId?: string | null
): Promise<VieProgressionTimeline> {
  return loadVieComparisonTimelineForPatient(tenantId, patientId, caseId);
}

export async function updateVieComparisonReviewStatusAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = reviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    await updateVieComparisonReviewStatus({
      tenantId,
      patientId,
      pairId: parsed.pairId,
      reviewStatus: parsed.reviewStatus,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/imaging`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/twin`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
