import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  hashStaffAccessInviteToken,
  STAFF_ACCESS_INVITE_ERRORS,
} from "./staffAccessInviteCore";
import {
  insertStaffAccessAuditEvent,
  STAFF_ACCESS_AUDIT_EVENTS,
} from "./staffAccessInviteAudit.server";
import { resolveInviteStatus } from "./staffAccessCentreCore";
import {
  assessStaffTenantLinkIntegrity,
  resolveStaffAccessAcceptAuditKind,
  type StaffTenantLinkSnapshot,
} from "./staffAccessAcceptCore";
import { repairStaffTenantLinkFromInvitation } from "./staffTenantLinkRepair.server";

export type StaffAccessAcceptPageModel = {
  tenantId: string;
  tenantName: string;
  staffMemberId: string;
  staffName: string;
  email: string;
  roleCode: string | null;
  invitationStatus: "pending" | "sent" | "accepted" | "expired" | "revoked";
  pinSetupToken: string | null;
  authInviteLink: string | null;
  expiresAt: string;
};

async function loadTenantName(tenantId: string, client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("fi_tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String((data as { name: string } | null)?.name ?? "Your clinic").trim() || "Your clinic";
}

async function loadInvitationByTokenHash(
  tenantId: string,
  token: string,
  client: SupabaseClient
): Promise<{
  id: string;
  staffMemberId: string;
  fiStaffId: string | null;
  inviteEmail: string;
  status: string;
  expiresAt: string;
  authInviteLink: string | null;
  acceptedAt: string | null;
} | null> {
  const tokenHash = hashStaffAccessInviteToken(token);
  const { data, error } = await client
    .from("fi_staff_login_invitations")
    .select(
      "id, staff_member_id, fi_staff_id, invite_email, status, expires_at, auth_invite_link, accepted_at, invite_token_hash, invite_link"
    )
    .eq("tenant_id", tenantId)
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const row = data as {
      id: string;
      staff_member_id: string;
      fi_staff_id: string | null;
      invite_email: string;
      status: string;
      expires_at: string;
      auth_invite_link: string | null;
      accepted_at: string | null;
    };
    return {
      id: String(row.id),
      staffMemberId: String(row.staff_member_id),
      fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
      inviteEmail: String(row.invite_email),
      status: String(row.status),
      expiresAt: String(row.expires_at),
      authInviteLink: row.auth_invite_link?.trim() || null,
      acceptedAt: row.accepted_at,
    };
  }

  // Legacy invites stored only Supabase link in invite_link — match raw token in URL path not possible.
  // Fall back: treat token as legacy if it matches a pending row without hash (pre-migration).
  return null;
}

export async function loadStaffAccessInviteByToken(
  tenantId: string,
  token: string,
  pinSetupToken?: string | null
): Promise<StaffAccessAcceptPageModel | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const rawToken = token.trim();
  if (!rawToken) return null;

  const supabase = supabaseAdmin();
  const invitation = await loadInvitationByTokenHash(tid, rawToken, supabase);
  if (!invitation) return null;

  const resolvedStatus = resolveInviteStatus({
    invitationStatus: invitation.status,
    expiresAt: invitation.expiresAt,
  });

  const { data: member, error: memberErr } = await supabase
    .from("fi_staff_members")
    .select("full_name, role_code, system_access_revoked, employment_status")
    .eq("tenant_id", tid)
    .eq("id", invitation.staffMemberId)
    .maybeSingle();
  if (memberErr) throw new Error(memberErr.message);
  if (!member) return null;

  const memberRow = member as {
    full_name: string;
    role_code: string | null;
    system_access_revoked: boolean | null;
    employment_status: string;
  };

  if (Boolean(memberRow.system_access_revoked)) {
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.SUSPENDED);
  }
  if (String(memberRow.employment_status).trim().toLowerCase() === "suspended") {
    throw new Error(STAFF_ACCESS_INVITE_ERRORS.SUSPENDED);
  }

  let effectivePinSetupToken = pinSetupToken?.trim() || null;
  if (
    !effectivePinSetupToken &&
    invitation.fiStaffId &&
    resolvedStatus !== "expired" &&
    resolvedStatus !== "revoked" &&
    resolvedStatus !== "accepted"
  ) {
    const { createStaffAccessPinSetupToken } = await import("./staffAccessPinLayer.server");
    const created = await createStaffAccessPinSetupToken({
      tenantId: tid,
      staffMemberId: invitation.staffMemberId,
      fiStaffId: invitation.fiStaffId,
      loginInvitationId: invitation.id,
      client: supabase,
    });
    effectivePinSetupToken = created.setupToken;
  }

  const tenantName = await loadTenantName(tid, supabase);

  return {
    tenantId: tid,
    tenantName,
    staffMemberId: invitation.staffMemberId,
    staffName: String(memberRow.full_name ?? "Staff"),
    email: invitation.inviteEmail,
    roleCode: memberRow.role_code,
    invitationStatus:
      resolvedStatus === "none"
        ? "pending"
        : (resolvedStatus as StaffAccessAcceptPageModel["invitationStatus"]),
    pinSetupToken: effectivePinSetupToken,
    authInviteLink: invitation.authInviteLink,
    expiresAt: invitation.expiresAt,
  };
}

