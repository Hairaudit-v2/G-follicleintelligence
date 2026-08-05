import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { insertFiStaff, updateFiStaff } from "@/src/lib/staff/staff.server";
import { buildFiOsAuthConfirmUrl } from "@/src/lib/supabase/authLinkBootstrap";
import { FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE } from "@/src/lib/email/emailDeliveryPublicMessages";
import { splitFullName } from "@/src/lib/workforce-os/staffLifecycleCore";

import {
  extractTenantIdFromFiAdminPath,
  formatCrossTenantInviteWarning,
  readMetadataTenantId,
  shouldPreferMembershipOverMetadata,
} from "./staffTenantLinkRepairCore";

export type StaffTenantLinkRepairResult = {
  fiUserId: string;
  fiStaffId: string;
};

export type StaffAuthProvisionResult = {
  authUserId: string;
  inviteLink: string;
  reusedExistingAuthUser: boolean;
  crossTenantWarning: string | null;
};

async function findAuthUserIdByEmail(
  email: string,
  client: SupabaseClient
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await client.rpc("fi_admin_lookup_auth_user_id_by_email", {
    _email: normalized,
  });
  if (error) throw new Error(error.message);
  return data ? String(data) : null;
}

async function loadTenantName(tenantId: string, client: SupabaseClient): Promise<string> {
  // tenant-guard-allow: fi_tenants registry lookup by URL/invitation tenant id
  const { data, error } = await client
    .from("fi_tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String((data as { name: string } | null)?.name ?? "Your clinic").trim() || "Your clinic";
}

async function loadOtherTenantNamesForAuthUser(
  tenantId: string,
  authUserId: string,
  client: SupabaseClient
): Promise<string[]> {
  const { data: memberships, error } = await client
    .from("fi_users")
    .select("tenant_id")
    .eq("auth_user_id", authUserId)
    .neq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const otherTenantIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((row) => String((row as { tenant_id: string }).tenant_id ?? "").trim())
        .filter(Boolean)
    )
  );
  if (otherTenantIds.length === 0) return [];

  // tenant-guard-allow: fi_tenants registry lookup by URL/invitation tenant id
  const { data: tenants, error: tenantErr } = await client
    .from("fi_tenants")
    .select("id, name")
    .in("id", otherTenantIds);
  if (tenantErr) throw new Error(tenantErr.message);

  return (tenants ?? []).map((row) => String((row as { name: string }).name ?? "Another clinic"));
}

/**
 * Ensure a scheduling `fi_staff` row exists for a lifecycle member (login invite path).
 * Dual-table write — owned here so access centre loaders can avoid raw dual joins.
 */
