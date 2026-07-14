import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { parseWorkspaceProfileFromPositionOrTemplate } from "@/src/lib/fi-os/organisationalProfile.server";
import {
  parseExplicitWorkspaceProfile,
  resolveWorkspaceProfileKeyFromSignals,
} from "@/src/lib/fi-os/workspaceProfileDerivation";
import { loadStaffPinMetadataForStaff } from "@/src/lib/staffPin/staffPin.server";
import {
  isArchivedStaff,
  isDepartedStaff,
  resolveAuthLoginStatus,
  resolveInviteStatus,
  type StaffAuthLoginStatus,
} from "@/src/lib/workforce/staffAccessCentreCore";
import { SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES } from "@/src/lib/workforce-os/staffLifecycleTypes";

export type StaffIdentityReadinessAuditRow = {
  staffMemberId: string;
  displayLabel: string;
  email?: string;
  employmentStatus: string;
  roleCode?: string;
  loginStatus:
    | "ready"
    | "missing_user"
    | "missing_auth"
    | "invited"
    | "suspended"
    | "not_required"
    | "unknown";
  workspaceProfileStatus: "ready" | "missing" | "ambiguous" | "unknown";
  pinStatus: "ready" | "missing" | "not_required" | "unknown";
  onboardingStatus: "ready" | "pending" | "blocked" | "unknown";
  issues: string[];
  recommendedAction: string;
};

export type StaffIdentityReadinessAuditSummary = {
  readyCount: number;
  missingLoginLinkCount: number;
  pendingInviteCount: number;
  missingWorkspaceProfileCount: number;
  pinMissingCount: number;
  suspendedRevokedCount: number;
  testingReadiness: StaffTestingReadinessSummary;
};

export type StaffTestingReadinessSummary = "ready" | "watch" | "blocked";

export type StaffIdentityReadinessAuditResult = {
  tenantId: string;
  rows: StaffIdentityReadinessAuditRow[];
  summary: StaffIdentityReadinessAuditSummary;
};

type AuthUserSnapshot = {
  exists: boolean;
  emailConfirmed: boolean;
  hasSignedIn: boolean;
};

type MemberSourceRow = {
  id: string;
  full_name: string;
  email: string | null;
  role_code: string | null;
  employment_status: string;
  fi_staff_id: string | null;
  archived_at: string | null;
  system_access_revoked: boolean | null;
};

type FiStaffSourceRow = {
  id: string;
  fi_user_id: string | null;
  email: string | null;
  staff_role: string | null;
  staff_metadata: Record<string, unknown> | null;
  position_type_id: string | null;
  is_active: boolean;
};

function isAuditableStaffMember(row: MemberSourceRow): boolean {
  if (isArchivedStaff(row.archived_at)) return false;
  const status = String(row.employment_status ?? "")
    .trim()
    .toLowerCase();
  if (status === "merged") return false;
  if (isDepartedStaff(status)) return false;
  return true;
}

function loginExpectedForStaff(row: MemberSourceRow): boolean {
  if (isArchivedStaff(row.archived_at)) return false;
  if (isDepartedStaff(row.employment_status)) return false;
  if (Boolean(row.system_access_revoked)) return false;
  const status = String(row.employment_status ?? "")
    .trim()
    .toLowerCase();
  if (SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES.has(status as never)) return false;
  return status === "active" || status === "pending_onboarding";
}

function mapAuthLoginToAuditStatus(
  authStatus: StaffAuthLoginStatus,
  loginExpected: boolean,
  member: MemberSourceRow
): StaffIdentityReadinessAuditRow["loginStatus"] {
  const employment = String(member.employment_status ?? "")
    .trim()
    .toLowerCase();
  if (employment === "suspended" || Boolean(member.system_access_revoked)) return "suspended";
  if (authStatus === "suspended" || authStatus === "revoked") return "suspended";
  if (!loginExpected) return "not_required";
  if (authStatus === "login_active") return "ready";
  if (authStatus === "invite_pending") return "invited";
  if (authStatus === "no_login") return "missing_user";
  return "unknown";
}

function pinRequiredForStaff(input: {
  loginExpected: boolean;
  roleCode: string | null;
  fiStaff: FiStaffSourceRow | null;
}): boolean {
  if (!input.loginExpected || !input.fiStaff) return false;
  const role = String(input.roleCode ?? input.fiStaff.staff_role ?? "")
    .trim()
    .toLowerCase();
  if (!role) return false;
  return (
    role.includes("reception") ||
    role.includes("nurse") ||
    role.includes("consultant") ||
    role.includes("doctor") ||
    role.includes("clinical")
  );
}

