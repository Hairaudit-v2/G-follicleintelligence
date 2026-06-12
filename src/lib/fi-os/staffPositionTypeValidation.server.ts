import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function assertFiStaffPositionTypeAssignableToTenant(
  tenantId: string,
  positionTypeId: string | null
): Promise<void> {
  if (positionTypeId == null || !positionTypeId.trim()) return;
  const tid = tenantId.trim();
  const pid = positionTypeId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_position_types")
    .select("id, tenant_id")
    .eq("id", pid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Unknown position type.");
  const row = data as { tenant_id: string | null };
  if (row.tenant_id != null && String(row.tenant_id) !== tid) {
    throw new Error("Position type belongs to a different tenant.");
  }
}