export async function ensureFiStaffForMember(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<{ fiStaffId: string; email: string }> {
  const { data, error } = await client
    .from("fi_staff_members")
    .select("full_name, email, fi_staff_id, role_code, employment_status")
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Staff member not found.");

  const row = data as {
    full_name: string;
    email: string | null;
    fi_staff_id: string | null;
    role_code: string | null;
    employment_status: string;
  };

  const email = row.email?.trim().toLowerCase();
  if (!email) throw new Error("Staff member must have an email before linking login access.");

  if (row.fi_staff_id) {
    return { fiStaffId: String(row.fi_staff_id), email };
  }

  const now = new Date().toISOString();
  const { data: created, error: createErr } = await client
    .from("fi_staff")
    .insert({
      tenant_id: tenantId,
      full_name: String(row.full_name ?? "Staff").trim(),
      email,
      staff_role: row.role_code?.trim() || "consultant",
      is_active: true,
      employment_status: row.employment_status,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (createErr || !created) {
    throw new Error(createErr?.message ?? "Could not create fi_staff projection.");
  }

  const fiStaffId = String((created as { id: string }).id);
  const { error: linkErr } = await client
    .from("fi_staff_members")
    .update({ fi_staff_id: fiStaffId, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId);
  if (linkErr) throw new Error(linkErr.message);

  return { fiStaffId, email };
}

async function resolveOrCreateFiUser(
  tenantId: string,
  email: string,
  client: SupabaseClient
): Promise<string> {
  const { data: existing, error: findErr } = await client
    .from("fi_users")
    .select("id, tenant_id")
    .eq("tenant_id", tenantId)
    .ilike("email", email)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing) return String((existing as { id: string }).id);

  const now = new Date().toISOString();
  const { data: created, error: insErr } = await client
    .from("fi_users")
    .insert({
      tenant_id: tenantId,
      email,
      role: "member",
      auth_user_id: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? "Could not create fi_user.");
  return String((created as { id: string }).id);
}

async function repairAuthUserMetadata(
  authUserId: string,
  tenantId: string,
  client: SupabaseClient
): Promise<void> {
  const { data, error } = await client.auth.admin.getUserById(authUserId);
  if (error || !data.user) return;

  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const currentTenant = readMetadataTenantId(metadata);
  if (currentTenant === tenantId.trim().toLowerCase()) return;

  await client.auth.admin.updateUserById(authUserId, {
    user_metadata: {
      ...metadata,
      fi_tenant_id: tenantId,
      fi_role: "member",
    },
  });
}

/**
 * Hardened repair path: bind invite tenant + staff member to fi_users/fi_staff regardless of
 * stale auth metadata. Tenant truth comes from the invitation row / URL tenantId.
 */
export async function repairStaffTenantLinkFromInvitation(input: {
  tenantId: string;
  staffMemberId: string;
  inviteEmail: string;
  invitationId?: string | null;
  fiStaffId?: string | null;
  authUserId?: string | null;
  client?: SupabaseClient;
}): Promise<StaffTenantLinkRepairResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const email = input.inviteEmail.trim().toLowerCase();
  if (!email) throw new Error("Invite email is required.");

  const client = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const ensured = input.fiStaffId?.trim()
    ? { fiStaffId: input.fiStaffId.trim(), email }
    : await ensureFiStaffForMember(tid, staffMemberId, client);

  const fiStaffId = ensured.fiStaffId;
  const fiUserId = await resolveOrCreateFiUser(tid, email, client);

  const fiUserPatch: Record<string, unknown> = {
    email,
    updated_at: now,
  };
  if (input.authUserId?.trim()) {
    fiUserPatch.auth_user_id = input.authUserId.trim();
  }

  const { error: fiUserErr } = await client
    .from("fi_users")
    .update(fiUserPatch)
    .eq("tenant_id", tid)
    .eq("id", fiUserId);
  if (fiUserErr) throw new Error(fiUserErr.message);

  await updateFiStaff(tid, fiStaffId, { fi_user_id: fiUserId }, client);

  if (input.invitationId?.trim()) {
    await client
      .from("fi_staff_login_invitations")
      .update({
        fi_staff_id: fiStaffId,
        fi_user_id: fiUserId,
        invite_email: email,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", input.invitationId.trim());
  }

  if (input.authUserId?.trim()) {
    await repairAuthUserMetadata(input.authUserId.trim(), tid, client);
  }

  return { fiUserId, fiStaffId };
}

export async function loadCrossTenantInviteWarning(input: {
  tenantId: string;
  email: string;
  authUserId?: string | null;
  client?: SupabaseClient;
}): Promise<string | null> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const client = input.client ?? supabaseAdmin();
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const authUserId =
    input.authUserId?.trim() || (await findAuthUserIdByEmail(email, client)) || null;
  if (!authUserId) return null;

  const otherTenantNames = await loadOtherTenantNamesForAuthUser(tid, authUserId, client);
  if (otherTenantNames.length === 0) return null;

  const inviteTenantName = await loadTenantName(tid, client);
  return formatCrossTenantInviteWarning({
    email,
    inviteTenantName,
    otherTenantNames,
  });
}

export async function provisionStaffAuthInviteLink(input: {
  tenantId: string;
  email: string;
  origin: string;
  client?: SupabaseClient;
}): Promise<StaffAuthProvisionResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");

  const client = input.client ?? supabaseAdmin();
  const nextPath = `/fi-admin/${tid}`;
  const redirectTo = buildFiOsAuthConfirmUrl(input.origin.replace(/\/$/, ""), nextPath);

  const existingAuthUserId = await findAuthUserIdByEmail(email, client);
  const crossTenantWarning = existingAuthUserId
    ? await loadCrossTenantInviteWarning({
        tenantId: tid,
        email,
        authUserId: existingAuthUserId,
        client,
      })
    : null;

  if (existingAuthUserId) {
    await repairAuthUserMetadata(existingAuthUserId, tid, client);

    const { data: linkData, error: linkErr } = await client.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkErr || !linkData.user?.id) {
      throw new Error(FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE);
    }
    const inviteLink = linkData.properties?.action_link?.trim();
    if (!inviteLink) throw new Error(FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE);
    return {
      authUserId: String(linkData.user.id),
      inviteLink,
      reusedExistingAuthUser: true,
      crossTenantWarning,
    };
  }

  const { data: linkData, error: linkErr } = await client.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (linkErr || !linkData.user?.id) {
    const { data: inv, error: invErr } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { fi_tenant_id: tid, fi_role: "member" },
    });
    if (invErr || !inv.user?.id) {
      throw new Error(FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE);
    }
    const retry = await client.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    const inviteLink = retry.data?.properties?.action_link?.trim();
    if (!inviteLink) throw new Error(FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE);
    return {
      authUserId: inv.user.id,
      inviteLink,
      reusedExistingAuthUser: false,
      crossTenantWarning: null,
    };
  }

  const inviteLink = linkData.properties?.action_link?.trim();
  if (!inviteLink) throw new Error(FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE);
  return {
    authUserId: linkData.user.id,
    inviteLink,
    reusedExistingAuthUser: false,
    crossTenantWarning: null,
  };
}

