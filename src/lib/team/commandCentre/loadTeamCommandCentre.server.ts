/**
 * Team Command Centre batch loader (FI-TEAM-COHESION-B1.7).
 *
 * Query budget (tenant-wide, no N+1):
 * 1. one workforce subject load (lifecycle member ids + scheduling staff ids)
 * 2. one identity batch (member ids) + optional supplemental staffId batch for orphans
 * 3. one access batch (shared identity map via preresolvedIdentitiesByMemberId)
 * 4. one onboarding invite+checklist batch
 * 5. one credentials batch
 * 6. in-memory roster projections (no per-person profile-loader loop)
 *
 * Partial identities are retained for operational queues; cross-tenant are excluded
 * from normal workforce totals and surfaced as integrity attention.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { projectStaffAccessEntry } from "@/src/lib/team/access";
import { projectStaffComplianceEntry } from "@/src/lib/team/compliance";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { projectStaffOnboardingEntry } from "@/src/lib/team/onboarding";
import { projectRosterStaffEntry } from "@/src/lib/team/roster";
import { buildCommandCentreDomainHrefs } from "@/src/lib/team/commandCentre/commandCentreHrefs";
import { composeAttentionQueue } from "@/src/lib/team/commandCentre/composeAttentionQueue";
import { composeCommandCentreKpis } from "@/src/lib/team/commandCentre/composeCommandCentreKpis";
import {
  dedupeIdentitiesByPersonKey,
  projectCommandCentreStaffSummary,
} from "@/src/lib/team/commandCentre/projectWorkforceSummary";
import type { TeamCommandCentreModel } from "@/src/lib/team/commandCentre/types";
import {
  canCopyOnboardingInviteLink,
  canResendOnboardingInvite,
  canSendOnboardingInvite,
  mapOnboardingInviteDisplayStatus,
} from "@/src/lib/workforce/onboarding/onboardingCentreCore";
import {
  loadStaffAccessCentrePage,
  type StaffAccessCentreRow,
} from "@/src/lib/team/access/server";
import { loadStaffCredentialsForMembers } from "@/src/lib/workforce/staffCredentials.server";

export type LoadTeamCommandCentreOptions = {
  client?: SupabaseClient;
  /** Soft-fail individual domain batches (default true for page resilience). */
  softFailDomains?: boolean;
};

type SubjectSet = {
  memberIds: string[];
  staffIds: string[];
};

/**
 * Subject set uses single-table helpers — never a dual-table join in this file.
 * Lifecycle ids: members table. Scheduling ids: staff.server loadAllStaffForTenant.
 */
