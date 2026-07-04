import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { RosterShiftAuditActionType } from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";

export type InsertRosterShiftAuditEventInput = {
  tenantId: string;
  shiftId?: string | null;
  staffId?: string | null;
  actorFiUserId?: string | null;
  actionType: RosterShiftAuditActionType;
  reason?: string | null;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  client?: SupabaseClient;
};

export async function insertRosterShiftAuditEvent(
  input: InsertRosterShiftAuditEventInput
): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  const { error } = await supabase.from("fi_roster_shift_audit_events").insert({
    tenant_id: tid,
    shift_id: input.shiftId?.trim() || null,
    staff_id: input.staffId?.trim() || null,
    actor_fi_user_id: input.actorFiUserId?.trim() || null,
    action_type: input.actionType,
    reason: input.reason?.trim() || null,
    old_values: input.oldValues ?? {},
    new_values: input.newValues ?? {},
    metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
}
