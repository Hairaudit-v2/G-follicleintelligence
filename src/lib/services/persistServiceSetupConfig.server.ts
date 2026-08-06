import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildServiceSetupSyncPlan } from "@/src/lib/services/setup/serviceSetupSyncPlan";
import { parseServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupDefaults";
import type { ServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupTypes";

/**
 * Persist setup_config and keep eligibility / resource-requirement tables aligned.
 */
export async function persistServiceSetupConfig(args: {
  tenantId: string;
  serviceId: string;
  config: ServiceSetupConfig;
}): Promise<void> {
  const tid = args.tenantId.trim();
  const sid = args.serviceId.trim();
  const config = parseServiceSetupConfig(args.config);
  const plan = buildServiceSetupSyncPlan(config);
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { error: cfgErr } = await supabase
    .from("fi_services")
    .update({ setup_config: config, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", sid);
  if (cfgErr) {
    const m = cfgErr.message.toLowerCase();
    const missingSetup =
      m.includes("setup_config") &&
      (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find"));
    if (!missingSetup) throw new Error(cfgErr.message);
    // Column not migrated yet — still sync eligibility / resource tables below.
  }

  await supabase
    .from("fi_service_staff_eligibility")
    .delete()
    .eq("tenant_id", tid)
    .eq("service_id", sid);

  if (plan.staffRows.length > 0) {
    const { error } = await supabase.from("fi_service_staff_eligibility").insert(
      plan.staffRows.map((row) => ({
        tenant_id: tid,
        service_id: sid,
        staff_id: row.staffId,
        staff_role: row.staffRole,
        is_required: row.isRequired,
        is_active: row.isActive,
        metadata: {},
        created_at: now,
        updated_at: now,
      }))
    );
    if (error) throw new Error(error.message);
  }

  // Soft-deactivate rooms no longer eligible, then upsert active set.
  const { data: existingRooms, error: loadRoomErr } = await supabase
    .from("fi_service_room_eligibility")
    .select("room_id")
    .eq("tenant_id", tid)
    .eq("service_id", sid);
  if (loadRoomErr) throw new Error(loadRoomErr.message);

  const keep = new Set(plan.roomRows.map((r) => r.roomId));
  for (const row of existingRooms ?? []) {
    const roomId = String((row as { room_id?: string }).room_id ?? "");
    if (roomId && !keep.has(roomId)) {
      const { error } = await supabase
        .from("fi_service_room_eligibility")
        .update({ is_active: false, is_preferred: false, updated_at: now })
        .eq("tenant_id", tid)
        .eq("service_id", sid)
        .eq("room_id", roomId);
      if (error) throw new Error(error.message);
    }
  }

  for (const row of plan.roomRows) {
    const { error } = await supabase.from("fi_service_room_eligibility").upsert(
      {
        tenant_id: tid,
        service_id: sid,
        room_id: row.roomId,
        is_preferred: row.isPreferred,
        is_active: row.isActive,
        metadata: row.metadata ?? {},
        updated_at: now,
      },
      { onConflict: "tenant_id,service_id,room_id" }
    );
    if (error) throw new Error(error.message);
  }

  // Replace service_setup-authored resource requirements; preserve manually seeded ones.
  await supabase
    .from("fi_service_resource_requirements")
    .delete()
    .eq("tenant_id", tid)
    .eq("service_id", sid)
    .contains("metadata", { source: "service_setup" });

  if (plan.resourceRows.length > 0) {
    const { error } = await supabase.from("fi_service_resource_requirements").insert(
      plan.resourceRows.map((row) => ({
        tenant_id: tid,
        service_id: sid,
        resource_type: row.resource_type,
        resource_key: row.resource_key,
        requirement_label: row.requirement_label,
        is_required: row.is_required,
        quantity: row.quantity,
        sort_order: row.sort_order,
        metadata: row.metadata,
        created_at: now,
        updated_at: now,
      }))
    );
    if (error) throw new Error(error.message);
  }
}