function evaluateWorkspaceProfileStatus(input: {
  fiStaff: FiStaffSourceRow | null;
  positionDefaultProfile: string | null;
  templateDefaultProfile: string | null;
  loginExpected: boolean;
}): StaffIdentityReadinessAuditRow["workspaceProfileStatus"] {
  if (!input.loginExpected) return "unknown";
  if (!input.fiStaff) return "missing";

  const explicitRaw = input.fiStaff.staff_metadata?.workspace_profile;
  const explicit = parseExplicitWorkspaceProfile(explicitRaw);
  const invalidExplicit =
    typeof explicitRaw === "string" &&
    explicitRaw.trim() !== "" &&
    explicitRaw.trim().toLowerCase() !== "default" &&
    !explicit;

  const resolved = resolveWorkspaceProfileKeyFromSignals({
    explicitWorkspaceProfile: explicitRaw,
    positionTypeDefaultWorkspaceProfile: input.positionDefaultProfile,
    featureTemplateWorkspaceProfile: input.templateDefaultProfile,
    staffRole: input.fiStaff.staff_role,
  });

  if (invalidExplicit && resolved !== "default") return "ambiguous";
  if (invalidExplicit) return "ambiguous";
  if (resolved !== "default") return "ready";

  const hasPositionSignal =
    parseWorkspaceProfileFromPositionOrTemplate(input.positionDefaultProfile) != null ||
    parseWorkspaceProfileFromPositionOrTemplate(input.templateDefaultProfile) != null;
  if (hasPositionSignal) return "ready";

  const role = String(input.fiStaff.staff_role ?? "").trim();
  if (role) return "ready";

  return "missing";
}

function evaluatePinStatus(input: {
  pinRawStatus: string | null | undefined;
  pinRequired: boolean;
}): StaffIdentityReadinessAuditRow["pinStatus"] {
  if (!input.pinRequired) return "not_required";
  const status = String(input.pinRawStatus ?? "not_set")
    .trim()
    .toLowerCase();
  if (status === "active" || status === "locked") return "ready";
  if (status === "not_set" || status === "disabled") return "missing";
  return "unknown";
}

function evaluateOnboardingStatus(input: {
  employmentStatus: string;
  loginStatus: StaffIdentityReadinessAuditRow["loginStatus"];
  inviteStatus: ReturnType<typeof resolveInviteStatus>;
  checklistPending: boolean;
  loginExpected: boolean;
  systemAccessRevoked: boolean;
}): StaffIdentityReadinessAuditRow["onboardingStatus"] {
  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();

  if (employment === "suspended" || input.systemAccessRevoked) return "blocked";

  if (input.loginExpected && input.loginStatus === "ready" && employment === "pending_onboarding") {
    return "blocked";
  }

  if (employment === "pending_onboarding") return "pending";
  if (input.inviteStatus === "pending") return "pending";
  if (input.checklistPending) return "pending";

  if (
    input.loginExpected &&
    (input.loginStatus === "missing_user" ||
      input.loginStatus === "missing_auth" ||
      input.loginStatus === "suspended")
  ) {
    return "blocked";
  }

  if (input.loginExpected && input.loginStatus === "ready") return "ready";
  if (!input.loginExpected) return "ready";
  return "unknown";
}

function buildRecommendedAction(row: StaffIdentityReadinessAuditRow): string {
  if (row.loginStatus === "missing_user" || row.loginStatus === "missing_auth") {
    return "Send login invite and link fi_user from Staff Access Centre.";
  }
  if (row.loginStatus === "invited") {
    return "Follow up on pending login invite or resend invitation.";
  }
  if (row.loginStatus === "suspended") {
    return "Review employment status and system access revocation before UAT.";
  }
  if (row.workspaceProfileStatus === "missing") {
    return "Assign role_code, position type, or workspace profile template.";
  }
  if (row.workspaceProfileStatus === "ambiguous") {
    return "Clear invalid workspace_profile override on fi_staff metadata.";
  }
  if (row.pinStatus === "missing") {
    return "Complete clinic-floor PIN setup via onboarding flow.";
  }
  if (row.onboardingStatus === "pending") {
    return "Finish onboarding checklist before staff UAT.";
  }
  if (row.onboardingStatus === "blocked") {
    return "Resolve onboarding vs active-access conflict before staff UAT.";
  }
  if (!row.roleCode?.trim()) {
    return "Assign role_code for feature access and workspace derivation.";
  }
  return "No action required — staff identity chain looks ready.";
}

