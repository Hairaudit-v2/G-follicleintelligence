import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { updateFiStaff } from "@/src/lib/staff/staff.server";
import { disableStaffPinForTenant } from "@/src/lib/staffPin/staffPin.server";
import {
  applyStaffAccessEntryFlags,
  projectStaffAccessEntry,
  type StaffAccessAttentionReason,
} from "@/src/lib/team/access";
import { resolveStaffIdentities, resolveStaffIdentity } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  ensureFiStaffForMember,
  markSchedulingStaffSuspendedForAccess,
  provisionStaffAuthInviteLink,
  repairStaffTenantLinkFromInvitation,
} from "@/src/lib/workforce/staffTenantLinkRepair.server";
import { loadStaffPinMetadataForStaff } from "@/src/lib/staffPin/staffPin.server";
import {
  authLoginStatusLabel,
  canReceiveLoginInvite,
  inviteStatusLabel,
  nextResendInvitationTimestamps,
  pinStatusLabel,
  resolveAuthLoginStatus,
  resolveInviteStatus,
  resolvePermissionTemplateLabel,
  type StaffAuthLoginStatus,
  type StaffInviteStatus,
} from "@/src/lib/workforce/staffAccessCentreCore";
import {
  buildStaffAccessInviteEmail,
  buildStaffAccessInviteUrl,
  extractStaffFirstName,
  formatInviteExpiryDate,
  generateStaffAccessInviteToken,
  hashStaffAccessInviteToken,
  STAFF_ACCESS_INVITE_ERRORS,
  STAFF_ACCESS_INVITE_EXPIRY_DAYS,
} from "@/src/lib/workforce/staffAccessInviteCore";
import {
  insertStaffAccessAuditEvent,
  STAFF_ACCESS_AUDIT_EVENTS,
} from "@/src/lib/workforce/staffAccessInviteAudit.server";
import { createStaffAccessPinSetupToken } from "@/src/lib/workforce/staffAccessPinLayer.server";

export type StaffAccessCentreRow = {
  staffMemberId: string;
  fiStaffId: string | null;
  fullName: string;
  email: string | null;
  roleCode: string | null;
  employmentStatus: string;
  archivedAt: string | null;
  systemAccessRevoked: boolean;
  authLoginStatus: StaffAuthLoginStatus;
  authLoginLabel: string;
  pinStatus: string;
  permissionTemplate: string;
  inviteStatus: StaffInviteStatus;
  inviteLabel: string;
  inviteUrl: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  resendCount: number;
  canSendInvite: boolean;
  canResendInvite: boolean;
  canCopyInviteLink: boolean;
  canResetPin: boolean;
  canRevokeAccess: boolean;
  canSuspendAccess: boolean;
  /** Identity integrity / access attention — never invents access decisions. */
  attentionReasons: StaffAccessAttentionReason[];
};

export type StaffAccessCentrePageModel = {
  tenantId: string;
  rows: StaffAccessCentreRow[];
};

function firstForwardedValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = firstForwardedValue(h.get("x-forwarded-host")) ?? h.get("host")?.trim() ?? null;
  const protoRaw = firstForwardedValue(h.get("x-forwarded-proto")) ?? "http";
  const proto = protoRaw.split("/")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return fallback && fallback.length > 0 ? fallback : "http://localhost:3000";
}

type AuthUserSnapshot = {
  emailConfirmed: boolean;
  hasSignedIn: boolean;
};

async function loadAuthSnapshots(
  authUserIds: string[],
  client: SupabaseClient
): Promise<Map<string, AuthUserSnapshot>> {
  const out = new Map<string, AuthUserSnapshot>();
  for (const id of authUserIds) {
    const { data, error } = await client.auth.admin.getUserById(id);
    if (error || !data.user) continue;
    out.set(id, {
      emailConfirmed: Boolean(data.user.email_confirmed_at),
      hasSignedIn: Boolean(data.user.last_sign_in_at),
    });
  }
  return out;
}

async function expireStaleLoginInvitations(
  tenantId: string,
  client: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  await client
    .from("fi_staff_login_invitations")
    .update({ status: "expired", updated_at: now })
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "sent"])
    .lt("expires_at", now);
}

