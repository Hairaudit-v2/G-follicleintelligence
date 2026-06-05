"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { assertCrmTenantStaffManageAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { fiServiceCreateBodySchema, fiServicePatchBodySchema } from "@/src/lib/services/fiServicesSchemas";
import { insertFiService, updateFiService } from "@/src/lib/services/fiServices.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function pgUniqueMessage(e: unknown): string | null {
  if (!(e instanceof Error)) return null;
  const m = e.message;
  if (m.includes("idx_fi_services_tenant_booking_type_unique") || m.includes("23505")) {
    return "Another service already uses this procedure type for this tenant.";
  }
  return null;
}

export async function createServiceAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = fiServiceCreateBodySchema.parse(body);
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

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
    revalidatePath(`/fi-admin/${tid}/services`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    revalidatePath(`/fi-admin/${tid}/appointments`);
    revalidatePath(`/fi-admin/${tid}/bookings`);
    revalidatePath(`/fi-admin/${tid}/patients`);
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
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

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
    revalidatePath(`/fi-admin/${tid}/services`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    revalidatePath(`/fi-admin/${tid}/appointments`);
    revalidatePath(`/fi-admin/${tid}/bookings`);
    revalidatePath(`/fi-admin/${tid}/patients`);
    return { ok: true };
  } catch (e) {
    const u = pgUniqueMessage(e);
    return { ok: false, error: u ?? errMsg(e) };
  }
}