function auditRowFromParts(input: {
  member: MemberSourceRow;
  fiStaff: FiStaffSourceRow | null;
  fiUserId: string | null;
  authUserId: string | null;
  authSnapshot: AuthUserSnapshot | null;
  inviteStatus: ReturnType<typeof resolveInviteStatus>;
  pinRawStatus: string | null | undefined;
  positionDefaultProfile: string | null;
  templateDefaultProfile: string | null;
  featureAccessCount: number;
  checklistPending: boolean;
}): StaffIdentityReadinessAuditRow {
  const loginExpected = loginExpectedForStaff(input.member);
  const authLoginStatus = resolveAuthLoginStatus({
    systemAccessRevoked: Boolean(input.member.system_access_revoked),
    employmentStatus: input.member.employment_status,
    fiUserId: input.fiUserId,
    authUserId: input.authUserId,
    authEmailConfirmed: input.authSnapshot?.emailConfirmed ?? false,
    authHasSignedIn: input.authSnapshot?.hasSignedIn ?? false,
  });

  let loginStatus = mapAuthLoginToAuditStatus(authLoginStatus, loginExpected, input.member);
  const issues: string[] = [];

  if (!input.member.fi_staff_id) {
    issues.push("Missing fi_staff projection link on fi_staff_members.");
  } else if (!input.fiStaff) {
    issues.push("fi_staff row not found for linked fi_staff_id.");
  }

  if (loginExpected && !input.fiUserId) {
    issues.push("Missing fi_user link on fi_staff.");
    if (loginStatus === "missing_user") loginStatus = "missing_user";
  } else if (loginExpected && input.fiUserId && !input.authUserId) {
    issues.push("fi_user exists but auth_user_id is missing.");
    loginStatus = "missing_auth";
  } else if (
    loginExpected &&
    input.authUserId &&
    input.authSnapshot &&
    !input.authSnapshot.exists
  ) {
    issues.push("auth_user_id set but Supabase auth user not found.");
    loginStatus = "missing_auth";
  }

  if (!input.member.role_code?.trim()) {
    issues.push("role_code is not set on fi_staff_members.");
  }

  const workspaceProfileStatus = evaluateWorkspaceProfileStatus({
    fiStaff: input.fiStaff,
    positionDefaultProfile: input.positionDefaultProfile,
    templateDefaultProfile: input.templateDefaultProfile,
    loginExpected,
  });

  if (workspaceProfileStatus === "missing") {
    issues.push("Workspace profile cannot be resolved for this staff member.");
  }
  if (workspaceProfileStatus === "ambiguous") {
    issues.push("Conflicting or invalid workspace profile signals.");
  }

  if (Boolean(input.member.system_access_revoked)) {
    issues.push("System access is revoked.");
  }
  if (String(input.member.employment_status).trim().toLowerCase() === "suspended") {
    issues.push("Employment status is suspended.");
  }

  const pinRequired = pinRequiredForStaff({
    loginExpected,
    roleCode: input.member.role_code,
    fiStaff: input.fiStaff,
  });
  const pinStatus = evaluatePinStatus({
    pinRawStatus: input.pinRawStatus,
    pinRequired,
  });
  if (pinStatus === "missing") {
    issues.push("Clinic-floor PIN is not configured.");
  }

  if (input.inviteStatus === "pending" || loginStatus === "invited") {
    issues.push("Login invitation is still pending.");
  }

  if (loginExpected && input.featureAccessCount === 0 && input.fiStaff) {
    issues.push("No fi_staff_feature_access rows — permission template may be missing.");
  }

  const onboardingStatus = evaluateOnboardingStatus({
    employmentStatus: input.member.employment_status,
    loginStatus,
    inviteStatus: input.inviteStatus,
    checklistPending: input.checklistPending,
    loginExpected,
    systemAccessRevoked: Boolean(input.member.system_access_revoked),
  });

  if (onboardingStatus === "blocked") {
    issues.push("Onboarding state conflicts with active staff usage.");
  }

  const row: StaffIdentityReadinessAuditRow = {
    staffMemberId: input.member.id,
    displayLabel: String(input.member.full_name ?? "Staff"),
    email: input.member.email?.trim() || input.fiStaff?.email?.trim() || undefined,
    employmentStatus: input.member.employment_status,
    roleCode: input.member.role_code?.trim() || undefined,
    loginStatus,
    workspaceProfileStatus,
    pinStatus,
    onboardingStatus,
    issues,
    recommendedAction: "",
  };
  row.recommendedAction = buildRecommendedAction(row);
  return row;
}

