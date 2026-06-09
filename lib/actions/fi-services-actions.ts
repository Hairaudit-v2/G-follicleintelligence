"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { assertFiServicesManageAllowed } from "@/src/lib/services/fiServicesManageAccess.server";
import {
  fiServiceCreateBodySchema,
  fiServiceDeactivateBodySchema,
  fiServicePatchBodySchema,
} from "@/src/lib/services/fiServicesSchemas";
import { seedDefaultClinicServicesForTenant } from "@/src/lib/services/defaultClinicServicesSeed";
import { insertFiService, updateFiService } from "@/src/lib/services/fiServices.server";

function revalidateFiServicesSurfaces(tenantId: string): void {
  const base = `/fi-admin/${tenantId}`;
  revalidatePath(`${base}/services`);
  revalidatePath(`${base}/calendar`);
  revalidatePath(`${base}/appointments`);
  revalidatePath(`${base}/bookings`);
  revalidatePath(`${base}/patients`);
}

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function pgUniqueMessage(e: unknown): string | null {
  if (!(e instanceof Error)) return null;
  const m = e.message;
  if (m.includes("idx_fi_services_tenant_booking_type_unique") || m.includes("23505")) {
    return "Service is already assigned to this booking type.";
  }
  return null;
}

export async function createServiceAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = fiServiceCreateBodySchema.parse(body);
    await assertFiServicesManageAllowed({ tenantId, adminKey: parsed.adminKey, request: null });

    const row = await insertFiService(tenantId.trim(), {
      name: parsed.name,
      duration_minutes: parsed.duration_minutes,
      base_price: parsed.base_price,
      color: parsed.color ?? null,
      category: parsed.category ?? null,
      is_active: parsed.is_active ?? true,
      booking_type: parsed.booking_type ?? null,
    });

    const tid = tenantId.trim();
    revalidateFiServicesSurfaces(tid);
    return { ok: true, id: row.id };
  } catch (e) {
    const u = pgUniqueMessage(e);
    return { ok: false, error: u ?? errMsg(e) };
  }
}

export async function updateServiceAction(
  tenantId: string,
  serviceId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = fiServicePatchBodySchema.parse(body);
    await assertFiServicesManageAllowed({ tenantId, adminKey: parsed.adminKey, request: null });

    const patch: Parameters<typeof updateFiService>[2] = {};
    if (parsed.name !== undefined) patch.name = parsed.name;
    if (parsed.duration_minutes !== undefined) patch.duration_minutes = parsed.duration_minutes;
    if (parsed.base_price !== undefined) patch.base_price = parsed.base_price;
    if (parsed.color !== undefined) patch.color = parsed.color ?? null;
    if (parsed.category !== undefined) patch.category = parsed.category ?? null;
    if (parsed.is_active !== undefined) patch.is_active = parsed.is_active;
    if (parsed.booking_type !== undefined) patch.booking_type = parsed.booking_type ?? null;

    await updateFiService(tenantId.trim(), serviceId.trim(), patch);

    const tid = tenantId.trim();
    revalidateFiServicesSurfaces(tid);
    return { ok: true };
  } catch (e) {
    const u = pgUniqueMessage(e);
    return { ok: false, error: u ?? errMsg(e) };
  }
}

/**
 * Soft-deactivate a catalogue row (`is_active = false`). Bookings continue to resolve by `booking_type` / fallbacks.
 */
export async function loadDefaultClinicServicesAction(
  tenantId: string,
  body: unknown = {}
): Promise<
  | { ok: true; created: number; updated: number; skipped: number; warnings: string[] }
  | { ok: false; error: string }
> {
  try {
    const parsed = fiServiceDeactivateBodySchema.parse(body ?? {});
    await assertFiServicesManageAllowed({ tenantId, adminKey: parsed.adminKey, request: null });

    const result = await seedDefaultClinicServicesForTenant(tenantId.trim());
    revalidateFiServicesSurfaces(tenantId.trim());
    return { ok: true, ...result };
  } catch (e) {
    const u = pgUniqueMessage(e);
    return { ok: false, error: u ?? errMsg(e) };
  }
}

export async function deactivateServiceAction(
  tenantId: string,
  serviceId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = fiServiceDeactivateBodySchema.parse(body ?? {});
    await assertFiServicesManageAllowed({ tenantId, adminKey: parsed.adminKey, request: null });

    await updateFiService(tenantId.trim(), serviceId.trim(), { is_active: false });

    revalidateFiServicesSurfaces(tenantId.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
