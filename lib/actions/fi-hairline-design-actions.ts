"use server";

import { revalidatePath } from "next/cache";
import {
  approveHairlineDesign,
  createHairlineDesignVersion,
  rejectHairlineDesign,
  submitHairlineForReview,
  updateHairlineDesignGeometry,
} from "@/src/lib/cases/surgeryProjection/hairlineMutations.server";
import type { HairlineGeometry } from "@/src/lib/cases/surgeryProjection/hairlineDomain";

function casePath(tenantId: string, caseId: string): string {
  return `/fi-admin/${tenantId}/cases/${caseId}`;
}

export async function fiCreateHairlineDesignAction(input: {
  tenantId: string;
  caseId: string;
  surgicalPlanId: string;
  sourceImageRef: string;
  sourceImageChecksum: string;
  sourceImageId?: string | null;
  authorUserId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await createHairlineDesignVersion(input);
  if (!result.ok) return { ok: false, error: result.code };
  revalidatePath(casePath(input.tenantId, input.caseId));
  return { ok: true, id: result.id };
}

export async function fiUpdateHairlineGeometryAction(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  patch: Partial<Omit<HairlineGeometry, "polylineNorm">>;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await updateHairlineDesignGeometry(input);
  if (!result.ok) return { ok: false, error: result.code };
  revalidatePath(casePath(input.tenantId, input.caseId));
  return { ok: true };
}

export async function fiSubmitHairlineAction(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await submitHairlineForReview(input);
  if (!result.ok) return { ok: false, error: result.code };
  revalidatePath(casePath(input.tenantId, input.caseId));
  return { ok: true };
}

export async function fiApproveHairlineAction(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await approveHairlineDesign(input);
  if (!result.ok) return { ok: false, error: result.code };
  revalidatePath(casePath(input.tenantId, input.caseId));
  return { ok: true };
}

export async function fiRejectHairlineAction(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await rejectHairlineDesign(input);
  if (!result.ok) return { ok: false, error: result.code };
  revalidatePath(casePath(input.tenantId, input.caseId));
  return { ok: true };
}
