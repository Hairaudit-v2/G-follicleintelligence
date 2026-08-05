import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveStaffIdentity } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";

import { syncOnboardingChecklistFromState } from "./onboardingChecklist.server";
import { buildOnboardingInviteUrl } from "./onboardingInviteUrlCore";
import { expireStaleOnboardingInvitations, newOnboardingToken } from "./onboardingPage.server";
import type { OnboardingInvitationStatus, OnboardingInvitePageModel } from "./onboardingTypes";
import { ONBOARDING_INVITE_EXPIRY_DAYS } from "./onboardingTypes";
import { createOnboardingPinSetupToken } from "./onboardingPinLayer.server";
import {
  buildOnboardingInviteEmail,
  extractStaffFirstName,
  formatInviteExpiryDate,
  hashStaffAccessInviteToken,
} from "@/src/lib/workforce/staffAccessInviteCore";

export type SendOnboardingInviteResult = {
  invitationId: string;
  inviteUrl: string;
  status: OnboardingInvitationStatus;
  emailSent: boolean;
};

const ONBOARDING_IDENTITY_TARGET_UNCERTAIN =
  "Staff identity requires reconciliation before this onboarding action can run.";

function assertUsableOnboardingIdentityTarget(identity: StaffIdentity | null): StaffIdentity {
  if (!identity) {
    throw new Error(ONBOARDING_IDENTITY_TARGET_UNCERTAIN);
  }
  const { linkStatus } = identity.integrity;
  if (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  ) {
    throw new Error(ONBOARDING_IDENTITY_TARGET_UNCERTAIN);
  }
  return identity;
}

