/**
 * Onboarding PIN setup token leaf — create / load only.
 * Must not import invitation or pin-completion modules (cycle break, B2.2c).
 */

import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { ONBOARDING_INVITE_EXPIRY_DAYS } from "@/src/lib/team/onboarding/onboardingTypes";

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

export async function loadPinSetupByToken(
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
