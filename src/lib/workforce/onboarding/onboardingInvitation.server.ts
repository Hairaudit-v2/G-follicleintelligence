import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import { syncOnboardingChecklistFromState } from "./onboardingChecklist.server";
import { buildOnboardingInviteUrl } from "./onboardingInviteUrlCore";
import { expireStaleOnboardingInvitations, newOnboardingToken } from "./onboardingPage.server";
import type { OnboardingInvitationStatus, OnboardingInvitePageModel } from "./onboardingTypes";
import { ONBOARDING_INVITE_EXPIRY_DAYS } from "./onboardingTypes";
import { createOnboardingPinSetupToken } from "./onboardingPinLayer.server";

export type SendOnboardingInviteResult = {
  invitationId: string;
  inviteUrl: string;
  status: OnboardingInvitationStatus;
  emailSent: boolean;
};

function resolveInvitationStatus(
  raw: unknown,
  expiresAt: string
): OnboardingInvitationStatus {
  const status = String(raw ?? "pending").trim().toLowerCase();
  if (status === "accepted") return "accepted";
  if (status === "expired" || new Date(expiresAt).getTime() < Date.now()) return "expired";
  return "pending";
}

async function loadStaffMemberForInvite(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<{ fullName: string; email: string | null; fiStaffId: string | null; roleCode: string | null }> {
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

  const member = await loadStaffMemberForInvite(tid, mid, supabase);
  const email = member.email?.trim().toLowerCase();
  if (!email) throw new Error("Staff member must have an email before sending an invite.");

  const token = newOnboardingToken();
  const { data: invitation, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .insert({
      tenant_id: tid,
      staff_member_id: mid,
      invite_token: token,
      invite_email: email,
      status: "pending",
      invited_by: input.invitedBy?.trim() || null,
      invited_at: now.toISOString(),
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const invitationId = String((invitation as { id: string }).id);
  const inviteUrl = buildOnboardingInviteUrl(tid, token);

  if (member.fiStaffId) {
    await createOnboardingPinSetupToken({
      tenantId: tid,
      staffMemberId: mid,
      fiStaffId: member.fiStaffId,
      invitationId,
      client: supabase,
    });
  }

  const emailSent = await trySendOnboardingInviteEmail({
    to: email,
    staffName: member.fullName,
    inviteUrl,
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

async function trySendOnboardingInviteEmail(input: {
  to: string;
  staffName: string;
  inviteUrl: string;
}): Promise<boolean> {
  try {
    const { sendResendEmailHttp } = await import("@/src/lib/email/resendHttpSend.server");
    const { buildResendFromAddress, isEmailDeliveryConfigured } = await import(
      "@/src/lib/reminders/reminderDeliveryConfig"
    );
    const { loadReminderDeliveryConfig } = await import(
      "@/src/lib/reminders/reminderDeliveryConfig.server"
    );
    const cfg = await loadReminderDeliveryConfig();
    if (!isEmailDeliveryConfigured(cfg)) return false;
    const fromHeader = buildResendFromAddress(cfg.resend);
    if (!fromHeader) return false;
    await sendResendEmailHttp({
      apiKey: cfg.resend.apiKey!,
      from: fromHeader,
      to: [input.to],
      subject: "Your Follicle Intelligence onboarding invitation",
      text: `Hi ${input.staffName},\n\nYou have been invited to join your clinic workspace. Complete your onboarding here:\n\n${input.inviteUrl}`,
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
  const { data: invitation, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select(
      "id, staff_member_id, invite_email, status, expires_at, tenant_id"
    )
    .eq("tenant_id", tid)
    .eq("invite_token", inviteToken)
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

  let pinSetupToken: string | null = null;
  if (member.fiStaffId && status === "pending") {
    const { data: pinSetup } = await supabase
      .from("fi_staff_onboarding_pin_setups")
      .select("setup_token, status, expires_at")
      .eq("tenant_id", tid)
      .eq("staff_member_id", String(inv.staff_member_id))
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pinSetup) {
      const row = pinSetup as { setup_token: string; expires_at: string };
      if (new Date(row.expires_at).getTime() > Date.now()) {
        pinSetupToken = String(row.setup_token);
      }
    }
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

  const { data: invitation, error } = await supabase
    .from("fi_staff_onboarding_invitations")
    .select("id, staff_member_id, status, expires_at")
    .eq("tenant_id", tid)
    .eq("invite_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invitation) throw new Error("Invitation not found.");

  const inv = invitation as {
    id: string;
    staff_member_id: string;
    status: string;
    expires_at: string;
  };

  const status = resolveInvitationStatus(inv.status, inv.expires_at);
  if (status === "expired") throw new Error("This invitation has expired.");
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