export type LoadStaffAccessCentrePageOptions = {
  staffMemberId?: string;
  supabaseClientForTests?: SupabaseClient;
  /**
   * Shared identity map from a parent composer (e.g. profile hub).
   * When set, this loader does not call resolveStaffIdentities again.
   */
  preresolvedIdentitiesByMemberId?: ReadonlyMap<string, StaffIdentity | null>;
};

export async function loadStaffAccessCentrePage(
  tenantId: string,
  options?: LoadStaffAccessCentrePageOptions | SupabaseClient
): Promise<StaffAccessCentrePageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const normalizedOptions: LoadStaffAccessCentrePageOptions =
    options && "from" in (options as SupabaseClient)
      ? { supabaseClientForTests: options as SupabaseClient }
      : ((options as LoadStaffAccessCentrePageOptions | undefined) ?? {});
  const staffMemberId = normalizedOptions.staffMemberId?.trim() || null;
  const supabase = normalizedOptions.supabaseClientForTests ?? supabaseAdmin();

  // P2: expire stale fi_staff_login_invitations via cron — send/resend mutation paths already call
  // expireStaleLoginInvitations before writing new invites.

  let memberQuery = supabase
    .from("fi_staff_members")
    .select(
      "id, full_name, email, role_code, employment_status, fi_staff_id, archived_at, system_access_revoked"
    )
    .eq("tenant_id", tid)
    .is("merged_into", null)
    .order("full_name", { ascending: true });
  if (staffMemberId) {
    memberQuery = memberQuery.eq("id", staffMemberId);
  }
  const { data: members, error } = await memberQuery;
  if (error) throw new Error(error.message);

  const memberRows = (members ?? []) as {
    id: string;
    full_name: string;
    email: string | null;
    role_code: string | null;
    employment_status: string;
    fi_staff_id: string | null;
    archived_at: string | null;
    system_access_revoked: boolean | null;
  }[];

  const memberIds = memberRows.map((m) => String(m.id));

  /**
   * Fixed query budget for identity: batch resolve uses bounded `.in(...)` loads
   * (not one query per staff member). See resolveStaffIdentities.
   * Collects staffId / staffMemberId / userId via the canonical resolver —
   * no raw dual-table join in this loader.
   * Profile / composers may inject a shared identity map to avoid a second resolve.
   */
  const identityBatch = normalizedOptions.preresolvedIdentitiesByMemberId
    ? {
        byKey: new Map(normalizedOptions.preresolvedIdentitiesByMemberId),
        unresolved: [] as { key: string; reason: "missing" }[],
      }
    : await resolveStaffIdentities(
        {
          tenantId: tid,
          by: "staffMemberId",
          staffMemberIds: memberIds,
        },
        { client: supabase }
      );

  const fiUserIds = [
    ...new Set(
      [...identityBatch.byKey.values()]
        .map((identity) => identity?.userId?.trim() || null)
        .filter(Boolean) as string[]
    ),
  ];
  const fiUserById = new Map<string, { auth_user_id: string | null; email: string | null }>();
  if (fiUserIds.length) {
    const { data: userRows, error: uErr } = await supabase
      .from("fi_users")
      .select("id, auth_user_id, email")
      .eq("tenant_id", tid)
      .in("id", fiUserIds);
    if (uErr) throw new Error(uErr.message);
    for (const raw of userRows ?? []) {
      const r = raw as { id: string; auth_user_id: string | null; email: string | null };
      fiUserById.set(String(r.id), {
        auth_user_id: r.auth_user_id != null ? String(r.auth_user_id) : null,
        email: r.email,
      });
    }
  }

  const authUserIds = [
    ...new Set([...fiUserById.values()].map((u) => u.auth_user_id).filter(Boolean) as string[]),
  ];
  const authSnapshots = await loadAuthSnapshots(authUserIds, supabase);

  const latestInviteByMember = new Map<
    string,
    {
      id: string;
      status: string;
      expires_at: string;
      invite_link: string | null;
      invited_at: string;
      resend_count: number | null;
      accepted_at: string | null;
    }
  >();
  if (memberIds.length) {
    const { data: invites, error: invErr } = await supabase
      .from("fi_staff_login_invitations")
      .select(
        "id, staff_member_id, status, expires_at, invite_link, invited_at, resend_count, accepted_at"
      )
      .eq("tenant_id", tid)
      .in("staff_member_id", memberIds)
      .order("invited_at", { ascending: false });
    if (invErr) throw new Error(invErr.message);
    for (const raw of invites ?? []) {
      const r = raw as {
        id: string;
        staff_member_id: string;
        status: string;
        expires_at: string;
        invite_link: string | null;
        invited_at: string;
        resend_count: number | null;
        accepted_at: string | null;
      };
      const mid = String(r.staff_member_id);
      if (!latestInviteByMember.has(mid)) latestInviteByMember.set(mid, r);
    }
  }

  const fiStaffIds = [
    ...new Set(
      [...identityBatch.byKey.values()]
        .map((identity) => identity?.staffId?.trim() || null)
        .filter(Boolean) as string[]
    ),
  ];
  const pinStatusByStaffId = new Map<string, string>();
  for (const fiStaffId of fiStaffIds) {
    const pinMeta = await loadStaffPinMetadataForStaff(tid, fiStaffId);
    pinStatusByStaffId.set(fiStaffId, pinMeta.status);
  }

  const rows: StaffAccessCentreRow[] = [];
  for (const member of memberRows) {
    const mid = String(member.id);
    const identity = identityBatch.byKey.get(mid) ?? null;
    const fiStaffId = identity?.staffId ?? (member.fi_staff_id != null ? String(member.fi_staff_id) : null);
    const fiUserId = identity?.userId ?? null;
    const fiUser = fiUserId ? fiUserById.get(fiUserId) : null;
    const authUserId = fiUser?.auth_user_id ?? null;
    const authSnap = authUserId ? authSnapshots.get(authUserId) : null;

    const authLoginStatus = resolveAuthLoginStatus({
      systemAccessRevoked: Boolean(member.system_access_revoked),
      employmentStatus: member.employment_status,
      fiUserId,
      authUserId,
      authEmailConfirmed: authSnap?.emailConfirmed ?? false,
      authHasSignedIn: authSnap?.hasSignedIn ?? false,
    });

    const latestInvite = latestInviteByMember.get(mid);
    const inviteStatus = resolveInviteStatus({
      invitationStatus: latestInvite?.status,
      expiresAt: latestInvite?.expires_at,
    });

    const email =
      member.email?.trim() || identity?.email?.trim() || fiUser?.email?.trim() || null;
    const canSend = canReceiveLoginInvite({
      archivedAt: member.archived_at,
      employmentStatus: member.employment_status,
      email,
      systemAccessRevoked: Boolean(member.system_access_revoked),
      authLoginStatus,
    });

    const inviteAccepted =
      inviteStatus === "accepted" ||
      Boolean(latestInvite?.accepted_at) ||
      authLoginStatus === "login_active";
    const canResend =
      canSend &&
      !inviteAccepted &&
      (inviteStatus === "pending" || inviteStatus === "expired" || inviteStatus === "none");
    const canCopy =
      (inviteStatus === "pending" || inviteStatus === "expired") &&
      Boolean(latestInvite?.invite_link?.trim());
    const canResetPin =
      Boolean(fiStaffId) &&
      !member.archived_at &&
      !Boolean(member.system_access_revoked) &&
      authLoginStatus !== "suspended" &&
      authLoginStatus !== "revoked" &&
      (inviteAccepted || authLoginStatus === "invite_pending");
    const canRevoke =
      Boolean(fiUserId || authLoginStatus !== "no_login" || inviteStatus === "pending") &&
      !member.archived_at;
    const canSuspend =
      !member.archived_at &&
      !isDepartedForSuspend(member.employment_status) &&
      authLoginStatus !== "revoked";

    const resolvedInviteStatus: StaffInviteStatus =
      inviteAccepted && inviteStatus !== "revoked" ? "accepted" : inviteStatus;

    const accessFacts = {
      authLoginStatus,
      inviteStatus: resolvedInviteStatus,
      loginInviteId: latestInvite?.id != null ? String(latestInvite.id) : null,
      loginInviteExpiresAt: latestInvite?.expires_at ?? null,
      canSendInvite: canSend && inviteStatus === "none" && !inviteAccepted,
      canResendInvite: canResend,
      canSuspendAccess: canSuspend && authLoginStatus !== "suspended",
      canRevokeAccess: canRevoke,
    };

    const accessEntry = identity
      ? projectStaffAccessEntry(identity, accessFacts)
      : null;
    const identityFlags = accessEntry
      ? applyStaffAccessEntryFlags(accessEntry)
      : {
          canSendInvite: accessFacts.canSendInvite,
          canResendInvite: accessFacts.canResendInvite,
          canSuspendAccess: accessFacts.canSuspendAccess,
          canRevokeAccess: accessFacts.canRevokeAccess,
          attentionReasons: ["identity_invalid"] as StaffAccessAttentionReason[],
        };

    rows.push({
      staffMemberId: mid,
      fiStaffId,
      fullName: String(member.full_name ?? identity?.displayName ?? "Staff"),
      email,
      roleCode: member.role_code,
      employmentStatus: member.employment_status,
      archivedAt: member.archived_at,
      systemAccessRevoked: Boolean(member.system_access_revoked),
      authLoginStatus,
      authLoginLabel: authLoginStatusLabel(authLoginStatus),
      pinStatus: pinStatusLabel(fiStaffId ? pinStatusByStaffId.get(fiStaffId) : "not_set"),
      permissionTemplate: resolvePermissionTemplateLabel(member.role_code),
      inviteStatus: resolvedInviteStatus,
      inviteLabel: inviteStatusLabel(resolvedInviteStatus),
      inviteUrl: latestInvite?.invite_link?.trim() || null,
      invitedAt: latestInvite?.invited_at ?? null,
      inviteExpiresAt: latestInvite?.expires_at ?? null,
      resendCount: latestInvite?.resend_count ?? 0,
      canSendInvite: identityFlags.canSendInvite,
      canResendInvite: identityFlags.canResendInvite,
      canCopyInviteLink: canCopy,
      canResetPin,
      canRevokeAccess: identityFlags.canRevokeAccess,
      canSuspendAccess: identityFlags.canSuspendAccess,
      attentionReasons: identityFlags.attentionReasons,
    });
  }

  return { tenantId: tid, rows };
}