/** Aggregates whether staff UAT can proceed based on audit rows. */
export function summarizeStaffTestingReadiness(
  rows: StaffIdentityReadinessAuditRow[],
  opts?: { staffMemberIds?: string[] }
): StaffTestingReadinessSummary {
  const target = opts?.staffMemberIds?.length
    ? rows.filter((r) => opts.staffMemberIds!.includes(r.staffMemberId))
    : rows.filter((r) => {
        const status = r.employmentStatus.trim().toLowerCase();
        return status === "active" || status === "pending_onboarding";
      });

  if (target.length === 0) return "ready";

  const blocked = target.some(
    (r) =>
      r.loginStatus === "missing_user" ||
      r.loginStatus === "missing_auth" ||
      r.workspaceProfileStatus === "missing" ||
      r.loginStatus === "suspended" ||
      r.onboardingStatus === "blocked"
  );
  if (blocked) return "blocked";

  const watch = target.some(
    (r) =>
      r.pinStatus === "missing" ||
      r.loginStatus === "invited" ||
      r.onboardingStatus === "pending" ||
      r.issues.some((issue) => issue.toLowerCase().includes("invitation"))
  );
  if (watch) return "watch";

  const allReady = target.every(
    (r) =>
      r.loginStatus === "ready" &&
      (r.workspaceProfileStatus === "ready" || r.workspaceProfileStatus === "unknown") &&
      r.onboardingStatus !== "blocked"
  );
  return allReady ? "ready" : "watch";
}

function buildAuditSummary(
  rows: StaffIdentityReadinessAuditRow[]
): StaffIdentityReadinessAuditSummary {
  const activeRows = rows.filter((r) => isActiveStaffMemberFromAuditRow(r));
  return {
    readyCount: activeRows.filter(
      (r) =>
        r.loginStatus === "ready" &&
        r.workspaceProfileStatus === "ready" &&
        r.onboardingStatus === "ready" &&
        r.pinStatus !== "missing"
    ).length,
    missingLoginLinkCount: activeRows.filter(
      (r) => r.loginStatus === "missing_user" || r.loginStatus === "missing_auth"
    ).length,
    pendingInviteCount: activeRows.filter(
      (r) => r.loginStatus === "invited" || r.issues.some((i) => i.includes("invitation"))
    ).length,
    missingWorkspaceProfileCount: activeRows.filter((r) => r.workspaceProfileStatus === "missing")
      .length,
    pinMissingCount: activeRows.filter((r) => r.pinStatus === "missing").length,
    suspendedRevokedCount: activeRows.filter(
      (r) => r.loginStatus === "suspended" || r.issues.some((i) => i.includes("revoked"))
    ).length,
    testingReadiness: summarizeStaffTestingReadiness(rows),
  };
}

function isActiveStaffMemberFromAuditRow(row: StaffIdentityReadinessAuditRow): boolean {
  const status = row.employmentStatus.trim().toLowerCase();
  if (isDepartedStaff(status)) return false;
  if (status === "merged") return false;
  return true;
}

async function loadAuthSnapshots(
  authUserIds: string[],
  client: SupabaseClient
): Promise<Map<string, AuthUserSnapshot>> {
  const out = new Map<string, AuthUserSnapshot>();
  for (const id of authUserIds) {
    const { data, error } = await client.auth.admin.getUserById(id);
    if (error || !data.user) {
      out.set(id, { exists: false, emailConfirmed: false, hasSignedIn: false });
      continue;
    }
    out.set(id, {
      exists: true,
      emailConfirmed: Boolean(data.user.email_confirmed_at),
      hasSignedIn: Boolean(data.user.last_sign_in_at),
    });
  }
  return out;
}

export type RunStaffIdentityReadinessAuditOptions = {
  staffMemberId?: string;
  supabaseClientForTests?: SupabaseClient;
};

