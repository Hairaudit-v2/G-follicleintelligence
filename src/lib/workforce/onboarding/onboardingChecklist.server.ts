import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffPinMetadataForStaff } from "@/src/lib/staffPin/staffPin.server";

import type { OnboardingChecklistState } from "./onboardingTypes";

function mapChecklistRow(raw: Record<string, unknown>): OnboardingChecklistState {
  return {
    accountCreated: Boolean(raw.account_created),
    pinChosen: Boolean(raw.pin_chosen),
    permissionsAssigned: Boolean(raw.permissions_assigned),
    trainingPending: Boolean(raw.training_pending),
  };
}

async function loadMemberContext(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<{ fiStaffId: string | null }> {
  const { data, error } = await client
    .from("fi_staff_members")
    .select("fi_staff_id")
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { fiStaffId: data?.fi_staff_id != null ? String(data.fi_staff_id) : null };
}

async function detectPermissionsAssigned(
  tenantId: string,
  fiStaffId: string | null,
  client: SupabaseClient
): Promise<boolean> {
  if (!fiStaffId) return false;
  const { count, error } = await client
    .from("fi_staff_feature_access")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("staff_id", fiStaffId);
  if (error) return false;
  return (count ?? 0) > 0;
}

async function detectTrainingPending(
  tenantId: string,
  fiStaffId: string | null,
  client: SupabaseClient
): Promise<boolean> {
  if (!fiStaffId) return true;
  const { count, error } = await client
    .from("fi_staff_competency_projections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("staff_id", fiStaffId)
    .in("status", ["complete", "verified"]);
  if (error) return true;
  return (count ?? 0) === 0;
}

/**
 * Syncs checklist flags from operational state (read-only probes — no RBAC/academy mutations).
 */
export async function syncOnboardingChecklistFromState(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<OnboardingChecklistState> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const mid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { fiStaffId } = await loadMemberContext(tid, mid, supabase);

  let pinChosen = false;
  if (fiStaffId) {
    const pinMeta = await loadStaffPinMetadataForStaff(tid, fiStaffId);
    pinChosen = pinMeta.status === "active" || pinMeta.status === "locked";
  }

  const accountCreated = Boolean(fiStaffId);
  const permissionsAssigned = await detectPermissionsAssigned(tid, fiStaffId, supabase);
  const trainingPending = await detectTrainingPending(tid, fiStaffId, supabase);

  const patch = {
    account_created: accountCreated,
    pin_chosen: pinChosen,
    permissions_assigned: permissionsAssigned,
    training_pending: trainingPending,
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("fi_staff_onboarding_checklists")
    .select("id")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("fi_staff_onboarding_checklists")
      .update(patch)
      .eq("tenant_id", tid)
      .eq("staff_member_id", mid);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("fi_staff_onboarding_checklists").insert({
      tenant_id: tid,
      staff_member_id: mid,
      ...patch,
      created_at: now,
    });
    if (error) throw new Error(error.message);
  }

  return mapChecklistRow(patch as unknown as Record<string, unknown>);
}

export async function loadOnboardingChecklist(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<OnboardingChecklistState> {
  return syncOnboardingChecklistFromState(tenantId, staffMemberId, client);
}

export async function markOnboardingTrainingComplete(input: {
  tenantId: string;
  staffMemberId: string;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("fi_staff_onboarding_checklists")
    .update({ training_pending: false, updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid);
  if (error) throw new Error(error.message);
}