/** Single staff member access snapshot — avoids full-tenant sync on profile pages. */
export async function loadStaffAccessCentreRowForMember(
  tenantId: string,
  staffMemberId: string,
  options?: {
    identity?: StaffIdentity | null;
    supabaseClientForTests?: SupabaseClient;
  }
): Promise<StaffAccessCentreRow | null> {
  const mid = staffMemberId.trim();
  const preresolved =
    options && "identity" in options
      ? new Map<string, StaffIdentity | null>([[mid, options.identity ?? null]])
      : undefined;
  const page = await loadStaffAccessCentrePage(tenantId, {
    staffMemberId: mid,
    supabaseClientForTests: options?.supabaseClientForTests,
    preresolvedIdentitiesByMemberId: preresolved,
  });
  return page.rows[0] ?? null;
}

function isDepartedForSuspend(status: string): boolean {
  return ["terminated", "resigned", "contract_ended", "contract_expired", "merged"].includes(
    String(status).trim().toLowerCase()
  );
}

export type SendStaffLoginInviteResult = {
  invitationId: string;
  inviteUrl: string;
  emailSent: boolean;
  crossTenantWarning: string | null;
};

const ACCESS_IDENTITY_TARGET_UNCERTAIN =
  "Staff identity requires reconciliation before this access action can run.";