async function loadCommandCentreSubjectSet(
  tenantId: string,
  client: SupabaseClient
): Promise<SubjectSet> {
  const [membersRes, schedulingRows] = await Promise.all([
    client
      .from("fi_staff_members")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("merged_into", null),
    loadAllStaffForTenant(tenantId, client),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);

  return {
    memberIds: ((membersRes.data ?? []) as { id: string }[]).map((r) => String(r.id)),
    staffIds: schedulingRows.map((r) => String(r.id)),
  };
}

/**
 * Batch-resolve the Command Centre population. Member batch first; scheduling-only
 * orphans get a supplemental staffId batch. Results are deduped by personKey.
 */
async function batchResolveCommandCentreIdentities(
  tenantId: string,
  subjects: SubjectSet,
  client: SupabaseClient
): Promise<StaffIdentity[]> {
  const memberBatch =
    subjects.memberIds.length > 0
      ? await resolveStaffIdentities(
          {
            tenantId,
            by: "staffMemberId",
            staffMemberIds: subjects.memberIds,
          },
          { client }
        )
      : { byKey: new Map<string, StaffIdentity | null>(), identities: [] as StaffIdentity[] };

  const coveredStaffIds = new Set(
    [...memberBatch.byKey.values()]
      .map((id) => id?.staffId?.trim() || null)
      .filter(Boolean) as string[]
  );

  const orphanStaffIds = subjects.staffIds.filter((id) => !coveredStaffIds.has(id));

  const staffBatch =
    orphanStaffIds.length > 0
      ? await resolveStaffIdentities(
          {
            tenantId,
            by: "staffId",
            staffIds: orphanStaffIds,
          },
          { client }
        )
      : { identities: [] as StaffIdentity[] };

  const merged = [
    ...[...memberBatch.byKey.values()].filter((id): id is StaffIdentity => id != null),
    ...staffBatch.identities,
  ];

  return dedupeIdentitiesByPersonKey(merged);
}

function accessEntryFromCentreRow(
  identity: StaffIdentity,
  row: StaffAccessCentreRow
) {
  return projectStaffAccessEntry(identity, {
    authLoginStatus: row.authLoginStatus,
    inviteStatus: row.inviteStatus,
    loginInviteId: null,
    loginInviteExpiresAt: row.inviteExpiresAt,
    canSendInvite: row.canSendInvite,
    canResendInvite: row.canResendInvite,
    canSuspendAccess: row.canSuspendAccess,
    canRevokeAccess: row.canRevokeAccess,
  });
}

async function loadOnboardingEntriesByMemberId(
  tenantId: string,
  identities: readonly StaffIdentity[],
  client: SupabaseClient
): Promise<Map<string, ReturnType<typeof projectStaffOnboardingEntry>>> {
  const memberIds = [
    ...new Set(
      identities
        .map((id) => id.staffMemberId?.trim() || null)
        .filter(Boolean) as string[]
    ),
  ];
  const out = new Map<string, ReturnType<typeof projectStaffOnboardingEntry>>();
  if (!memberIds.length) return out;

  const [invRes, chkRes, memberMetaRes] = await Promise.all([
    client
      .from("fi_staff_onboarding_invitations")
      .select(
        "id, staff_member_id, status, expires_at, accepted_at, invite_token"
      )
      .eq("tenant_id", tenantId)
      .in("staff_member_id", memberIds)
      .order("invited_at", { ascending: false }),
    client
      .from("fi_staff_onboarding_checklists")
      .select(
        "staff_member_id, account_created, pin_chosen, permissions_assigned, training_pending"
      )
      .eq("tenant_id", tenantId)
      .in("staff_member_id", memberIds),
    client
      .from("fi_staff_members")
      .select("id, system_access_revoked, employment_status, email")
      .eq("tenant_id", tenantId)
      .in("id", memberIds),
  ]);
  if (invRes.error) throw new Error(invRes.error.message);
  if (chkRes.error) throw new Error(chkRes.error.message);
  if (memberMetaRes.error) throw new Error(memberMetaRes.error.message);

  const latestInviteByMember = new Map<string, Record<string, unknown>>();
  for (const inv of (invRes.data ?? []) as Record<string, unknown>[]) {
    const mid = String(inv.staff_member_id);
    if (!latestInviteByMember.has(mid)) latestInviteByMember.set(mid, inv);
  }
  const checklistByMember = new Map(
    ((chkRes.data ?? []) as Record<string, unknown>[]).map((c) => [
      String(c.staff_member_id),
      c,
    ])
  );
  const metaByMember = new Map(
    ((memberMetaRes.data ?? []) as Record<string, unknown>[]).map((m) => [
      String(m.id),
      m,
    ])
  );

  const identityByMember = new Map(
    identities
      .filter((id) => id.staffMemberId)
      .map((id) => [id.staffMemberId as string, id])
  );

  for (const mid of memberIds) {
    const identity = identityByMember.get(mid);
    if (!identity) continue;

    const meta = metaByMember.get(mid);
    const inv = latestInviteByMember.get(mid);
    const rawChecklist = checklistByMember.get(mid) ?? null;
    const systemAccessRevoked = Boolean(meta?.system_access_revoked);
    const employmentStatus = String(meta?.employment_status ?? identity.employmentStatus);
    const email =
      meta?.email != null ? String(meta.email) : identity.email;

    const inviteStatus = mapOnboardingInviteDisplayStatus({
      rawStatus: inv ? String(inv.status) : null,
      expiresAt: inv ? String(inv.expires_at) : null,
      acceptedAt: inv?.accepted_at != null ? String(inv.accepted_at) : null,
    });

    const inviteToken = inv?.invite_token != null ? String(inv.invite_token).trim() : "";
    const hasInviteUrl =
      Boolean(inviteToken) && (inviteStatus === "pending" || inviteStatus === "expired");

    const actionInput = {
      email,
      systemAccessRevoked,
      employmentStatus,
      inviteStatus,
    };

    out.set(
      mid,
      projectStaffOnboardingEntry(identity, {
        onboardingInviteId: inv ? String(inv.id) : null,
        onboardingInviteStatus: inviteStatus,
        onboardingInviteExpiresAt: inv ? String(inv.expires_at) : null,
        checklist: {
          accountCreated: Boolean(rawChecklist?.account_created),
          pinChosen: Boolean(rawChecklist?.pin_chosen),
          permissionsAssigned: Boolean(rawChecklist?.permissions_assigned),
          trainingPending: rawChecklist ? Boolean(rawChecklist.training_pending) : true,
        },
        systemAccessRevoked,
        canSendInvite: canSendOnboardingInvite(actionInput),
        canResendInvite: canResendOnboardingInvite(actionInput),
        canCopyInviteLink: canCopyOnboardingInviteLink({
          inviteStatus,
          hasInviteUrl,
        }),
        canCancelOnboarding: false,
      })
    );
  }

  return out;
}

export async function loadTeamCommandCentre(
  tenantId: string,
  options?: LoadTeamCommandCentreOptions
): Promise<TeamCommandCentreModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const client = options?.client ?? supabaseAdmin();
  const softFail = options?.softFailDomains !== false;
  const hrefs = buildCommandCentreDomainHrefs(tid);

  const subjects = await loadCommandCentreSubjectSet(tid, client);
  const identities = await batchResolveCommandCentreIdentities(tid, subjects, client);

  const identitiesByMemberId = new Map<string, StaffIdentity | null>();
  const identitiesByPersonKey = new Map<string, StaffIdentity>();
  for (const identity of identities) {
    identitiesByPersonKey.set(identity.personKey, identity);
    if (identity.staffMemberId) {
      identitiesByMemberId.set(identity.staffMemberId, identity);
    }
  }

  const memberIdsForDomains = [...identitiesByMemberId.keys()];

  const emptyAccess = { tenantId: tid, rows: [] as StaffAccessCentreRow[] };
  const [accessPage, onboardingByMember, credentialsByMember] = await Promise.all([
    softFail
      ? loadStaffAccessCentrePage(tid, {
          preresolvedIdentitiesByMemberId: identitiesByMemberId,
          supabaseClientForTests: client,
        }).catch(() => emptyAccess)
      : loadStaffAccessCentrePage(tid, {
          preresolvedIdentitiesByMemberId: identitiesByMemberId,
          supabaseClientForTests: client,
        }),
    softFail
      ? loadOnboardingEntriesByMemberId(tid, identities, client).catch(
          () => new Map<string, ReturnType<typeof projectStaffOnboardingEntry>>()
        )
      : loadOnboardingEntriesByMemberId(tid, identities, client),
    softFail
      ? loadStaffCredentialsForMembers(tid, memberIdsForDomains, client).catch(
          () => new Map()
        )
      : loadStaffCredentialsForMembers(tid, memberIdsForDomains, client),
  ]);

  const accessByMemberId = new Map(
    accessPage.rows.map((row) => [row.staffMemberId, row])
  );

  const staff = identities.map((identity) => {
    const mid = identity.staffMemberId;
    const accessRow = mid ? accessByMemberId.get(mid) ?? null : null;
    const access =
      mid && accessRow && identity.staffMemberId
        ? accessEntryFromCentreRow(identity, accessRow)
        : identity.staffMemberId
          ? projectStaffAccessEntry(identity, {
              authLoginStatus:
                identity.accessStatus === "login_active"
                  ? "login_active"
                  : identity.accessStatus === "invite_pending"
                    ? "invite_pending"
                    : identity.accessStatus === "suspended"
                      ? "suspended"
                      : identity.accessStatus === "revoked"
                        ? "revoked"
                        : "no_login",
              inviteStatus: "none",
              loginInviteId: null,
              loginInviteExpiresAt: null,
              canSendInvite: false,
              canResendInvite: false,
              canSuspendAccess: false,
              canRevokeAccess: false,
            })
          : null;

    const onboarding = mid ? onboardingByMember.get(mid) ?? null : null;

    // Scheduling-only → no invented onboarding/compliance subject.
    const compliance =
      mid != null
        ? projectStaffComplianceEntry(identity, {
            credentials: credentialsByMember.get(mid) ?? [],
            certifications: [],
            canUpload: false,
            canVerify: false,
            canReject: false,
            canRequestReplacement: false,
          })
        : null;

    // Lifecycle-only → no invented roster entry (projectRosterStaffEntry returns null).
    const roster = projectRosterStaffEntry(identity, {
      domainEligible:
        identity.readinessStatus === "ready" &&
        identity.integrity.linkStatus === "linked",
      schedulingActive: Boolean(identity.staffId),
    });

    return projectCommandCentreStaffSummary({
      identity,
      access,
      onboarding,
      roster,
      compliance,
      hrefs,
    });
  });

  return {
    tenantId: tid,
    staff,
    attentionQueue: composeAttentionQueue({
      staff,
      identitiesByPersonKey,
    }),
    kpis: composeCommandCentreKpis(staff),
  };
}
