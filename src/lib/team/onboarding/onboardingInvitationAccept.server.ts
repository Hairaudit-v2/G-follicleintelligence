/**
 * Onboarding invitation accept leaf — marks hire invite accepted + syncs checklist.
 * Must not import PIN setup / pin-layer modules (cycle break, B2.2c).
 * Does not activate login access.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { hashStaffAccessInviteToken } from "@/src/lib/team/access/staffAccessInviteCore";
import { syncOnboardingChecklistFromState } from "@/src/lib/team/onboarding/onboardingChecklist.server";
import { resolveOnboardingInvitationStatus } from "@/src/lib/team/onboarding/onboardingInviteStatusCore";

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

  const status = resolveOnboardingInvitationStatus(inv.status, inv.expires_at);
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