function assertUsableAccessIdentityTarget(identity: StaffIdentity | null): StaffIdentity {
  if (!identity) {
    throw new Error(ACCESS_IDENTITY_TARGET_UNCERTAIN);
  }
  const { linkStatus } = identity.integrity;
  if (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  ) {
    throw new Error(ACCESS_IDENTITY_TARGET_UNCERTAIN);
  }
  return identity;
}

async function assertEligibleForLoginInvite(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<{ fiStaffId: string; email: string; fullName: string }> {
  const identity = assertUsableAccessIdentityTarget(
    await resolveStaffIdentity(
      { tenantId, by: "staffMemberId", staffMemberId },
      { client }
    )
  );

  const { fiStaffId, email } = await ensureFiStaffForMember(tenantId, staffMemberId, client);

  const { data: member, error } = await client
    .from("fi_staff_members")
    .select("full_name, employment_status, archived_at, system_access_revoked")
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("Staff member not found.");

  const row = member as {
    full_name: string;
    employment_status: string;
    archived_at: string | null;
    system_access_revoked: boolean | null;
  };

  let authLoginStatus: StaffAuthLoginStatus = "no_login";
  const fiUserId = identity.userId;
  if (fiUserId) {
    const { data: fiUser, error: uErr } = await client
      .from("fi_users")
      .select("auth_user_id")
      .eq("tenant_id", tenantId)
      .eq("id", String(fiUserId))
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    const authUserId = (fiUser as { auth_user_id: string | null } | null)?.auth_user_id;
    let authEmailConfirmed = false;
    let authHasSignedIn = false;
    if (authUserId) {
      const snap = await loadAuthSnapshots([String(authUserId)], client);
      const s = snap.get(String(authUserId));
      authEmailConfirmed = s?.emailConfirmed ?? false;
      authHasSignedIn = s?.hasSignedIn ?? false;
    }
    authLoginStatus = resolveAuthLoginStatus({
      systemAccessRevoked: Boolean(row.system_access_revoked),
      employmentStatus: row.employment_status,
      fiUserId: String(fiUserId),
      authUserId: authUserId != null ? String(authUserId) : null,
      authEmailConfirmed,
      authHasSignedIn,
    });
  }

  if (
    !canReceiveLoginInvite({
      archivedAt: row.archived_at,
      employmentStatus: row.employment_status,
      email,
      systemAccessRevoked: Boolean(row.system_access_revoked),
      authLoginStatus,
    })
  ) {
    if (Boolean(row.system_access_revoked) || authLoginStatus === "suspended") {
      throw new Error(STAFF_ACCESS_INVITE_ERRORS.REVOKED_REACTIVATE);
    }
    if (authLoginStatus === "login_active") {
      throw new Error(STAFF_ACCESS_INVITE_ERRORS.ACCEPTED_NO_RESEND);
    }
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.NOT_ELIGIBLE);
  }

  return { fiStaffId, email, fullName: String(row.full_name ?? "Staff") };
}

