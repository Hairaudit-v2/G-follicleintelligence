import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { STAFF_ROLE_KEYS, STAFF_ROLE_LABELS } from "@/src/lib/staffAccess/staffAccessRegistry";
import {
  applyStaffOnboardingEntryFlags,
  projectStaffOnboardingEntry,
  type StaffOnboardingAttentionReason,
} from "@/src/lib/team/onboarding";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";

import type {
  OnboardingChecklistState,
  OnboardingClinicOption,
  OnboardingInvitationStatus,
  OnboardingPageModel,
  OnboardingStaffRow,
} from "./onboardingTypes";
import {
  canCopyOnboardingInviteLink,
  canResendOnboardingInvite,
  canSendOnboardingInvite,
  mapOnboardingInviteDisplayStatus,
  onboardingInviteStatusLabel,
} from "./onboardingCentreCore";
import { tryBuildOnboardingInviteUrl } from "./onboardingInviteUrlCore";

/** Production fi_clinics columns used by Onboarding Centre (display_name only — no name column). */
export const ONBOARDING_FI_CLINICS_SELECT = "id, display_name";

export function mapOnboardingClinicOption(row: {
  id: string;
  display_name?: string | null;
}): OnboardingClinicOption {
  const label = String(row.display_name ?? "").trim() || "Clinic";
  return { id: String(row.id), name: label };
}

async function loadClinics(
  tenantId: string,
  client?: SupabaseClient
): Promise<OnboardingClinicOption[]> {
  const { data, error } = await (client ?? supabaseAdmin())
    .from("fi_clinics")
    .select(ONBOARDING_FI_CLINICS_SELECT)
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) =>
    mapOnboardingClinicOption(r as { id: string; display_name?: string | null })
  );
}

function buildRoleOptions(): { value: string; label: string }[] {
  return STAFF_ROLE_KEYS.map((key) => ({
    value: key,
    label: STAFF_ROLE_LABELS[key],
  }));
}

function mapChecklist(raw: Record<string, unknown> | null): OnboardingChecklistState {
  if (!raw) {
    return {
      accountCreated: false,
      pinChosen: false,
      permissionsAssigned: false,
      trainingPending: true,
    };
  }
  return {
    accountCreated: Boolean(raw.account_created),
    pinChosen: Boolean(raw.pin_chosen),
    permissionsAssigned: Boolean(raw.permissions_assigned),
    trainingPending: Boolean(raw.training_pending),
  };
}

