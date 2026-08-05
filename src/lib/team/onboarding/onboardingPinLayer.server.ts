/**
 * Onboarding PIN completion / status — isolated from invite send/load.
 * Completing onboarding PIN must not invent login access.
 *
 * Cycle break (B2.2c):
 *   pinSetup (create/load) ← invitation send/load
 *   invitationAccept ← pinLayer (complete)
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { setStaffPinForTenant } from "@/src/lib/staffPin/staffPin.server";

import { syncOnboardingChecklistFromState } from "./onboardingChecklist.server";
import { acceptOnboardingInvitation } from "./onboardingInvitationAccept.server";
import { loadPinSetupByToken } from "./onboardingPinSetup.server";

export { createOnboardingPinSetupToken } from "./onboardingPinSetup.server";

export async function completeOnboardingPinSetup(input: {
  tenantId: string;
  setupToken: string;
  pin: string;
  inviteToken?: string | null;
  client?: SupabaseClient;
}): Promise<{ staffMemberId: string; fiStaffId: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const setup = await loadPinSetupByToken(tid, input.setupToken, supabase);
  if (!setup) throw new Error("PIN setup session not found.");
  if (setup.status === "completed") {
    return { staffMemberId: setup.staffMemberId, fiStaffId: setup.fiStaffId };
  }
  if (setup.status === "expired" || new Date(setup.expiresAt).getTime() < Date.now()) {
    await supabase
      .from("fi_staff_onboarding_pin_setups")
      .update({ status: "expired", updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", setup.id);
    throw new Error("PIN setup session has expired.");
  }

  if (input.inviteToken?.trim()) {
    await acceptOnboardingInvitation({
      tenantId: tid,
      inviteToken: input.inviteToken.trim(),
      client: supabase,
    });
  }

  // Existing PIN layer requires an active fi_staff row — enable for onboarding without changing auth.
  await supabase
    .from("fi_staff")
    .update({ is_active: true, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", setup.fiStaffId);

  await setStaffPinForTenant({
    tenantId: tid,
    staffId: setup.fiStaffId,
    pin: input.pin,
    actorFiUserId: null,
  });

  await supabase
    .from("fi_staff_onboarding_pin_setups")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", setup.id);

  await syncOnboardingChecklistFromState(tid, setup.staffMemberId, supabase);

  return { staffMemberId: setup.staffMemberId, fiStaffId: setup.fiStaffId };
}

export async function loadOnboardingPinSetupStatus(
  tenantId: string,
  fiStaffId: string
): Promise<"pending" | "completed" | "not_started"> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(fiStaffId, "fiStaffId");
  const { data, error } = await supabaseAdmin()
    .from("fi_staff_onboarding_pin_setups")
    .select("status")
    .eq("tenant_id", tid)
    .eq("fi_staff_id", sid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "not_started";
  const status = String((data as { status: string }).status);
  if (status === "completed") return "completed";
  return "pending";
}