async function assertEligibleOnboardingInviteTarget(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<StaffIdentity> {
  const identity = await resolveStaffIdentity(
    { tenantId, by: "staffMemberId", staffMemberId },
    { client }
  );
  return assertUsableOnboardingIdentityTarget(identity);
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

async function ensureFiStaffIdForOnboardingMember(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data, error } = await client
    .from("fi_staff_members")
    .select("fi_staff_id, full_name, email, role_code, employment_status")
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    fi_staff_id: string | null;
    full_name: string;
    email: string | null;
    role_code: string | null;
    employment_status: string;
  };
  if (row.fi_staff_id) return String(row.fi_staff_id);

  const email = row.email?.trim().toLowerCase();
  if (!email) return null;
  const now = new Date().toISOString();
  const { data: created, error: createErr } = await client
    .from("fi_staff")
    .insert({
      tenant_id: tenantId,
      full_name: String(row.full_name ?? "Staff").trim(),
      email,
      staff_role: row.role_code?.trim() || "consultant",
      is_active: false,
      employment_status: row.employment_status,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (createErr || !created) return null;
  const fiStaffId = String((created as { id: string }).id);
  await client
    .from("fi_staff_members")
    .update({ fi_staff_id: fiStaffId, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId);
  return fiStaffId;
}

async function revokeSupersededOnboardingInvites(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  await client
    .from("fi_staff_onboarding_invitations")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("staff_member_id", staffMemberId)
    .in("status", ["pending", "sent", "expired"]);
}
function resolveInvitationStatus(raw: unknown, expiresAt: string): OnboardingInvitationStatus {
  const status = String(raw ?? "pending")
    .trim()
    .toLowerCase();
  if (status === "accepted") return "accepted";
  if (status === "revoked") return "expired";
  if (status === "expired" || new Date(expiresAt).getTime() < Date.now()) return "expired";
  return "pending";
}

async function loadStaffMemberForInvite(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<{
  fullName: string;
  email: string | null;
  fiStaffId: string | null;
  roleCode: string | null;
}> {
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
  if (row.employment_status !== "pending_onboarding" && row.employment_status !== "inactive") {
    throw new Error("Only staff pending onboarding can receive invites.");
  }
  return {
    fullName: String(row.full_name ?? "Staff"),
    email: row.email,
    fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
    roleCode: row.role_code != null ? String(row.role_code) : null,
  };
}

export async function sendOnboardingInvite(input: {
  tenantId: string;
  staffMemberId: string;
  invitedBy?: string | null;
  client?: SupabaseClient;
}): Promise<SendOnboardingInviteResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + ONBOARDING_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await expireStaleOnboardingInvitations(tid, supabase);

  await assertEligibleOnboardingInviteTarget(tid, mid, supabase);

  const member = await loadStaffMemberForInvite(tid, mid, supabase);
  const email = member.email?.trim().toLowerCase();
  if (!email) throw new Error("Staff member must have an email before sending an invite.");

  const fiStaffId =
    (await ensureFiStaffIdForOnboardingMember(tid, mid, supabase)) ?? member.fiStaffId;
  const tenantName = await loadTenantName(tid, supabase);
  const token = newOnboardingToken();
  const tokenHash = hashStaffAccessInviteToken(token);
  const nowIso = now.toISOString();

  await revokeSupersededOnboardingInvites(tid, mid, supabase);

  const { data: invitation, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .insert({
      tenant_id: tid,
      staff_member_id: mid,
      invite_token: token,
      invite_token_hash: tokenHash,
      invite_email: email,
      status: "sent",
      invited_by: input.invitedBy?.trim() || null,
      last_sent_by_user_id: input.invitedBy?.trim() || null,
      invited_at: nowIso,
      sent_at: nowIso,
      expires_at: expiresAt,
      resend_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const invitationId = String((invitation as { id: string }).id);
  const inviteUrl = buildOnboardingInviteUrl(tid, token);

  if (fiStaffId) {
    await createOnboardingPinSetupToken({
      tenantId: tid,
      staffMemberId: mid,
      fiStaffId,
      invitationId,
      client: supabase,
    });
  }

  const emailSent = await trySendOnboardingInviteEmail({
    to: email,
    staffName: member.fullName,
    tenantName,
    inviteUrl,
    expiresAt,
  });

  if (emailSent) {
    await supabase
      .from("fi_staff_onboarding_invitations")
      .update({ email_sent_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("tenant_id", tid)
      .eq("id", invitationId);
  }

  return { invitationId, inviteUrl, status: "pending", emailSent };
}

export async function resendOnboardingInvite(input: {
  tenantId: string;
  staffMemberId: string;
  invitedBy?: string | null;
  client?: SupabaseClient;
}): Promise<SendOnboardingInviteResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + ONBOARDING_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await expireStaleOnboardingInvitations(tid, supabase);

  await assertEligibleOnboardingInviteTarget(tid, mid, supabase);

  const { data: existing, error: findErr } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("id, status, accepted_at, resend_count")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  const latest = existing as {
    id: string;
    status: string;
    accepted_at: string | null;
    resend_count: number | null;
  } | null;
  if (latest?.status === "accepted" || latest?.accepted_at) {
    throw new Error("This invite has already been accepted.");
  }

  const member = await loadStaffMemberForInvite(tid, mid, supabase);
  const email = member.email?.trim().toLowerCase();
  if (!email) throw new Error("Staff member must have an email before sending an invite.");

  const fiStaffId =
    (await ensureFiStaffIdForOnboardingMember(tid, mid, supabase)) ?? member.fiStaffId;
  const tenantName = await loadTenantName(tid, supabase);
  const token = newOnboardingToken();
  const tokenHash = hashStaffAccessInviteToken(token);
  const nowIso = now.toISOString();
  const nextResendCount = (latest?.resend_count ?? 0) + 1;

  let invitationId: string;
  if (latest && latest.status !== "accepted" && latest.status !== "revoked") {
    invitationId = latest.id;
    const { error: upErr } = await supabase
      .from("fi_staff_onboarding_invitations")
      .update({
        invite_token: token,
        invite_token_hash: tokenHash,
        invite_email: email,
        status: "sent",
        invited_at: nowIso,
        sent_at: nowIso,
        resent_at: nowIso,
        resend_count: nextResendCount,
        last_sent_by_user_id: input.invitedBy?.trim() || null,
        expires_at: expiresAt,
        updated_at: nowIso,
      })
      .eq("tenant_id", tid)
      .eq("id", invitationId);
    if (upErr) throw new Error(upErr.message);
  } else {
    await revokeSupersededOnboardingInvites(tid, mid, supabase);
    const { data: created, error: insErr } = await supabase
      .from("fi_staff_onboarding_invitations")
      .insert({
        tenant_id: tid,
        staff_member_id: mid,
        invite_token: token,
        invite_token_hash: tokenHash,
        invite_email: email,
        status: "sent",
        invited_by: input.invitedBy?.trim() || null,
        last_sent_by_user_id: input.invitedBy?.trim() || null,
        invited_at: nowIso,
        sent_at: nowIso,
        expires_at: expiresAt,
        resend_count: 0,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();
    if (insErr || !created) throw new Error(insErr?.message ?? "Could not create invitation.");
    invitationId = String((created as { id: string }).id);
  }

  const inviteUrl = buildOnboardingInviteUrl(tid, token);
  if (fiStaffId) {
    await createOnboardingPinSetupToken({
      tenantId: tid,
      staffMemberId: mid,
      fiStaffId,
      invitationId,
      client: supabase,
    });
  }

  const emailSent = await trySendOnboardingInviteEmail({
    to: email,
    staffName: member.fullName,
    tenantName,
    inviteUrl,
    expiresAt,
  });

  if (emailSent) {
    await supabase
      .from("fi_staff_onboarding_invitations")
      .update({ email_sent_at: nowIso, updated_at: nowIso })
      .eq("tenant_id", tid)
      .eq("id", invitationId);
  }

  return { invitationId, inviteUrl, status: "pending", emailSent };
}

async function trySendOnboardingInviteEmail(input: {
  to: string;
  staffName: string;
  tenantName: string;
  inviteUrl: string;
  expiresAt: string;
}): Promise<boolean> {
  try {
    const { sendResendEmailHttp } = await import("@/src/lib/email/resendHttpSend.server");
    const { buildResendFromAddress, isEmailDeliveryConfigured } =
      await import("@/src/lib/reminders/reminderDeliveryConfig");
    const { loadReminderDeliveryConfig } =
      await import("@/src/lib/reminders/reminderDeliveryConfig.server");
    const cfg = await loadReminderDeliveryConfig();
    if (!isEmailDeliveryConfigured(cfg)) return false;
    const fromHeader = buildResendFromAddress(cfg.resend);
    if (!fromHeader) return false;
    const { subject, text } = buildOnboardingInviteEmail({
      staffFirstName: extractStaffFirstName(input.staffName),
      clinicOrTenantName: input.tenantName,
      inviteLink: input.inviteUrl,
      expiryDate: formatInviteExpiryDate(input.expiresAt),
    });
    await sendResendEmailHttp({
      apiKey: cfg.resend.apiKey!,
      from: fromHeader,
      to: [input.to],
      subject,
      text,
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadOnboardingInviteByToken(
  tenantId: string,
  token: string
): Promise<OnboardingInvitePageModel | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const inviteToken = token.trim();
  if (!inviteToken) return null;

  await expireStaleOnboardingInvitations(tid);

  const supabase = supabaseAdmin();
  const tokenHash = hashStaffAccessInviteToken(inviteToken);
  const { data: invitation, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("id, staff_member_id, invite_email, status, expires_at, tenant_id, invite_token")
    .eq("tenant_id", tid)
    .or(`invite_token.eq.${inviteToken},invite_token_hash.eq.${tokenHash}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invitation) return null;

  const inv = invitation as {
    id: string;
    staff_member_id: string;
    invite_email: string;
    status: string;
    expires_at: string;
  };

  const status = resolveInvitationStatus(inv.status, inv.expires_at);
  if (status === "expired" && inv.status !== "expired") {
    await supabase
      .from("fi_staff_onboarding_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", inv.id);
  }

  const member = await loadStaffMemberForInvite(tid, String(inv.staff_member_id), supabase);
  const fiStaffId =
    (await ensureFiStaffIdForOnboardingMember(tid, String(inv.staff_member_id), supabase)) ??
    member.fiStaffId;

  let pinSetupToken: string | null = null;
  if (fiStaffId && status === "pending") {
    const created = await createOnboardingPinSetupToken({
      tenantId: tid,
      staffMemberId: String(inv.staff_member_id),
      fiStaffId,
      invitationId: String(inv.id),
      client: supabase,
    });
    pinSetupToken = created.setupToken;
  }

  return {
    tenantId: tid,
    staffMemberId: String(inv.staff_member_id),
    staffName: member.fullName,
    email: String(inv.invite_email),
    roleCode: member.roleCode,
    invitationStatus: status,
    pinSetupToken,
    expiresAt: String(inv.expires_at),
  };
}

export async function acceptOnboardingInvitation(input: {
  tenantId: string;
  inviteToken: string;
  client?: SupabaseClient;
}): Promise<{ staffMemberId: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const token = input.inviteToken.trim();
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const tokenHash = hashStaffAccessInviteToken(token);
  const { data: invitation, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("id, staff_member_id, status, expires_at")
    .eq("tenant_id", tid)
    .or(`invite_token.eq.${token},invite_token_hash.eq.${tokenHash}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invitation)
    throw new Error(
      "This invite is no longer active. Ask your clinic administrator for a new invite."
    );

  const inv = invitation as {
    id: string;
    staff_member_id: string;
    status: string;
    expires_at: string;
  };

  const status = resolveInvitationStatus(inv.status, inv.expires_at);
  if (status === "expired")
    throw new Error("This invite has expired. Ask your clinic administrator to resend it.");
  if (status === "accepted") return { staffMemberId: String(inv.staff_member_id) };

  const { error: updateError } = await supabase
    .from("fi_staff_onboarding_invitations")
    .update({ status: "accepted", accepted_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", inv.id);
  if (updateError) throw new Error(updateError.message);

  await syncOnboardingChecklistFromState(tid, String(inv.staff_member_id), supabase);

  return { staffMemberId: String(inv.staff_member_id) };
}

export async function copyOnboardingInviteLink(input: {
  tenantId: string;
  staffMemberId: string;
  client?: SupabaseClient;
}): Promise<{ inviteUrl: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();

  const { data: member, error: memberErr } = await supabase
    .from("fi_staff_members")
    .select("system_access_revoked, employment_status")
    .eq("tenant_id", tid)
    .eq("id", mid)
    .maybeSingle();
  if (memberErr) throw new Error(memberErr.message);
  if (!member) throw new Error("Staff member not found.");
  const memberRow = member as { system_access_revoked: boolean | null; employment_status: string };
  if (Boolean(memberRow.system_access_revoked)) {
    throw new Error("This staff member's access is suspended. Reactivate access before resending.");
  }
  if (String(memberRow.employment_status).trim().toLowerCase() === "suspended") {
    throw new Error("This staff member's access is suspended. Reactivate access before resending.");
  }

  const { data, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("invite_token, status, expires_at, accepted_at")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .in("status", ["pending", "sent", "expired"])
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No pending onboarding invite found.");

  const row = data as {
    invite_token: string;
    status: string;
    expires_at: string;
    accepted_at: string | null;
  };
  if (row.accepted_at) throw new Error("This invite has already been accepted.");

  const status = resolveInvitationStatus(row.status, row.expires_at);
  if (status === "accepted") throw new Error("This invite has already been accepted.");
  if (status === "expired") {
    throw new Error("This invite has expired. Ask your clinic administrator to resend it.");
  }

  const token = row.invite_token?.trim();
  if (!token) throw new Error("Invite link is unavailable.");
  return { inviteUrl: buildOnboardingInviteUrl(tid, token) };
}
