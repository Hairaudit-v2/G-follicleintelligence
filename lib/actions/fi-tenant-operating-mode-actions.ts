"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertFiTenantExists,
  isFiAdminUuid,
  requireFiAdminKey,
} from "@/lib/server/fiAdminKeyGate";
import { mergeTenantConfigJsonWithOperatingModeKey } from "@/lib/fi/tenantConfig";
import { isFiTenantOperatingModeKey } from "@/src/config/fiTenantOperatingModeUi";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { buildTenantOperatingModeChangedAuditInsert } from "@/src/lib/fi-os/staffFeatureAccessAuditPayload";
import {
  resolveActorIdsForFiOsAudit,
  tryInsertFiStaffFeatureAccessAuditEvent,
} from "@/src/lib/fi-os/staffFeatureAccessAudit.server";

export async function saveTenantFiOsOperatingModeAction(input: {
  adminKey: string;
  tenantId: string;
  modeKey: string;
}): Promise<{ ok: true; auditWarning?: string } | { ok: false; error: string }> {
  const gate = requireFiAdminKey(input.adminKey);
  if (!gate.ok) return gate;

  const tenantId = input.tenantId?.trim();
  if (!tenantId || !isFiAdminUuid(tenantId)) return { ok: false, error: "Invalid tenant id." };

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const raw = input.modeKey?.trim() ?? "";
  if (raw && !isFiTenantOperatingModeKey(raw)) {
    return { ok: false, error: "Invalid operating mode." };
  }
  const nextKey = raw ? raw : null;

  try {
    const supabase = supabaseAdmin();
    const { data: row, error: rErr } = await supabase
      .from("fi_tenants")
      .select("config_json")
      .eq("id", tenantId)
      .maybeSingle();
    if (rErr) return { ok: false, error: rErr.message };

    const rawCfg = (row as { config_json?: unknown } | null)?.config_json;
    const oldFlat =
      rawCfg && typeof rawCfg === "object" && !Array.isArray(rawCfg)
        ? (rawCfg as Record<string, unknown>)
        : {};
    const oldMode =
      typeof oldFlat.fi_os_operating_mode_key === "string" &&
      oldFlat.fi_os_operating_mode_key.trim()
        ? oldFlat.fi_os_operating_mode_key.trim()
        : null;

    const merged = mergeTenantConfigJsonWithOperatingModeKey(rawCfg, nextKey);
    const { error: uErr } = await supabase
      .from("fi_tenants")
      .update({ config_json: merged })
      .eq("id", tenantId);
    if (uErr) return { ok: false, error: uErr.message };

    const authId = await resolveAuthUserId(null);
    const actors = await resolveActorIdsForFiOsAudit(tenantId, authId);
    const auditRow = buildTenantOperatingModeChangedAuditInsert({
      tenantId,
      actorUserId: actors.actor_user_id,
      actorFiUserId: actors.actor_fi_user_id,
      oldModeKey: oldMode,
      newModeKey: nextKey,
    });
    const ar = await tryInsertFiStaffFeatureAccessAuditEvent(auditRow);
    const auditWarning = ar.ok ? undefined : `Saved, but audit log failed: ${ar.error}`;

    revalidatePath(`/fi-admin/${tenantId}/configuration`);
    revalidatePath(`/fi-admin/${tenantId}`);
    revalidatePath(`/fi-admin/${tenantId}/settings`, "layout");

    return { ok: true, auditWarning };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