export async function loadMembershipTenantIdsForAuthUser(
  authUserId: string,
  client?: SupabaseClient
): Promise<string[]> {
  const id = authUserId.trim();
  if (!id) return [];
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("tenant_id")
    .eq("auth_user_id", id);
  if (error) throw new Error(error.message);
  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String((row as { tenant_id: string }).tenant_id ?? "").trim())
        .filter(Boolean)
    )
  );
}

export async function repairStaffTenantLinkOnAuthConfirm(input: {
  authUserId: string;
  email: string;
  nextPath: string;
  client?: SupabaseClient;
}): Promise<{ repaired: boolean; tenantId: string | null }> {
  const authUserId = input.authUserId.trim();
  const email = input.email.trim().toLowerCase();
  if (!authUserId || !email) return { repaired: false, tenantId: null };

  const client = input.client ?? supabaseAdmin();
  const tenantId = extractTenantIdFromFiAdminPath(input.nextPath);
  if (!tenantId) return { repaired: false, tenantId: null };

  const { data: invitation, error } = await client
    .from("fi_staff_login_invitations")
    .select("id, staff_member_id, fi_staff_id, status, accepted_at")
    .eq("tenant_id", tenantId)
    .ilike("invite_email", email)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (invitation) {
    const row = invitation as {
      id: string;
      staff_member_id: string;
      fi_staff_id: string | null;
    };
    await repairStaffTenantLinkFromInvitation({
      tenantId,
      staffMemberId: String(row.staff_member_id),
      inviteEmail: email,
      invitationId: String(row.id),
      fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
      authUserId,
      client,
    });
    return { repaired: true, tenantId };
  }

  const memberships = await loadMembershipTenantIdsForAuthUser(authUserId, client);
  if (memberships.includes(tenantId)) {
    const { data: fiUser, error: fiUserErr } = await client
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (fiUserErr) throw new Error(fiUserErr.message);
    if (fiUser) {
      const { data: staff, error: staffErr } = await client
        .from("fi_staff")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("fi_user_id", String((fiUser as { id: string }).id))
        .limit(1)
        .maybeSingle();
      if (staffErr) throw new Error(staffErr.message);
      if (staff) {
        await repairAuthUserMetadata(authUserId, tenantId, client);
        return { repaired: false, tenantId };
      }
    }
  }

  const { data: authUser, error: authErr } = await client.auth.admin.getUserById(authUserId);
  if (authErr || !authUser?.user) return { repaired: false, tenantId };

  const metadataTenant = readMetadataTenantId(
    (authUser.user.user_metadata ?? {}) as Record<string, unknown>
  );
  if (
    shouldPreferMembershipOverMetadata({
      metadataTenantId: metadataTenant,
      membershipTenantIds: memberships,
    })
  ) {
    await repairAuthUserMetadata(authUserId, tenantId, client);
  }

  return { repaired: false, tenantId };
}

export async function attemptStaffTenantPortalRepair(input: {
  tenantId: string;
  authUserId: string;
  email?: string | null;
  client?: SupabaseClient;
}): Promise<boolean> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const authUserId = input.authUserId.trim();
  if (!authUserId) return false;

  const client = input.client ?? supabaseAdmin();
  const existing = await client
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (existing.data) return true;

  let email = input.email?.trim().toLowerCase() || null;
  if (!email) {
    const { data, error } = await client.auth.admin.getUserById(authUserId);
    if (error || !data.user?.email) return false;
    email = data.user.email.trim().toLowerCase();
  }

  const { data: invitation, error } = await client
    .from("fi_staff_login_invitations")
    .select("id, staff_member_id, fi_staff_id, status, accepted_at")
    .eq("tenant_id", tid)
    .ilike("invite_email", email)
    .in("status", ["accepted", "sent", "pending"])
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !invitation) return false;

  const row = invitation as {
    id: string;
    staff_member_id: string;
    fi_staff_id: string | null;
  };

  await repairStaffTenantLinkFromInvitation({
    tenantId: tid,
    staffMemberId: String(row.staff_member_id),
    inviteEmail: email,
    invitationId: String(row.id),
    fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
    authUserId,
    client,
  });
  return true;
}

/**
 * Mirror access suspend onto the scheduling projection (employment + active flag).
 * Kept beside other dual-table access linkage writes.
 */
