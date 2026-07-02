"use server";

import { z } from "zod";

import { getCrmShellSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  loadConsultationWorkspacePayload,
  loadPathologyResultWorkspacePayload,
  loadPaymentWorkspacePayload,
  loadStaffWorkspacePayload,
  loadSurgeryCaseWorkspacePayload,
  type ConsultationWorkspacePayload,
  type PathologyResultWorkspacePayload,
  type PaymentWorkspacePayload,
  type StaffWorkspacePayload,
  type SurgeryCaseWorkspacePayload,
} from "@/src/lib/fiOs/workspaceShell/workspaceShellLoaders.server";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const workspaceLoadSchema = z.object({
  tenantId: z.string().min(1),
  entityId: z.string().uuid(),
});

type LoadResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function assertWorkspaceAccess(tenantId: string): Promise<{ ok: false; error: string } | null> {
  const session = await getCrmShellSessionIfAllowed(tenantId);
  if (!session) {
    return { ok: false, error: "You do not have access to this item." };
  }
  return null;
}

export async function loadPaymentWorkspaceBundleAction(
  tenantId: string,
  paymentId: string
): Promise<LoadResult<PaymentWorkspacePayload>> {
  try {
    const parsed = workspaceLoadSchema.parse({ tenantId, entityId: paymentId });
    const denied = await assertWorkspaceAccess(parsed.tenantId);
    if (denied) return denied;
    const data = await loadPaymentWorkspacePayload(parsed.tenantId, parsed.entityId);
    if (!data) return { ok: false, error: "You do not have access to this item." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadPathologyResultWorkspaceBundleAction(
  tenantId: string,
  resultId: string
): Promise<LoadResult<PathologyResultWorkspacePayload>> {
  try {
    const parsed = workspaceLoadSchema.parse({ tenantId, entityId: resultId });
    const denied = await assertWorkspaceAccess(parsed.tenantId);
    if (denied) return denied;
    const data = await loadPathologyResultWorkspacePayload(parsed.tenantId, parsed.entityId);
    if (!data) return { ok: false, error: "You do not have access to this item." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadSurgeryCaseWorkspaceBundleAction(
  tenantId: string,
  caseId: string
): Promise<LoadResult<SurgeryCaseWorkspacePayload>> {
  try {
    const parsed = workspaceLoadSchema.parse({ tenantId, entityId: caseId });
    const denied = await assertWorkspaceAccess(parsed.tenantId);
    if (denied) return denied;
    const data = await loadSurgeryCaseWorkspacePayload(parsed.tenantId, parsed.entityId);
    if (!data) return { ok: false, error: "You do not have access to this item." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadConsultationWorkspaceBundleAction(
  tenantId: string,
  consultationId: string
): Promise<LoadResult<ConsultationWorkspacePayload>> {
  try {
    const parsed = workspaceLoadSchema.parse({ tenantId, entityId: consultationId });
    const denied = await assertWorkspaceAccess(parsed.tenantId);
    if (denied) return denied;
    const data = await loadConsultationWorkspacePayload(parsed.tenantId, parsed.entityId);
    if (!data) return { ok: false, error: "You do not have access to this item." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadStaffWorkspaceBundleAction(
  tenantId: string,
  staffId: string
): Promise<LoadResult<StaffWorkspacePayload>> {
  try {
    const parsed = workspaceLoadSchema.parse({ tenantId, entityId: staffId });
    const denied = await assertWorkspaceAccess(parsed.tenantId);
    if (denied) return denied;
    const data = await loadStaffWorkspacePayload(parsed.tenantId, parsed.entityId);
    if (!data) return { ok: false, error: "You do not have access to this item." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
