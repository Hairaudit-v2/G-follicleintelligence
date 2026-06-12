"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import {
  acknowledgePhotoProtocolAlertEvent,
  dismissPhotoProtocolAlertEvent,
  resolvePhotoProtocolAlertEvent,
  upsertPhotoProtocolAlertEventsForTenant,
} from "@/src/lib/hair-intelligence/photoProtocols/protocolAlertEvents.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePhotoProtocolFoundation(tenantId: string, patientId?: string | null) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/foundation-integrity`);
  const pid = patientId?.trim();
  if (pid) {
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
  }
}

const tenantBodySchema = z
  .object({
    tenantId: z.string().uuid(),
    adminKey: z.string().optional(),
  })
  .strict();

export async function refreshPhotoProtocolAlertsAction(
  body: unknown
): Promise<{ ok: true; upserted: number; computed_count: number } | { ok: false; error: string }> {
  try {
    const parsed = tenantBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId: parsed.tenantId, adminKey: parsed.adminKey, request: undefined });
    const r = await upsertPhotoProtocolAlertEventsForTenant(parsed.tenantId.trim(), {});
    revalidatePhotoProtocolFoundation(parsed.tenantId.trim());
    return { ok: true, upserted: r.upserted, computed_count: r.computed_count };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const alertIdBodySchema = z
  .object({
    tenantId: z.string().uuid(),
    alertEventId: z.string().uuid(),
    adminKey: z.string().optional(),
  })
  .strict();

export async function acknowledgePhotoProtocolAlertAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = alertIdBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId: parsed.tenantId, adminKey: parsed.adminKey, request: undefined });
    const fiUserId = await tryResolveFiUserIdForTenant(parsed.tenantId.trim(), undefined);
    const row = await acknowledgePhotoProtocolAlertEvent(parsed.tenantId.trim(), parsed.alertEventId, fiUserId);
    revalidatePhotoProtocolFoundation(parsed.tenantId.trim(), row.patient_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resolvePhotoProtocolAlertAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = alertIdBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId: parsed.tenantId, adminKey: parsed.adminKey, request: undefined });
    const fiUserId = await tryResolveFiUserIdForTenant(parsed.tenantId.trim(), undefined);
    const row = await resolvePhotoProtocolAlertEvent(parsed.tenantId.trim(), parsed.alertEventId, fiUserId);
    revalidatePhotoProtocolFoundation(parsed.tenantId.trim(), row.patient_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function dismissPhotoProtocolAlertAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = alertIdBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId: parsed.tenantId, adminKey: parsed.adminKey, request: undefined });
    const fiUserId = await tryResolveFiUserIdForTenant(parsed.tenantId.trim(), undefined);
    const row = await dismissPhotoProtocolAlertEvent(parsed.tenantId.trim(), parsed.alertEventId, fiUserId);
    revalidatePhotoProtocolFoundation(parsed.tenantId.trim(), row.patient_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
