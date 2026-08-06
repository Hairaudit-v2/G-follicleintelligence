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
import { persistServiceSetupConfig } from "@/src/lib/services/persistServiceSetupConfig.server";
import { parseServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupDefaults";
import { evaluateServiceSetupActivation } from "@/src/lib/services/setup/serviceSetupValidation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ServiceSetupActivationWarning } from "@/src/lib/services/setup/serviceSetupTypes";

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

async function loadInventoryForActivation(tenantId: string): Promise<{
  staffCountByRole: Record<string, number>;
  availableRoomIds: string[];
}> {
  const supabase = supabaseAdmin();
  const [staffRes, roomRes] = await Promise.all([
    supabase
      .from("fi_staff")
      .select("staff_role, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("fi_clinic_rooms")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);
  if (staffRes.error) throw new Error(staffRes.error.message);
  if (roomRes.error) throw new Error(roomRes.error.message);

  const staffCountByRole: Record<string, number> = {};
  for (const row of staffRes.data ?? []) {
    const role = String((row as { staff_role?: string | null }).staff_role ?? "")
      .trim()
      .toLowerCase();
    if (!role) continue;
    staffCountByRole[role] = (staffCountByRole[role] ?? 0) + 1;
  }

  return {
    staffCountByRole,
    availableRoomIds: (roomRes.data ?? []).map((r) => String((r as { id: string }).id)),
  };
}

export async function createServiceAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; id: string; warnings?: ServiceSetupActivationWarning[]; savedAsDraft?: boolean }
  | { ok: false; error: string; warnings?: ServiceSetupActivationWarning[] }
> {
  try {
    const parsed = fiServiceCreateBodySchema.parse(body);
    await assertFiServicesManageAllowed({ tenantId, adminKey: parsed.adminKey, request: null });

    const tid = tenantId.trim();
    let isActive = parsed.is_active ?? true;
    let warnings: ServiceSetupActivationWarning[] = [];
    let savedAsDraft = false;
    const setupConfig = parsed.setup_config
      ? parseServiceSetupConfig(parsed.setup_config)
      : null;

    if (setupConfig && isActive && !parsed.save_as_draft) {
      const inventory = await loadInventoryForActivation(tid);
      const evaluation = evaluateServiceSetupActivation(setupConfig, inventory);
      warnings = evaluation.warnings;
      if (!evaluation.canActivate) {
        return {
          ok: false,
          error:
            "Cannot activate: required roles or rooms have no eligible resources. Save as draft to keep unfinished setup.",
          warnings,
        };
      }
    }
    if (parsed.save_as_draft) {
      isActive = false;
      savedAsDraft = true;
    }

    const row = await insertFiService(tid, {
      name: parsed.name,
      duration_minutes: parsed.duration_minutes,
      base_price: parsed.base_price,
      color: parsed.color ?? null,
      category: parsed.category ?? null,
      is_active: isActive,
      booking_type: parsed.booking_type ?? null,
      setup_config: setupConfig ?? {},
    });

    if (setupConfig) {
      await persistServiceSetupConfig({
        tenantId: tid,
        serviceId: row.id,
        config: setupConfig,
      });
    }

    revalidateFiServicesSurfaces(tid);
    return { ok: true, id: row.id, warnings, savedAsDraft };
  } catch (e) {
    const u = pgUniqueMessage(e);
    return { ok: false, error: u ?? errMsg(e) };
  }
}

export async function updateServiceAction(
  tenantId: string,
  serviceId: string,
  body: unknown
): Promise<
  | { ok: true; warnings?: ServiceSetupActivationWarning[]; savedAsDraft?: boolean }
  | { ok: false; error: string; warnings?: ServiceSetupActivationWarning[] }
> {
  try {
    const parsed = fiServicePatchBodySchema.parse(body);
    await assertFiServicesManageAllowed({ tenantId, adminKey: parsed.adminKey, request: null });

    const tid = tenantId.trim();
    const sid = serviceId.trim();
    const setupConfig = parsed.setup_config
      ? parseServiceSetupConfig(parsed.setup_config)
      : null;

    let isActive = parsed.is_active;
    let warnings: ServiceSetupActivationWarning[] = [];
    let savedAsDraft = false;

    if (parsed.save_as_draft) {
      isActive = false;
      savedAsDraft = true;
    } else if (setupConfig && isActive === true) {
      const inventory = await loadInventoryForActivation(tid);
      const evaluation = evaluateServiceSetupActivation(setupConfig, inventory);
      warnings = evaluation.warnings;
      if (!evaluation.canActivate) {
        return {
          ok: false,
          error:
            "Cannot activate: required roles or rooms have no eligible resources. Save as draft to keep unfinished setup.",
          warnings,
        };
      }
    }

    const patch: Parameters<typeof updateFiService>[2] = {};
    if (parsed.name !== undefined) patch.name = parsed.name;
    if (parsed.duration_minutes !== undefined) patch.duration_minutes = parsed.duration_minutes;
    if (parsed.base_price !== undefined) patch.base_price = parsed.base_price;
    if (parsed.color !== undefined) patch.color = parsed.color ?? null;
    if (parsed.category !== undefined) patch.category = parsed.category ?? null;
    if (isActive !== undefined) patch.is_active = isActive;
    if (parsed.booking_type !== undefined) patch.booking_type = parsed.booking_type ?? null;
    if (setupConfig) patch.setup_config = setupConfig;

    await updateFiService(tid, sid, patch);

    if (setupConfig) {
      await persistServiceSetupConfig({
        tenantId: tid,
        serviceId: sid,
        config: setupConfig,
      });
    }

    revalidateFiServicesSurfaces(tid);
    return { ok: true, warnings, savedAsDraft };
  } catch (e) {
    const u = pgUniqueMessage(e);
    return { ok: false, error: u ?? errMsg(e) };
  }
}

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
