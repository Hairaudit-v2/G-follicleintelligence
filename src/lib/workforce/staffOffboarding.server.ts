import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type OffboardStaffMemberResult = {
  staffMemberId: string;
  fiStaffId: string | null;
  employmentStatus: string;
};

async function insertWorkforceAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function loadOffboardingQueueCount(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_staff_members")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("employment_status", ["terminated", "resigned", "contract_ended", "contract_expired"])
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadInactiveStaffCount(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_staff_members")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("employment_status", [
      "inactive",
      "terminated",
      "resigned",
      "contract_ended",
      "contract_expired",
      "suspended",
      "merged",
    ])
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Offboards a staff member without deleting historical records.
 * Revokes permissions and access flags; preserves audit/compliance history.
 */
export async function offboardStaffMember(input: {
  tenantId: string;
  staffId: string;
  exitReason: string;
  terminatedBy?: string | null;
  client?: SupabaseClient;
}): Promise<OffboardStaffMemberResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffId, "staffId");
  const exitReason = input.exitReason.trim();
  if (!exitReason) throw new Error("exitReason is required.");

  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Staff member not found.");

  const fiStaffId =
    (existing as { fi_staff_id?: string | null }).fi_staff_id != null
      ? String((existing as { fi_staff_id: string }).fi_staff_id)
      : null;

  const { error: updateError } = await supabase
    .from("fi_staff_members")
    .update({
      employment_status: "terminated",
      termination_date: now,
      exit_reason: exitReason,
      offboarded_by: input.terminatedBy ?? null,
      offboarded_at: now,
      system_access_revoked: true,
      academy_access_revoked: true,
      employment_status_reason: exitReason,
      employment_status_changed_at: now,
      employment_status_changed_by: input.terminatedBy ?? null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);

  if (fiStaffId) {
    const { error: fiStaffError } = await supabase
      .from("fi_staff")
      .update({
        employment_status: "terminated",
        is_active: false,
        employment_status_reason: exitReason,
        employment_status_changed_at: now,
        employment_status_changed_by: input.terminatedBy ?? null,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", fiStaffId);
    if (fiStaffError) throw new Error(fiStaffError.message);
  }

  if (fiStaffId) {
    await supabase
      .from("fi_staff_feature_access")
      .delete()
      .eq("tenant_id", tid)
      .eq("staff_id", fiStaffId);

    await supabase
      .from("fi_staff_access_grants")
      .update({ revoked_at: now, updated_at: now })
      .eq("tenant_id", tid)
      .eq("staff_member_id", fiStaffId)
      .is("revoked_at", null);

    await supabase
      .from("fi_staff_field_access_grants")
      .update({ revoked_at: now, updated_at: now })
      .eq("tenant_id", tid)
      .eq("staff_member_id", fiStaffId)
      .is("revoked_at", null);

    await supabase
      .from("fi_staff_shifts")
      .update({ status: "cancelled", updated_at: now })
      .eq("tenant_id", tid)
      .eq("staff_id", fiStaffId)
      .in("status", ["scheduled", "confirmed"]);

    await supabase
      .from("fi_staff_event_assignments")
      .update({ status: "cancelled", updated_at: now })
      .eq("tenant_id", tid)
      .eq("staff_id", fiStaffId)
      .in("status", ["proposed", "confirmed", "assigned"]);

    await supabase
      .from("fi_staff_calendar_links")
      .update({ is_active: false, updated_at: now })
      .eq("tenant_id", tid)
      .eq("staff_member_id", fiStaffId);

    // TODO: SurgeryOS permission revocation table when dedicated grants ship.
    // TODO: Readiness recalculation job hook — tenant overview refresh is triggered by revalidation.
  }

  await insertWorkforceAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.STAFF_OFFBOARDED,
    metadata: {
      exit_reason: exitReason,
      terminated_by: input.terminatedBy ?? null,
      fi_staff_id: fiStaffId,
      system_access_revoked: true,
      academy_access_revoked: true,
      audit_history_preserved: true,
    },
  });

  return {
    staffMemberId,
    fiStaffId,
    employmentStatus: "terminated",
  };
}