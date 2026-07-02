import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { setStaffPinForTenant } from "@/src/lib/staffPin/staffPin.server";
import { insertFiStaffPinAuditEvent } from "@/src/lib/staffPin/staffPinAudit.server";

import {
  hashStaffAccessInviteToken,
  STAFF_ACCESS_INVITE_ERRORS,
  staffAccessInviteExpiryIso,
} from "./staffAccessInviteCore";
import {
  insertStaffAccessAuditEvent,
  STAFF_ACCESS_AUDIT_EVENTS,
} from "./staffAccessInviteAudit.server";

export async function revokePendingStaffAccessPinSetups(input: {
  tenantId: string;
  staffMemberId: string;
  client: SupabaseClient;
}): Promise<void> {
  const now = new Date().toISOString();
  await input.client
    .from("fi_staff_access_pin_setups")
    .update({ status: "revoked", updated_at: now })
    .eq("tenant_id", input.tenantId)
    .eq("staff_member_id", input.staffMemberId)
    .eq("status", "pending");
}

export async function createStaffAccessPinSetupToken(input: {
  tenantId: string;
  staffMemberId: string;
  fiStaffId: string;
  loginInvitationId?: string | null;
  actorFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<{ setupToken: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const fiStaffId = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date();
  const expiresAt = staffAccessInviteExpiryIso(now);
  const setupToken = randomUUID();
  const setupTokenHash = hashStaffAccessInviteToken(setupToken);

  await revokePendingStaffAccessPinSetups({ tenantId: tid, staffMemberId: mid, client: supabase });

  const { error } = await supabase.from("fi_staff_access_pin_setups").insert({
    tenant_id: tid,
    staff_member_id: mid,
    fi_staff_id: fiStaffId,
    login_invitation_id: input.loginInvitationId?.trim() || null,
    setup_token_hash: setupTokenHash,
    status: "pending",
    expires_at: expiresAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  if (error) throw new Error(error.message);

  await insertStaffAccessAuditEvent({
    tenantId: tid,
    staffMemberId: mid,
    eventType: STAFF_ACCESS_AUDIT_EVENTS.PIN_SETUP_LINK_CREATED,
    actorFiUserId: input.actorFiUserId ?? null,
    metadata: { fi_staff_id: fiStaffId, login_invitation_id: input.loginInvitationId ?? null },
    client: supabase,
  });

  return { setupToken };
}

async function loadPinSetupByTokenHash(
  tenantId: string,
  setupToken: string,
  client: SupabaseClient
): Promise<{
  id: string;
  staffMemberId: string;
  fiStaffId: string;
  loginInvitationId: string | null;
  status: string;
  expiresAt: string;
} | null> {
  const tokenHash = hashStaffAccessInviteToken(setupToken);
  const { data, error } = await client
    .from("fi_staff_access_pin_setups")
    .select("id, staff_member_id, fi_staff_id, login_invitation_id, status, expires_at")
    .eq("tenant_id", tenantId)
    .eq("setup_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    staff_member_id: string;
    fi_staff_id: string;
    login_invitation_id: string | null;
    status: string;
    expires_at: string;
  };
  return {
    id: String(row.id),
    staffMemberId: String(row.staff_member_id),
    fiStaffId: String(row.fi_staff_id),
    loginInvitationId: row.login_invitation_id != null ? String(row.login_invitation_id) : null,
    status: String(row.status),
    expiresAt: String(row.expires_at),
  };
}

export async function completeStaffAccessPinSetup(input: {
  tenantId: string;
  setupToken: string;
  pin: string;
  client?: SupabaseClient;
}): Promise<{ staffMemberId: string; fiStaffId: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const setup = await loadPinSetupByTokenHash(tid, input.setupToken, supabase);
  if (!setup) throw new Error(STAFF_ACCESS_INVITE_ERRORS.NOT_ACTIVE);
  if (setup.status === "completed") {
    return { staffMemberId: setup.staffMemberId, fiStaffId: setup.fiStaffId };
  }
  if (setup.status === "revoked") {
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.NOT_ACTIVE);
  }
  if (setup.status === "expired" || new Date(setup.expiresAt).getTime() < Date.now()) {
    await supabase
      .from("fi_staff_access_pin_setups")
      .update({ status: "expired", updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", setup.id);
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.EXPIRED);
  }

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
    .from("fi_staff_access_pin_setups")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", setup.id);

  return { staffMemberId: setup.staffMemberId, fiStaffId: setup.fiStaffId };
}

/** Admin-initiated PIN reset — creates a self-service setup token; admin never sees the PIN. */
export async function requestStaffPinResetLink(input: {
  tenantId: string;
  staffMemberId: string;
  actorFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<{ setupToken: string; setupUrl: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();

  const { data: member, error } = await supabase
    .from("fi_staff_members")
    .select("fi_staff_id, system_access_revoked, employment_status")
    .eq("tenant_id", tid)
    .eq("id", mid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("Staff member not found.");

  const row = member as {
    fi_staff_id: string | null;
    system_access_revoked: boolean | null;
    employment_status: string;
  };
  if (Boolean(row.system_access_revoked)) {
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.SUSPENDED);
  }
  if (String(row.employment_status).trim().toLowerCase() === "suspended") {
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.SUSPENDED);
  }
  const fiStaffId = row.fi_staff_id != null ? String(row.fi_staff_id) : null;
  if (!fiStaffId) throw new Error("Staff account is not provisioned yet.");

  await insertStaffAccessAuditEvent({
    tenantId: tid,
    staffMemberId: mid,
    eventType: STAFF_ACCESS_AUDIT_EVENTS.PIN_RESET_REQUESTED,
    actorFiUserId: input.actorFiUserId ?? null,
    metadata: { fi_staff_id: fiStaffId },
    client: supabase,
  });

  const { setupToken } = await createStaffAccessPinSetupToken({
    tenantId: tid,
    staffMemberId: mid,
    fiStaffId,
    actorFiUserId: input.actorFiUserId ?? null,
    client: supabase,
  });

  const { buildStaffAccessPinSetupUrl } = await import("./staffAccessInviteCore");
  const setupUrl = buildStaffAccessPinSetupUrl(tid, setupToken);

  return { setupToken, setupUrl };
}

export async function completeStaffPinResetViaToken(input: {
  tenantId: string;
  setupToken: string;
  pin: string;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = input.client ?? supabaseAdmin();
  const result = await completeStaffAccessPinSetup({
    tenantId: input.tenantId,
    setupToken: input.setupToken,
    pin: input.pin,
    client: supabase,
  });

  await insertFiStaffPinAuditEvent({
    tenantId: input.tenantId,
    eventKind: "staff_pin.reset",
    staffId: result.fiStaffId,
    actorFiUserId: null,
    client: supabase,
  });

  await insertStaffAccessAuditEvent({
    tenantId: input.tenantId,
    staffMemberId: result.staffMemberId,
    eventType: STAFF_ACCESS_AUDIT_EVENTS.PIN_RESET_COMPLETED,
    metadata: { fi_staff_id: result.fiStaffId },
    client: supabase,
  });
}