/** Server audit loader — read-only, no mutations. */
export async function runStaffIdentityReadinessAudit(
  tenantId: string,
  options?: RunStaffIdentityReadinessAuditOptions | SupabaseClient
): Promise<StaffIdentityReadinessAuditResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const normalizedOptions: RunStaffIdentityReadinessAuditOptions =
    options && "from" in (options as SupabaseClient)
      ? { supabaseClientForTests: options as SupabaseClient }
      : ((options as RunStaffIdentityReadinessAuditOptions | undefined) ?? {});
  const staffMemberId = normalizedOptions.staffMemberId?.trim() || null;
  const supabase = normalizedOptions.supabaseClientForTests ?? supabaseAdmin();

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

  const memberRows = (members ?? []) as MemberSourceRow[];

  const fiStaffIds = memberRows
    .map((m) => (m.fi_staff_id != null ? String(m.fi_staff_id) : null))
    .filter(Boolean) as string[];

  const fiStaffById = new Map<string, FiStaffSourceRow>();
  if (fiStaffIds.length) {
    const { data: fiStaffRows, error: fsErr } = await supabase
      .from("fi_staff")
      .select("id, fi_user_id, email, staff_role, staff_metadata, position_type_id, is_active")
      .eq("tenant_id", tid)
      .in("id", fiStaffIds);
    if (fsErr) throw new Error(fsErr.message);
    for (const raw of fiStaffRows ?? []) {
      const r = raw as FiStaffSourceRow & { staff_metadata: unknown };
      fiStaffById.set(String(r.id), {
        ...r,
        staff_metadata:
          r.staff_metadata &&
          typeof r.staff_metadata === "object" &&
          !Array.isArray(r.staff_metadata)
            ? (r.staff_metadata as Record<string, unknown>)
            : null,
      });
    }
  }

  const positionIds = [
    ...new Set(
      [...fiStaffById.values()].map((s) => s.position_type_id?.trim()).filter(Boolean) as string[]
    ),
  ];
  const positionProfileById = new Map<string, string | null>();
  const positionTemplateKeyById = new Map<string, string | null>();
  if (positionIds.length) {
    const { data: posRows, error: posErr } = await supabase
      .from("fi_staff_position_types")
      .select("id, default_workspace_profile, default_feature_template_key")
      .in("id", positionIds)
      .or(`tenant_id.is.null,tenant_id.eq.${tid}`);
    if (posErr) throw new Error(posErr.message);
    for (const raw of posRows ?? []) {
      const r = raw as {
        id: string;
        default_workspace_profile: string | null;
        default_feature_template_key: string | null;
      };
      positionProfileById.set(String(r.id), r.default_workspace_profile);
      positionTemplateKeyById.set(String(r.id), r.default_feature_template_key);
    }
  }

  const templateKeys = [
    ...new Set(
      [...positionTemplateKeyById.values()].map((k) => k?.trim()).filter(Boolean) as string[]
    ),
  ];
  const templateProfileByKey = new Map<string, string | null>();
  if (templateKeys.length) {
    const { data: tplRows, error: tplErr } = await supabase
      .from("fi_staff_feature_templates")
      .select("template_key, workspace_profile")
      .in("template_key", templateKeys)
      .eq("is_active", true)
      .or(`tenant_id.is.null,tenant_id.eq.${tid}`);
    if (tplErr) throw new Error(tplErr.message);
    for (const raw of tplRows ?? []) {
      const r = raw as { template_key: string; workspace_profile: string | null };
      templateProfileByKey.set(String(r.template_key), r.workspace_profile);
    }
  }

  const fiUserIds = [
    ...new Set([...fiStaffById.values()].map((s) => s.fi_user_id).filter(Boolean) as string[]),
  ];
  const fiUserById = new Map<string, { auth_user_id: string | null }>();
  if (fiUserIds.length) {
    const { data: userRows, error: uErr } = await supabase
      .from("fi_users")
      .select("id, auth_user_id")
      .eq("tenant_id", tid)
      .in("id", fiUserIds);
    if (uErr) throw new Error(uErr.message);
    for (const raw of userRows ?? []) {
      const r = raw as { id: string; auth_user_id: string | null };
      fiUserById.set(String(r.id), {
        auth_user_id: r.auth_user_id != null ? String(r.auth_user_id) : null,
      });
    }
  }

  const authUserIds = [
    ...new Set([...fiUserById.values()].map((u) => u.auth_user_id).filter(Boolean) as string[]),
  ];
  const authSnapshots = await loadAuthSnapshots(authUserIds, supabase);

  const memberIds = memberRows.map((m) => String(m.id));
  const latestInviteByMember = new Map<string, { status: string; expires_at: string }>();
  if (memberIds.length) {
    const { data: invites, error: invErr } = await supabase
      .from("fi_staff_login_invitations")
      .select("staff_member_id, status, expires_at")
      .eq("tenant_id", tid)
      .in("staff_member_id", memberIds)
      .order("invited_at", { ascending: false });
    if (invErr) throw new Error(invErr.message);
    for (const raw of invites ?? []) {
      const r = raw as { staff_member_id: string; status: string; expires_at: string };
      const mid = String(r.staff_member_id);
      if (!latestInviteByMember.has(mid)) latestInviteByMember.set(mid, r);
    }
  }

  const featureAccessCountByStaffId = new Map<string, number>();
  if (fiStaffIds.length) {
    const { data: faRows, error: faErr } = await supabase
      .from("fi_staff_feature_access")
      .select("staff_id")
      .eq("tenant_id", tid)
      .in("staff_id", fiStaffIds);
    if (faErr) throw new Error(faErr.message);
    for (const raw of faRows ?? []) {
      const sid = String((raw as { staff_id: string }).staff_id);
      featureAccessCountByStaffId.set(sid, (featureAccessCountByStaffId.get(sid) ?? 0) + 1);
    }
  }

  const checklistPendingByMember = new Map<string, boolean>();
  if (memberIds.length) {
    const { data: checklistRows, error: clErr } = await supabase
      .from("fi_staff_onboarding_checklists")
      .select(
        "staff_member_id, account_created, pin_chosen, permissions_assigned, training_pending"
      )
      .eq("tenant_id", tid)
      .in("staff_member_id", memberIds);
    if (clErr) throw new Error(clErr.message);
    for (const raw of checklistRows ?? []) {
      const r = raw as {
        staff_member_id: string;
        account_created: boolean;
        pin_chosen: boolean;
        permissions_assigned: boolean;
        training_pending: boolean;
      };
      const pending =
        !r.account_created || !r.permissions_assigned || !r.pin_chosen || r.training_pending;
      checklistPendingByMember.set(String(r.staff_member_id), pending);
    }
  }

  const rows: StaffIdentityReadinessAuditRow[] = [];
  for (const member of memberRows) {
    if (!isAuditableStaffMember(member)) continue;

    const fiStaffId = member.fi_staff_id != null ? String(member.fi_staff_id) : null;
    const fiStaff = fiStaffId ? (fiStaffById.get(fiStaffId) ?? null) : null;
    const fiUserId = fiStaff?.fi_user_id ?? null;
    const fiUser = fiUserId ? fiUserById.get(fiUserId) : null;
    const authUserId = fiUser?.auth_user_id ?? null;
    const authSnapshot = authUserId ? (authSnapshots.get(authUserId) ?? null) : null;

    const latestInvite = latestInviteByMember.get(String(member.id));
    const inviteStatus = resolveInviteStatus({
      invitationStatus: latestInvite?.status,
      expiresAt: latestInvite?.expires_at,
    });

    let pinRawStatus: string | null = null;
    if (fiStaffId) {
      const pinMeta = await loadStaffPinMetadataForStaff(tid, fiStaffId);
      pinRawStatus = pinMeta.status;
    }

    const positionId = fiStaff?.position_type_id?.trim() ?? "";
    const templateKey = positionId ? (positionTemplateKeyById.get(positionId) ?? null) : null;

    rows.push(
      auditRowFromParts({
        member,
        fiStaff,
        fiUserId,
        authUserId,
        authSnapshot,
        inviteStatus,
        pinRawStatus,
        positionDefaultProfile: positionId ? (positionProfileById.get(positionId) ?? null) : null,
        templateDefaultProfile: templateKey
          ? (templateProfileByKey.get(templateKey) ?? null)
          : null,
        featureAccessCount: fiStaffId ? (featureAccessCountByStaffId.get(fiStaffId) ?? 0) : 0,
        checklistPending: checklistPendingByMember.get(String(member.id)) ?? false,
      })
    );
  }

  return {
    tenantId: tid,
    rows,
    summary: buildAuditSummary(rows),
  };
}

/** Exported for unit tests — builds a single audit row from preloaded parts. */
export function buildStaffIdentityReadinessAuditRowForTest(
  input: Parameters<typeof auditRowFromParts>[0]
): StaffIdentityReadinessAuditRow {
  return auditRowFromParts(input);
}

export async function runStaffIdentityReadinessAuditForMember(
  tenantId: string,
  staffMemberId: string
): Promise<StaffIdentityReadinessAuditRow | null> {
  const result = await runStaffIdentityReadinessAudit(tenantId, {
    staffMemberId: staffMemberId.trim(),
  });
  return result.rows.find((row) => row.staffMemberId === staffMemberId.trim()) ?? null;
}

export { auditRowFromParts, loginExpectedForStaff, isAuditableStaffMember };