async function loadStaffTenantLinkSnapshot(
  tenantId: string,
  staffMemberId: string,
  invitation: {
    fiStaffId: string | null;
    fiUserId?: string | null;
  },
  client: SupabaseClient
): Promise<StaffTenantLinkSnapshot> {
  const { data: member, error: memberErr } = await client
    .from("fi_staff_members")
    .select("fi_staff_id")
    .eq("tenant_id", tenantId)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (memberErr) throw new Error(memberErr.message);

  const memberFiStaffId =
    (member as { fi_staff_id: string | null } | null)?.fi_staff_id != null
      ? String((member as { fi_staff_id: string }).fi_staff_id)
      : null;
  const fiStaffId = invitation.fiStaffId?.trim() || memberFiStaffId;

  let fiStaffFiUserId: string | null = null;
  if (fiStaffId) {
    const { data: staff, error: staffErr } = await client
      .from("fi_staff")
      .select("fi_user_id")
      .eq("tenant_id", tenantId)
      .eq("id", fiStaffId)
      .maybeSingle();
    if (staffErr) throw new Error(staffErr.message);
    fiStaffFiUserId =
      (staff as { fi_user_id: string | null } | null)?.fi_user_id != null
        ? String((staff as { fi_user_id: string }).fi_user_id)
        : null;
  }

  return {
    staffMemberFiStaffId: memberFiStaffId,
    fiStaffFiUserId,
    invitationFiStaffId: invitation.fiStaffId,
    invitationFiUserId: invitation.fiUserId ?? null,
  };
}

async function loadInvitationLinkIds(
  tenantId: string,
  invitationId: string,
  client: SupabaseClient
): Promise<{ fiStaffId: string | null; fiUserId: string | null }> {
  const { data, error } = await client
    .from("fi_staff_login_invitations")
    .select("fi_staff_id, fi_user_id")
    .eq("tenant_id", tenantId)
    .eq("id", invitationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { fiStaffId: null, fiUserId: null };
  const row = data as { fi_staff_id: string | null; fi_user_id: string | null };
  return {
    fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
    fiUserId: row.fi_user_id != null ? String(row.fi_user_id) : null,
  };
}

export async function acceptStaffAccessInvitation(input: {
  tenantId: string;
  inviteToken: string;
  pinSetupToken?: string | null;
  client?: SupabaseClient;
}): Promise<{ staffMemberId: string; authInviteLink: string | null; pinSetupToken: string | null }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const invitation = await loadInvitationByTokenHash(tid, input.inviteToken, supabase);
  if (!invitation) throw new Error(STAFF_ACCESS_INVITE_ERRORS.NOT_ACTIVE);

  const status = resolveInviteStatus({
    invitationStatus: invitation.status,
    expiresAt: invitation.expiresAt,
  });
  if (status === "expired") throw new Error(STAFF_ACCESS_INVITE_ERRORS.EXPIRED);
  if (status === "revoked") throw new Error(STAFF_ACCESS_INVITE_ERRORS.NOT_ACTIVE);

  const alreadyAccepted = status === "accepted" || Boolean(invitation.acceptedAt);
  const invitationLinks = await loadInvitationLinkIds(tid, invitation.id, supabase);
  const linkageBefore = await loadStaffTenantLinkSnapshot(
    tid,
    invitation.staffMemberId,
    {
      fiStaffId: invitation.fiStaffId ?? invitationLinks.fiStaffId,
      fiUserId: invitationLinks.fiUserId,
    },
    supabase
  );
  const integrityBefore = assessStaffTenantLinkIntegrity(linkageBefore);

  if (alreadyAccepted && integrityBefore.valid) {
    return {
      staffMemberId: invitation.staffMemberId,
      authInviteLink: invitation.authInviteLink,
      pinSetupToken: input.pinSetupToken?.trim() || null,
    };
  }

  await repairStaffTenantLinkFromInvitation({
    tenantId: tid,
    staffMemberId: invitation.staffMemberId,
    inviteEmail: invitation.inviteEmail,
    invitationId: invitation.id,
    fiStaffId: invitation.fiStaffId ?? invitationLinks.fiStaffId,
    client: supabase,
  });

  if (!alreadyAccepted) {
    const { error: updateError } = await supabase
      .from("fi_staff_login_invitations")
      .update({
        status: "accepted",
        accepted_at: now,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", invitation.id);
    if (updateError) throw new Error(updateError.message);
  }

  const auditKind = resolveStaffAccessAcceptAuditKind({
    alreadyAccepted,
    linkageValidBeforeRepair: integrityBefore.valid,
    repaired: !integrityBefore.valid,
  });

  if (auditKind === "newly_accepted") {
    await insertStaffAccessAuditEvent({
      tenantId: tid,
      staffMemberId: invitation.staffMemberId,
      eventType: STAFF_ACCESS_AUDIT_EVENTS.INVITE_ACCEPTED,
      metadata: { invitation_id: invitation.id, acceptance_kind: auditKind },
      client: supabase,
    });
  } else if (auditKind === "repaired_after_accepted") {
    await insertStaffAccessAuditEvent({
      tenantId: tid,
      staffMemberId: invitation.staffMemberId,
      eventType: STAFF_ACCESS_AUDIT_EVENTS.INVITE_LINK_REPAIRED,
      metadata: {
        invitation_id: invitation.id,
        acceptance_kind: auditKind,
        linkage_was_valid: integrityBefore.valid,
      },
      client: supabase,
    });
  }

  return {
    staffMemberId: invitation.staffMemberId,
    authInviteLink: invitation.authInviteLink,
    pinSetupToken: input.pinSetupToken?.trim() || null,
  };
}

export { buildStaffAccessPinSetupUrl } from "./staffAccessInviteCore";