export async function markSchedulingStaffSuspendedForAccess(input: {
  tenantId: string;
  fiStaffId: string;
  actorFiUserId?: string | null;
  client: SupabaseClient;
  now?: string;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const now = input.now ?? new Date().toISOString();
  const { error } = await input.client
    .from("fi_staff")
    .update({
      employment_status: "suspended",
      is_active: false,
      employment_status_changed_at: now,
      employment_status_changed_by: input.actorFiUserId ?? null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", sid);
  if (error) throw new Error(error.message);
}

/**
 * Onboarding centre staff creation — dual-table write boundary.
 * Callers own checklist / audit orchestration; this module owns fi_staff ↔ fi_staff_members
 * so onboarding page loaders can stay off the dual-table allowlist.
 */
export type ProvisionOnboardingStaffPairInput = {
  tenantId: string;
  fullName: string;
  email: string;
  roleCode: string;
  employmentType: string;
  clinicId: string | null;
  sourceSystem: string;
  client: SupabaseClient;
  now?: string;
};

export type ProvisionOnboardingStaffPairResult = {
  fiStaffId: string;
  staffMemberId: string;
  createdFiStaff: boolean;
};

async function findReusableOrphanFiStaffIdByEmail(
  tenantId: string,
  email: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data: staffRows, error: staffError } = await client
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .is("archived_at", null)
    .limit(1);
  if (staffError) throw new Error(staffError.message);
  const fiStaffId = staffRows?.[0]?.id != null ? String(staffRows[0].id) : null;
  if (!fiStaffId) return null;

  const { data: activeMember, error: memberError } = await client
    .from("fi_staff_members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("fi_staff_id", fiStaffId)
    .is("archived_at", null)
    .is("merged_into", null)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (activeMember) return null;

  return fiStaffId;
}

export async function rollbackOnboardingStaffPair(input: {
  tenantId: string;
  fiStaffId: string;
  staffMemberId?: string;
  createdFiStaff: boolean;
  client: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  if (input.staffMemberId) {
    await input.client
      .from("fi_staff_onboarding_checklists")
      .delete()
      .eq("tenant_id", tid)
      .eq("staff_member_id", input.staffMemberId);
    await input.client
      .from("fi_staff_members")
      .delete()
      .eq("tenant_id", tid)
      .eq("id", input.staffMemberId);
  }
  if (input.createdFiStaff) {
    const { error } = await input.client
      .from("fi_staff")
      .delete()
      .eq("tenant_id", tid)
      .eq("id", input.fiStaffId);
    if (error) throw new Error(error.message);
  }
}

export async function provisionOnboardingStaffPair(
  input: ProvisionOnboardingStaffPairInput
): Promise<ProvisionOnboardingStaffPairResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const now = input.now ?? new Date().toISOString();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const roleCode = input.roleCode.trim() || "consultant";
  const names = splitFullName(fullName);

  let fiStaffId = await findReusableOrphanFiStaffIdByEmail(tid, email, input.client);
  let createdFiStaff = false;

  if (fiStaffId) {
    const { error: updateError } = await input.client
      .from("fi_staff")
      .update({
        full_name: fullName,
        staff_role: roleCode,
        employment_status: "pending_onboarding",
        identity_source: "local",
        is_active: false,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", fiStaffId);
    if (updateError) throw new Error(updateError.message);
  } else {
    const fiStaff = await insertFiStaff(
      tid,
      {
        full_name: fullName,
        staff_role: roleCode,
        email,
        is_active: false,
      },
      input.client
    );
    fiStaffId = fiStaff.id;
    createdFiStaff = true;

    const { error: lifecycleError } = await input.client
      .from("fi_staff")
      .update({
        employment_status: "pending_onboarding",
        identity_source: "local",
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", fiStaffId);
    if (lifecycleError) {
      await rollbackOnboardingStaffPair({
        tenantId: tid,
        fiStaffId,
        createdFiStaff: true,
        client: input.client,
      });
      throw new Error(lifecycleError.message);
    }
  }

  const rollbackState = { fiStaffId, createdFiStaff };

  const { data: member, error: memberError } = await input.client
    .from("fi_staff_members")
    .insert({
      tenant_id: tid,
      fi_staff_id: fiStaffId,
      full_name: fullName,
      first_name: names.first_name || null,
      last_name: names.last_name || null,
      email,
      role_code: roleCode,
      employment_type: input.employmentType,
      employment_status: "pending_onboarding",
      clinic_id: input.clinicId?.trim() || null,
      identity_source: "local",
      source_system: input.sourceSystem,
      source_snapshot: { created_via: input.sourceSystem },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (memberError) {
    await rollbackOnboardingStaffPair({
      tenantId: tid,
      ...rollbackState,
      client: input.client,
    });
    throw new Error(memberError.message);
  }

  return {
    fiStaffId,
    staffMemberId: String((member as { id: string }).id),
    createdFiStaff,
  };
}
