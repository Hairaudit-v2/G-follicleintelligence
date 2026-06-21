import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ExternalProfessionalState,
  FiNexusExternalProfessionalRow,
  FiNexusRoleAssignmentRow,
  FiNexusStaffProfileRow,
  FiNexusTenantMembershipRow,
  ReadStateResult,
} from "@/src/lib/nexus/nexusProvisioningTypes";

function asProfessionalRow(row: Record<string, unknown>): FiNexusExternalProfessionalRow {
  return row as unknown as FiNexusExternalProfessionalRow;
}

function asMembershipRow(row: Record<string, unknown>): FiNexusTenantMembershipRow {
  return row as unknown as FiNexusTenantMembershipRow;
}

function asStaffProfileRow(row: Record<string, unknown>): FiNexusStaffProfileRow {
  return row as unknown as FiNexusStaffProfileRow;
}

function asRoleRow(row: Record<string, unknown>): FiNexusRoleAssignmentRow {
  return row as unknown as FiNexusRoleAssignmentRow;
}

export function buildReconciliationWarnings(state: {
  professional: FiNexusExternalProfessionalRow | null;
  memberships: FiNexusTenantMembershipRow[];
  staffProfiles: FiNexusStaffProfileRow[];
  activeRoles: FiNexusRoleAssignmentRow[];
}): string[] {
  const warnings: string[] = [];
  const globalId = state.professional?.global_professional_id;

  if (!state.professional && (state.memberships.length > 0 || state.staffProfiles.length > 0 || state.activeRoles.length > 0)) {
    warnings.push("membership_or_staff_exists_without_external_professional_record");
  }

  for (const membership of state.memberships) {
    if (membership.membership_status === "revoked" && state.activeRoles.some((r) => r.tenant_id === membership.tenant_id)) {
      warnings.push(`active_roles_present_for_revoked_membership:${membership.tenant_id}`);
    }
    if (membership.membership_status === "pending" && state.activeRoles.some((r) => r.tenant_id === membership.tenant_id)) {
      warnings.push(`active_roles_present_for_pending_membership:${membership.tenant_id}`);
    }
  }

  for (const staff of state.staffProfiles) {
    if (!staff.active && state.activeRoles.some((r) => r.tenant_id === staff.tenant_id)) {
      warnings.push(`active_roles_present_for_inactive_staff_profile:${staff.tenant_id}`);
    }
  }

  if (globalId && state.professional && !state.professional.deployment_ready) {
    if (state.activeRoles.length > 0) {
      warnings.push("roles_assigned_before_deployment_ready");
    }
  }

  return warnings;
}

export async function readExternalProfessionalState(
  globalProfessionalId: string,
  client?: SupabaseClient
): Promise<ReadStateResult> {
  const gid = globalProfessionalId.trim();
  if (!gid) {
    return { ok: false, error: "globalProfessionalId is required.", httpStatus: 400 };
  }

  const supabase = client ?? supabaseAdmin();

  const { data: professionalData, error: professionalErr } = await supabase
    .from("fi_nexus_external_professionals")
    .select("*")
    .eq("global_professional_id", gid)
    .maybeSingle();

  if (professionalErr) {
    return { ok: false, error: professionalErr.message, httpStatus: 500 };
  }

  const { data: membershipsData, error: membershipsErr } = await supabase
    .from("fi_nexus_tenant_memberships")
    .select("*")
    .eq("global_professional_id", gid)
    .order("created_at", { ascending: true });

  if (membershipsErr) {
    return { ok: false, error: membershipsErr.message, httpStatus: 500 };
  }

  const { data: staffData, error: staffErr } = await supabase
    .from("fi_nexus_staff_profiles")
    .select("*")
    .eq("global_professional_id", gid)
    .order("created_at", { ascending: true });

  if (staffErr) {
    return { ok: false, error: staffErr.message, httpStatus: 500 };
  }

  const { data: rolesData, error: rolesErr } = await supabase
    .from("fi_nexus_role_assignments")
    .select("*")
    .eq("global_professional_id", gid)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (rolesErr) {
    return { ok: false, error: rolesErr.message, httpStatus: 500 };
  }

  const { count, error: auditErr } = await supabase
    .from("fi_nexus_provisioning_audit")
    .select("id", { count: "exact", head: true })
    .eq("global_professional_id", gid);

  if (auditErr) {
    return { ok: false, error: auditErr.message, httpStatus: 500 };
  }

  const professional = professionalData ? asProfessionalRow(professionalData as Record<string, unknown>) : null;
  const memberships = (membershipsData ?? []).map((r) => asMembershipRow(r as Record<string, unknown>));
  const staffProfiles = (staffData ?? []).map((r) => asStaffProfileRow(r as Record<string, unknown>));
  const activeRoles = (rolesData ?? []).map((r) => asRoleRow(r as Record<string, unknown>));

  const state: ExternalProfessionalState = {
    professional,
    memberships,
    staffProfiles,
    activeRoles,
    auditCount: count ?? 0,
    reconciliationWarnings: buildReconciliationWarnings({
      professional,
      memberships,
      staffProfiles,
      activeRoles,
    }),
  };

  return { ok: true, state };
}

export async function writeNexusProvisioningAudit(
  input: {
    globalProfessionalId: string;
    actionType: string;
    payload?: Record<string, unknown> | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    result: string;
    failureReason?: string | null;
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const { error } = await supabase.from("fi_nexus_provisioning_audit").insert({
    global_professional_id: input.globalProfessionalId.trim(),
    action_type: input.actionType,
    payload: input.payload ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    result: input.result,
    failure_reason: input.failureReason ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}
