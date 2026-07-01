import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { setStaffPinForTenant } from "@/src/lib/staffPin/staffPin.server";

import { syncOnboardingChecklistFromState } from "./onboardingChecklist.server";
import { acceptOnboardingInvitation } from "./onboardingInvitation.server";
import { ONBOARDING_INVITE_EXPIRY_DAYS } from "./onboardingTypes";

/**
 * Isolated PIN management layer for staff onboarding.
 * Wraps existing fi_staff_pins operations without modifying staffPin.server.ts.
 */

export async function createOnboardingPinSetupToken(input: {
  tenantId: string;
  staffMemberId: string;
  fiStaffId: string;
  invitationId?: string | null;
  client?: SupabaseClient;
}): Promise<{ setupToken: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const fiStaffId = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + ONBOARDING_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const setupToken = randomUUID();

  const { error } = await supabase.from("fi_staff_onboarding_pin_setups").insert({
    tenant_id: tid,
    staff_member_id: mid,
    fi_staff_id: fiStaffId,
    invitation_id: input.invitationId?.trim() || null,
    setup_token: setupToken,
    status: "pending",
    expires_at: expiresAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  if (error) throw new Error(error.message);

  return { setupToken };
}

async function loadPinSetupByToken(
  tenantId: string,
  setupToken: string,
  client: SupabaseClient
): Promise<{
  id: string;
  staffMemberId: string;
  fiStaffId: string;
  status: string;
  expiresAt: string;
} | null> {
  const { data, error } = await client
    .from("fi_staff_onboarding_pin_setups")
    .select("id, staff_member_id, fi_staff_id, status, expires_at")
    .eq("tenant_id", tenantId)
    .eq("setup_token", setupToken.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    staff_member_id: string;
    fi_staff_id: string;
    status: string;
    expires_at: string;
  };
  return {
    id: String(row.id),
    staffMemberId: String(row.staff_member_id),
    fiStaffId: String(row.fi_staff_id),
    status: String(row.status),
    expiresAt: String(row.expires_at),
  };
}

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