export async function loadOnboardingPageModel(
  tenantId: string,
  client?: SupabaseClient
): Promise<OnboardingPageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [membersRes, clinics] = await Promise.all([
    supabase
      .from("fi_staff_members")
      .select(
        "id, full_name, email, role_code, clinic_id, employment_type, employment_status, fi_staff_id, created_at, system_access_revoked"
      )
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .is("merged_into", null)
      .in("employment_status", ["pending_onboarding", "inactive"])
      .order("created_at", { ascending: false }),
    loadClinics(tid, supabase),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);

  const memberRows = (membersRes.data ?? []) as Record<string, unknown>[];
  const memberIds = memberRows.map((m) => String(m.id));
  const clinicById = new Map(clinics.map((c) => [c.id, c.name]));

  /**
   * Fixed query budget for identity: batch resolve uses bounded `.in(...)` loads
   * (not one query per staff member). See resolveStaffIdentities.
   * Lifecycle-only identities are projected — never filtered out.
   */
  const identityBatch = await resolveStaffIdentities(
    {
      tenantId: tid,
      by: "staffMemberId",
      staffMemberIds: memberIds,
    },
    { client: supabase }
  );

  let invitations: Record<string, unknown>[] = [];
  let checklists: Record<string, unknown>[] = [];
  if (memberIds.length) {
    const [invRes, chkRes] = await Promise.all([
      supabase
        .from("fi_staff_onboarding_invitations")
        .select(
          "id, staff_member_id, status, invited_at, sent_at, resent_at, resend_count, expires_at, accepted_at, invite_token"
        )
        .eq("tenant_id", tid)
        .in("staff_member_id", memberIds)
        .order("invited_at", { ascending: false }),
      supabase
        .from("fi_staff_onboarding_checklists")
        .select("*")
        .eq("tenant_id", tid)
        .in("staff_member_id", memberIds),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    if (chkRes.error) throw new Error(chkRes.error.message);
    invitations = (invRes.data ?? []) as Record<string, unknown>[];
    checklists = (chkRes.data ?? []) as Record<string, unknown>[];
  }

  const latestInviteByMember = new Map<string, Record<string, unknown>>();
  for (const inv of invitations) {
    const mid = String(inv.staff_member_id);
    if (!latestInviteByMember.has(mid)) latestInviteByMember.set(mid, inv);
  }
  const checklistByMember = new Map(
    checklists.map((c) => [String(c.staff_member_id), c as Record<string, unknown>])
  );

  const staff: OnboardingStaffRow[] = memberRows.map((raw) => {
    const id = String(raw.id);
    const identity = identityBatch.byKey.get(id) ?? null;
    const clinicId = raw.clinic_id != null ? String(raw.clinic_id) : null;
    const inv = latestInviteByMember.get(id);
    const email = raw.email != null ? String(raw.email) : identity?.email ?? null;
    const employmentStatus = String(raw.employment_status ?? "pending_onboarding");
    const systemAccessRevoked = Boolean(raw.system_access_revoked);
    const checklist = mapChecklist(checklistByMember.get(id) ?? null);

    const inviteStatus = mapOnboardingInviteDisplayStatus({
      rawStatus: inv ? String(inv.status) : null,
      expiresAt: inv ? String(inv.expires_at) : null,
      acceptedAt: inv?.accepted_at != null ? String(inv.accepted_at) : null,
    });

    const inviteToken = inv?.invite_token != null ? String(inv.invite_token).trim() : "";
    const inviteUrl =
      inviteToken && (inviteStatus === "pending" || inviteStatus === "expired")
        ? tryBuildOnboardingInviteUrl(tid, inviteToken)
        : null;

    const actionInput = {
      email,
      systemAccessRevoked,
      employmentStatus,
      inviteStatus,
    };

    const domainCanSend = canSendOnboardingInvite(actionInput);
    const domainCanResend = canResendOnboardingInvite(actionInput);
    const domainCanCopy = canCopyOnboardingInviteLink({
      inviteStatus,
      hasInviteUrl: Boolean(inviteUrl),
    });

    const onboardingFacts = {
      onboardingInviteId: inv ? String(inv.id) : null,
      onboardingInviteStatus: inviteStatus,
      onboardingInviteExpiresAt: inv ? String(inv.expires_at) : null,
      checklist,
      systemAccessRevoked,
      canSendInvite: domainCanSend,
      canResendInvite: domainCanResend,
      canCopyInviteLink: domainCanCopy,
      canCancelOnboarding: false,
    };

    const onboardingEntry = identity
      ? projectStaffOnboardingEntry(identity, onboardingFacts)
      : null;
    const identityFlags = onboardingEntry
      ? applyStaffOnboardingEntryFlags(onboardingEntry)
      : {
          canSendInvite: domainCanSend,
          canResendInvite: domainCanResend,
          canCopyInviteLink: domainCanCopy,
          attentionReasons: ["identity_invalid"] as StaffOnboardingAttentionReason[],
        };

    const fiStaffId =
      identity?.staffId ?? (raw.fi_staff_id != null ? String(raw.fi_staff_id) : null);

    return {
      id,
      fullName: String(raw.full_name ?? identity?.displayName ?? "Staff"),
      email,
      roleCode: raw.role_code != null ? String(raw.role_code) : null,
      clinicId,
      clinicName: clinicId ? (clinicById.get(clinicId) ?? null) : null,
      employmentType: raw.employment_type != null ? String(raw.employment_type) : null,
      employmentStatus,
      systemAccessRevoked,
      fiStaffId,
      createdAt: String(raw.created_at),
      invitation: inv
        ? {
            id: String(inv.id),
            status: String(inv.status).trim().toLowerCase() as OnboardingInvitationStatus,
            invitedAt: String(inv.invited_at),
            sentAt: inv.sent_at != null ? String(inv.sent_at) : null,
            resentAt: inv.resent_at != null ? String(inv.resent_at) : null,
            resendCount: Number(inv.resend_count ?? 0),
            expiresAt: String(inv.expires_at),
            acceptedAt: inv.accepted_at != null ? String(inv.accepted_at) : null,
            inviteUrl,
          }
        : null,
      inviteStatus,
      inviteLabel: onboardingInviteStatusLabel(inviteStatus),
      canSendInvite: identityFlags.canSendInvite,
      canResendInvite: identityFlags.canResendInvite,
      canCopyInviteLink: identityFlags.canCopyInviteLink,
      checklist,
      attentionReasons: identityFlags.attentionReasons,
    };
  });

  return { staff, clinics, roleOptions: buildRoleOptions() };
}

export async function expireStaleOnboardingInvitations(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();
  await supabase
    .from("fi_staff_onboarding_invitations")
    .update({ status: "expired", updated_at: now })
    .eq("tenant_id", tid)
    .in("status", ["pending", "sent"])
    .lt("expires_at", now);
}

export function newOnboardingToken(): string {
  return randomUUID();
}