async function loadTenantDisplayName(tenantId: string, client: SupabaseClient): Promise<string> {
  // tenant-guard-allow: fi_tenants registry lookup by URL/invitation tenant id
  const { data, error } = await client
    .from("fi_tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String((data as { name: string } | null)?.name ?? "Your clinic").trim() || "Your clinic";
}

async function revokeSupersededLoginInvites(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  await client
    .from("fi_staff_login_invitations")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("staff_member_id", staffMemberId)
    .in("status", ["pending", "sent", "expired"]);
}

async function trySendStaffAccessInviteEmail(input: {
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
    const { subject, text } = buildStaffAccessInviteEmail({
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

async function upsertStaffLoginInvitation(input: {
  tenantId: string;
  staffMemberId: string;
  fiStaffId: string;
  fiUserId: string;
  email: string;
  inviteToken: string;
  inviteUrl: string;
  authInviteLink: string;
  invitedBy: string | null;
  isResend: boolean;
  existingInvitationId?: string | null;
  existingResendCount?: number;
  client: SupabaseClient;
  now: Date;
}): Promise<string> {
  const tokenHash = hashStaffAccessInviteToken(input.inviteToken);
  const timestamps = nextResendInvitationTimestamps(input.now, STAFF_ACCESS_INVITE_EXPIRY_DAYS);
  const nowIso = input.now.toISOString();

  if (input.isResend && input.existingInvitationId) {
    const { error: upErr } = await input.client
      .from("fi_staff_login_invitations")
      .update({
        invite_token_hash: tokenHash,
        invite_link: input.inviteUrl,
        auth_invite_link: input.authInviteLink,
        invite_email: input.email,
        fi_staff_id: input.fiStaffId,
        fi_user_id: input.fiUserId,
        status: "sent",
        invited_at: timestamps.invitedAt,
        sent_at: timestamps.invitedAt,
        resent_at: nowIso,
        resend_count: (input.existingResendCount ?? 0) + 1,
        last_sent_by_user_id: input.invitedBy,
        expires_at: timestamps.expiresAt,
        updated_at: timestamps.updatedAt,
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.existingInvitationId);
    if (upErr) throw new Error(upErr.message);
    return input.existingInvitationId;
  }

  await revokeSupersededLoginInvites(input.tenantId, input.staffMemberId, input.client);

  const { data: invitation, error } = await input.client
    .from("fi_staff_login_invitations")
    .insert({
      tenant_id: input.tenantId,
      staff_member_id: input.staffMemberId,
      fi_staff_id: input.fiStaffId,
      fi_user_id: input.fiUserId,
      invite_email: input.email,
      invite_token_hash: tokenHash,
      invite_link: input.inviteUrl,
      auth_invite_link: input.authInviteLink,
      status: "sent",
      invited_by: input.invitedBy,
      last_sent_by_user_id: input.invitedBy,
      invited_at: timestamps.invitedAt,
      sent_at: timestamps.invitedAt,
      expires_at: timestamps.expiresAt,
      resend_count: 0,
      created_at: timestamps.invitedAt,
      updated_at: timestamps.updatedAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String((invitation as { id: string }).id);
}

export async function sendStaffLoginInvite(input: {
  tenantId: string;
  staffMemberId: string;
  invitedBy?: string | null;
  client?: SupabaseClient;
}): Promise<SendStaffLoginInviteResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date();

  await expireStaleLoginInvitations(tid, supabase);
  const { fiStaffId, email, fullName } = await assertEligibleForLoginInvite(tid, mid, supabase);
  const tenantName = await loadTenantDisplayName(tid, supabase);

  const origin = await getRequestOrigin();
  const {
    authUserId,
    inviteLink: authInviteLink,
    crossTenantWarning,
  } = await provisionStaffAuthInviteLink({
    tenantId: tid,
    email,
    origin,
    client: supabase,
  });

  const { fiUserId } = await repairStaffTenantLinkFromInvitation({
    tenantId: tid,
    staffMemberId: mid,
    inviteEmail: email,
    fiStaffId,
    authUserId,
    client: supabase,
  });

  const inviteToken = generateStaffAccessInviteToken();
  const inviteUrl = buildStaffAccessInviteUrl(tid, inviteToken);
  const invitationId = await upsertStaffLoginInvitation({
    tenantId: tid,
    staffMemberId: mid,
    fiStaffId,
    fiUserId,
    email,
    inviteToken,
    inviteUrl,
    authInviteLink,
    invitedBy: input.invitedBy?.trim() || null,
    isResend: false,
    client: supabase,
    now,
  });

  await createStaffAccessPinSetupToken({
    tenantId: tid,
    staffMemberId: mid,
    fiStaffId,
    loginInvitationId: invitationId,
    actorFiUserId: input.invitedBy ?? null,
    client: supabase,
  });

  const timestamps = nextResendInvitationTimestamps(now, STAFF_ACCESS_INVITE_EXPIRY_DAYS);
  const emailSent = await trySendStaffAccessInviteEmail({
    to: email,
    staffName: fullName,
    tenantName,
    inviteUrl,
    expiresAt: timestamps.expiresAt,
  });
  if (emailSent) {
    await supabase
      .from("fi_staff_login_invitations")
      .update({ email_sent_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("tenant_id", tid)
      .eq("id", invitationId);
  }

  await insertStaffAccessAuditEvent({
    tenantId: tid,
    staffMemberId: mid,
    eventType: STAFF_ACCESS_AUDIT_EVENTS.INVITE_SENT,
    actorFiUserId: input.invitedBy ?? null,
    metadata: { invitation_id: invitationId, email_sent: emailSent },
    client: supabase,
  });

  return { invitationId, inviteUrl, emailSent, crossTenantWarning };
}

export async function resendStaffLoginInvite(input: {
  tenantId: string;
  staffMemberId: string;
  invitedBy?: string | null;
  client?: SupabaseClient;
}): Promise<SendStaffLoginInviteResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date();

  await expireStaleLoginInvitations(tid, supabase);

  const { data: latestInvite, error: latestErr } = await supabase
    .from("fi_staff_login_invitations")
    .select("id, status, accepted_at, resend_count")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw new Error(latestErr.message);

  const latest = latestInvite as {
    id: string;
    status: string;
    accepted_at: string | null;
    resend_count: number | null;
  } | null;
  if (latest?.status === "accepted" || latest?.accepted_at) {
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.ACCEPTED_NO_RESEND);
  }

  const { fiStaffId, email, fullName } = await assertEligibleForLoginInvite(tid, mid, supabase);
  const tenantName = await loadTenantDisplayName(tid, supabase);
  const origin = await getRequestOrigin();
  const {
    authUserId,
    inviteLink: authInviteLink,
    crossTenantWarning,
  } = await provisionStaffAuthInviteLink({
    tenantId: tid,
    email,
    origin,
    client: supabase,
  });

  const { fiUserId } = await repairStaffTenantLinkFromInvitation({
    tenantId: tid,
    staffMemberId: mid,
    inviteEmail: email,
    fiStaffId,
    authUserId,
    client: supabase,
  });

  const inviteToken = generateStaffAccessInviteToken();
  const inviteUrl = buildStaffAccessInviteUrl(tid, inviteToken);
  const canReuseRow =
    latest && latest.status !== "accepted" && latest.status !== "revoked" && !latest.accepted_at;

  const invitationId = await upsertStaffLoginInvitation({
    tenantId: tid,
    staffMemberId: mid,
    fiStaffId,
    fiUserId,
    email,
    inviteToken,
    inviteUrl,
    authInviteLink,
    invitedBy: input.invitedBy?.trim() || null,
    isResend: Boolean(canReuseRow),
    existingInvitationId: canReuseRow ? latest!.id : null,
    existingResendCount: latest?.resend_count ?? 0,
    client: supabase,
    now,
  });

  await createStaffAccessPinSetupToken({
    tenantId: tid,
    staffMemberId: mid,
    fiStaffId,
    loginInvitationId: invitationId,
    actorFiUserId: input.invitedBy ?? null,
    client: supabase,
  });

  const timestamps = nextResendInvitationTimestamps(now, STAFF_ACCESS_INVITE_EXPIRY_DAYS);
  const emailSent = await trySendStaffAccessInviteEmail({
    to: email,
    staffName: fullName,
    tenantName,
    inviteUrl,
    expiresAt: timestamps.expiresAt,
  });
  if (emailSent) {
    await supabase
      .from("fi_staff_login_invitations")
      .update({ email_sent_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("tenant_id", tid)
      .eq("id", invitationId);
  }

  await insertStaffAccessAuditEvent({
    tenantId: tid,
    staffMemberId: mid,
    eventType: STAFF_ACCESS_AUDIT_EVENTS.INVITE_RESENT,
    actorFiUserId: input.invitedBy ?? null,
    metadata: {
      invitation_id: invitationId,
      email_sent: emailSent,
      resend_count: (latest?.resend_count ?? 0) + 1,
    },
    client: supabase,
  });

  return { invitationId, inviteUrl, emailSent, crossTenantWarning };
}

export async function copyStaffLoginInviteLink(input: {
  tenantId: string;
  staffMemberId: string;
  client?: SupabaseClient;
}): Promise<{ inviteUrl: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_login_invitations")
    .select("invite_link, status, expires_at, accepted_at")
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .in("status", ["pending", "sent", "expired"])
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No pending login invite found.");

  const row = data as {
    invite_link: string | null;
    expires_at: string;
    accepted_at: string | null;
  };
  if (row.accepted_at) throw new Error(STAFF_ACCESS_INVITE_ERRORS.ALREADY_ACCEPTED);
  const status = resolveInviteStatus({
    invitationStatus: "pending",
    expiresAt: row.expires_at,
  });
  if (status === "expired") throw new Error(STAFF_ACCESS_INVITE_ERRORS.EXPIRED);
  const inviteUrl = row.invite_link?.trim();
  if (!inviteUrl) throw new Error("Invite link is unavailable.");
  return { inviteUrl };
}

export async function revokeStaffLoginAccess(input: {
  tenantId: string;
  staffMemberId: string;
  actorFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const identity = assertUsableAccessIdentityTarget(
    await resolveStaffIdentity(
      { tenantId: tid, by: "staffMemberId", staffMemberId: mid },
      { client: supabase }
    )
  );

  const { data: member, error } = await supabase
    .from("fi_staff_members")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", mid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("Staff member not found.");

  const fiStaffId = identity.staffId;

  await supabase
    .from("fi_staff_members")
    .update({ system_access_revoked: true, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", mid);

  if (fiStaffId) {
    await updateFiStaff(tid, fiStaffId, { fi_user_id: null }, supabase);
    await supabase
      .from("fi_staff_access_grants")
      .update({ revoked_at: now, updated_at: now })
      .eq("tenant_id", tid)
      .eq("staff_member_id", fiStaffId)
      .is("revoked_at", null);
    await disableStaffPinForTenant({
      tenantId: tid,
      staffId: fiStaffId,
      actorFiUserId: input.actorFiUserId ?? null,
      client: supabase,
    });
  }

  await supabase
    .from("fi_staff_login_invitations")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_member_id", mid)
    .in("status", ["pending", "sent"]);
}

export async function suspendStaffLoginAccess(input: {
  tenantId: string;
  staffMemberId: string;
  actorFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const mid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const identity = assertUsableAccessIdentityTarget(
    await resolveStaffIdentity(
      { tenantId: tid, by: "staffMemberId", staffMemberId: mid },
      { client: supabase }
    )
  );

  const { data: member, error } = await supabase
    .from("fi_staff_members")
    .select("employment_status")
    .eq("tenant_id", tid)
    .eq("id", mid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("Staff member not found.");
  if (isDepartedForSuspend(String((member as { employment_status: string }).employment_status))) {
    throw new Error("Departed staff cannot be suspended.");
  }

  const fiStaffId = identity.staffId;

  await supabase
    .from("fi_staff_members")
    .update({
      system_access_revoked: true,
      employment_status: "suspended",
      employment_status_changed_at: now,
      employment_status_changed_by: input.actorFiUserId ?? null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", mid);

  if (fiStaffId) {
    await markSchedulingStaffSuspendedForAccess({
      tenantId: tid,
      fiStaffId,
      actorFiUserId: input.actorFiUserId ?? null,
      client: supabase,
      now,
    });
    await disableStaffPinForTenant({
      tenantId: tid,
      staffId: fiStaffId,
      actorFiUserId: input.actorFiUserId ?? null,
      client: supabase,
    });
  }
}

/** Test helper — insert invitation row without auth provisioning. */
export async function insertStaffLoginInvitationForTests(input: {
  tenantId: string;
  staffMemberId: string;
  invitedAt: string;
  client: SupabaseClient;
}): Promise<string> {
  const timestamps = nextResendInvitationTimestamps(new Date(input.invitedAt));
  const { data, error } = await input.client
    .from("fi_staff_login_invitations")
    .insert({
      tenant_id: input.tenantId,
      staff_member_id: input.staffMemberId,
      invite_email: "test@example.com",
      invite_link: `https://example.com/invite/${randomUUID()}`,
      status: "pending",
      invited_at: timestamps.invitedAt,
      expires_at: timestamps.expiresAt,
      created_at: timestamps.invitedAt,
      updated_at: timestamps.updatedAt,
    })
    .select("id, invited_at")
    .single();
  if (error) throw new Error(error.message);
  return String((data as { id: string; invited_at: string }).invited_at);
}

export { expireStaleLoginInvitations };
