/**
 * Staff Profile Hub — pure presentation for unified lifecycle overview.
 * No server or database imports.
 */

import type { OnboardingInviteDisplayStatus } from "@/src/lib/workforce/onboarding/onboardingCentreCore";
import type { OnboardingChecklistState } from "@/src/lib/workforce/onboarding/onboardingTypes";
import type { StaffWorkforceIntelligence } from "@/src/lib/staff/workforceCommandCentre";
import type {
  StaffAuthLoginStatus,
  StaffInviteStatus,
} from "@/src/lib/workforce/staffAccessCentreCore";

export type StaffProfileIdentityAuditSnapshot = {
  workspaceProfileStatus: "ready" | "missing" | "ambiguous" | "unknown";
  loginStatus: string;
  pinStatus: string;
  onboardingStatus: string;
  issues: string[];
};

export type StaffProfileAccessSnapshot = {
  authLoginStatus: StaffAuthLoginStatus;
  inviteStatus: StaffInviteStatus;
  pinStatus: string;
  canSendInvite: boolean;
  canResendInvite: boolean;
  canCopyInviteLink: boolean;
  canResetPin: boolean;
  canSuspendAccess: boolean;
  canRevokeAccess: boolean;
};
import {
  resolveStaffLeavePresentation,
  type StaffLeaveBlockSnapshot,
  type StaffShiftSnapshot,
} from "@/src/lib/workforce/staffLeaveWorkflowCore";
import { buildStaffStandardHoursEditorHref } from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import {
  buildOnboardingCentreHrefForTenant,
  buildStaffAccessCentreHrefForTenant,
  buildStaffEntitlementsHref,
  buildStaffIdentityAuditHref,
  buildStaffProfileHref,
  buildWorkforceCommandCentreHref,
  buildWorkforceRosterHref,
} from "@/src/lib/workforce/staffLifecycleCopy";
import {
  resolveOnboardingCentreActions,
  resolveStaffAccessCentreActions,
  resolveStaffUnifiedStatus,
  type StaffLifecycleAction,
  type StaffUnifiedStatusSnapshot,
} from "@/src/lib/workforce/staffLifecycleUxCore";
import { formatComplianceStatusLabel } from "@/src/lib/staff/workforceCommandCentre";

export type StaffProfileLeaveContext = {
  availabilityBlocks: StaffLeaveBlockSnapshot[];
  futureShifts: StaffShiftSnapshot[];
};

export type StaffLifecycleBlockerId =
  | "invite_not_sent"
  | "invite_pending"
  | "pin_not_set"
  | "missing_identity_link"
  | "missing_documents"
  | "training_incomplete"
  | "sop_incomplete"
  | "permissions_missing"
  | "manager_approval_pending"
  | "clinical_eligibility_blocked"
  | "future_shifts_during_leave"
  | "roster_unavailable";

export type StaffLifecycleBlocker = {
  id: StaffLifecycleBlockerId;
  label: string;
  description: string;
  href: string;
};

export type StaffLifecycleProgressStageId =
  | "created"
  | "onboarding"
  | "access"
  | "readiness"
  | "roster_eligible"
  | "active";

export type StaffLifecycleProgressStage = {
  id: StaffLifecycleProgressStageId;
  label: string;
  status: "complete" | "current" | "upcoming" | "blocked";
  blockReason?: string;
};

export type StaffProfileExtendedStatus = StaffUnifiedStatusSnapshot & {
  onboardingLabel: string | null;
  clinicalEligibilityLabel: string | null;
  trainingLabel: string | null;
  sopLabel: string | null;
  rosterLabel: string | null;
  leaveLabel: string | null;
  identityLinkLabel: string | null;
};

export type StaffProfileActionSection =
  | "primary"
  | "access"
  | "onboarding"
  | "employment"
  | "readiness"
  | "roster"
  | "offboarding"
  | "advanced";

export type StaffProfileActionKind = "link" | "server-action" | "copy" | "danger" | "modal";

export type StaffProfileAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  actionKind: StaffProfileActionKind;
  section: StaffProfileActionSection;
  disabled?: boolean;
  disabledReason?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  pendingLabel?: string;
};

export type StaffProfileActionContext = {
  tenantId: string;
  staffMemberId: string;
  viewerCanManageAccess: boolean;
  viewerCanManageOnboarding: boolean;
  viewerCanManageReadiness: boolean;
  viewerCanViewIdentityAudit: boolean;
};

export type StaffProfileActionMenuModel = {
  actions: StaffProfileAction[];
  primaryAction: StaffProfileAction | null;
  guidance: string | null;
  recommendedStep: StaffProfileAction | null;
};

export type StaffProfileOverviewModel = {
  unifiedStatus: StaffProfileExtendedStatus;
  blockers: StaffLifecycleBlocker[];
  actions: StaffLifecycleAction[];
  progressStages: StaffLifecycleProgressStage[];
  actionMenu: StaffProfileActionMenuModel;
  actionContext: StaffProfileActionContext;
  /**
   * Canonical domain action flags for StaffProfileActionMenu (B1.6).
   * Presentation only — server mutations remain authoritative.
   */
  domainActions?: {
    access?: {
      canInvite: boolean;
      canResend: boolean;
      canSuspend: boolean;
      canRevoke: boolean;
    };
    onboarding?: {
      canResendOnboardingInvite: boolean;
      canCancelOnboarding: boolean;
      canContinueSetup: boolean;
      canCreateSchedulingRecord: boolean;
      canRepairIdentityLink: boolean;
      canSendOnboardingInvite: boolean;
      canCopyOnboardingInviteLink: boolean;
    };
    compliance?: {
      canUploadCredential: boolean;
      canVerifyCredential: boolean;
      canRejectCredential: boolean;
      canRequestReplacement: boolean;
      canResolveIdentity: boolean;
    };
    identity?: {
      canRepairIdentityLink: boolean;
      canCreateSchedulingRecord: boolean;
      readOnly: boolean;
    };
  };
};

function onboardingStatusLabel(status: OnboardingInviteDisplayStatus | null): string | null {
  if (!status || status === "none") return "Onboarding not started";
  if (status === "pending") return "Onboarding invite pending";
  if (status === "accepted") return "Onboarding complete";
  if (status === "expired") return "Onboarding invite expired";
  if (status === "revoked") return "Onboarding invite revoked";
  return null;
}

function isOnboardingChecklistComplete(checklist: OnboardingChecklistState): boolean {
  return (
    checklist.accountCreated &&
    checklist.pinChosen &&
    checklist.permissionsAssigned &&
    !checklist.trainingPending
  );
}

export function resolveStaffProfileExtendedStatus(input: {
  employmentStatus: string | null | undefined;
  archivedAt: string | null | undefined;
  systemAccessRevoked: boolean;
  onboardingInviteStatus?: OnboardingInviteDisplayStatus | null;
  authLoginStatus?: StaffAuthLoginStatus | null;
  inviteStatus?: StaffInviteStatus | null;
  pinStatus?: string | null;
  readinessScore?: number | null;
  complianceLabel?: string | null;
  onboardingChecklist?: OnboardingChecklistState;
  workforceIntelligence?: StaffWorkforceIntelligence | null;
  identityAuditRow?: StaffProfileIdentityAuditSnapshot | null;
  leaveContext?: StaffProfileLeaveContext | null;
}): StaffProfileExtendedStatus {
  const checklist = input.onboardingChecklist;
  const intel = input.workforceIntelligence;
  const audit = input.identityAuditRow;

  const leavePresentation = resolveStaffLeavePresentation({
    employmentStatus: input.employmentStatus,
    availabilityBlocks: input.leaveContext?.availabilityBlocks ?? [],
    futureShifts: input.leaveContext?.futureShifts ?? [],
    nextShiftLabel: intel?.nextShiftLabel ?? null,
  });

  const base = resolveStaffUnifiedStatus({
    employmentStatus: input.employmentStatus,
    archivedAt: input.archivedAt,
    systemAccessRevoked: input.systemAccessRevoked,
    onboardingInviteStatus: input.onboardingInviteStatus,
    authLoginStatus: input.authLoginStatus ?? null,
    inviteStatus: input.inviteStatus ?? null,
    pinStatus: input.pinStatus,
    readinessScore: input.readinessScore ?? intel?.readinessScore ?? null,
    complianceLabel:
      input.complianceLabel ??
      (intel?.complianceStatus ? formatComplianceStatusLabel(intel.complianceStatus) : null),
    onboardingChecklistComplete: checklist ? isOnboardingChecklistComplete(checklist) : undefined,
  });

  const clinicalBlocked =
    !leavePresentation.suppressTrainingBlockers &&
    intel?.readinessScore != null &&
    intel.readinessScore < 70 &&
    !intel.surgeryReady;

  let rosterLabel: string | null;
  if (leavePresentation.isOnLeave) {
    rosterLabel = leavePresentation.rosterStatusLabel;
  } else if (intel?.nextShiftLabel) {
    rosterLabel = `Next shift: ${intel.nextShiftLabel}`;
  } else if (intel?.readinessScore != null && intel.readinessScore >= 70) {
    rosterLabel = "Roster eligible";
  } else {
    rosterLabel = "No roster availability";
  }

  const employmentLabel = leavePresentation.primaryStatusLabel
    ? leavePresentation.primaryStatusLabel
    : base.employmentLabel;

  return {
    ...base,
    employmentLabel,
    onboardingLabel: onboardingStatusLabel(input.onboardingInviteStatus ?? null),
    clinicalEligibilityLabel: leavePresentation.suppressTrainingBlockers
      ? null
      : intel?.surgeryReady
        ? "Clinically eligible"
        : clinicalBlocked
          ? "Clinical eligibility pending"
          : intel?.readinessScore != null
            ? "Clinical eligibility pending"
            : null,
    trainingLabel: leavePresentation.suppressTrainingBlockers
      ? null
      : intel?.trainingRequiredCount != null && intel.trainingRequiredCount > 0
        ? `${intel.trainingRequiredCount} training required`
        : checklist?.trainingPending
          ? "Training incomplete"
          : intel?.trainingProgressLabel && intel.trainingProgressLabel !== "—"
            ? intel.trainingProgressLabel
            : null,
    sopLabel: null,
    rosterLabel: leavePresentation.isOnLeave
      ? leavePresentation.rosterStatusLabel
      : leavePresentation.hideNextShift && intel?.nextShiftLabel
        ? null
        : rosterLabel,
    leaveLabel: leavePresentation.primaryStatusLabel,
    identityLinkLabel: audit
      ? audit.workspaceProfileStatus === "ready"
        ? "Identity linked"
        : audit.workspaceProfileStatus === "missing"
          ? "Identity link missing"
          : audit.workspaceProfileStatus === "ambiguous"
            ? "Identity link ambiguous"
            : null
      : null,
  };
}

export function resolveStaffLifecycleBlockers(input: {
  tenantId: string;
  employmentStatus: string;
  systemAccessRevoked: boolean;
  onboardingInviteStatus: OnboardingInviteDisplayStatus;
  accessRow: StaffProfileAccessSnapshot | null;
  checklist: OnboardingChecklistState;
  workforceIntelligence: StaffWorkforceIntelligence | null;
  identityAuditRow: StaffProfileIdentityAuditSnapshot | null;
  leaveContext?: StaffProfileLeaveContext | null;
  viewerCanViewIdentityAudit?: boolean;
}): StaffLifecycleBlocker[] {
  const blockers: StaffLifecycleBlocker[] = [];
  const onboardingHref = buildOnboardingCentreHrefForTenant(input.tenantId);
  const accessHref = buildStaffAccessCentreHrefForTenant(input.tenantId);
  const identityHref = buildStaffIdentityAuditHref(input.tenantId);
  const rosterHref = buildWorkforceRosterHref(input.tenantId);
  const entitlementsHref = buildStaffEntitlementsHref(input.tenantId);

  const leavePresentation = resolveStaffLeavePresentation({
    employmentStatus: input.employmentStatus,
    availabilityBlocks: input.leaveContext?.availabilityBlocks ?? [],
    futureShifts: input.leaveContext?.futureShifts ?? [],
    nextShiftLabel: input.workforceIntelligence?.nextShiftLabel ?? null,
  });

  if (leavePresentation.futureShiftConflictCount > 0) {
    const leaveKind = leavePresentation.isMaternityLeave ? "maternity leave" : "leave";
    blockers.push({
      id: "future_shifts_during_leave",
      label: `Shifts scheduled during ${leaveKind}`,
      description: `This staff member has ${leavePresentation.futureShiftConflictCount} shift(s) scheduled during ${leaveKind}. Review roster.`,
      href: rosterHref,
    });
  }

  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();
  const suspended = input.systemAccessRevoked || employment === "suspended";
  const onFullLeave = leavePresentation.isOnLeave;

  if (!suspended) {
    if (input.onboardingInviteStatus === "none" && employment === "pending_onboarding") {
      blockers.push({
        id: "invite_not_sent",
        label: "Onboarding invite not sent",
        description: "Send an onboarding invite so the new hire can complete setup.",
        href: onboardingHref,
      });
    }
    if (input.onboardingInviteStatus === "pending" || input.onboardingInviteStatus === "expired") {
      blockers.push({
        id: "invite_pending",
        label: "Onboarding invite pending",
        description: "The invite has not been accepted yet — resend or copy the link.",
        href: onboardingHref,
      });
    }
    if (input.accessRow?.authLoginStatus === "no_login") {
      blockers.push({
        id: "invite_not_sent",
        label: "Login invite not sent",
        description: "Provision login access in Staff Access Centre.",
        href: accessHref,
      });
    }
    if (input.accessRow?.authLoginStatus === "invite_pending") {
      blockers.push({
        id: "invite_pending",
        label: "Login invite pending",
        description: "The login invite has not been accepted yet.",
        href: accessHref,
      });
    }
  }

  const pinStatus = String(input.accessRow?.pinStatus ?? "").toLowerCase();
  if (
    !suspended &&
    input.accessRow &&
    (pinStatus.includes("not set") || pinStatus.includes("missing")) &&
    (input.accessRow.authLoginStatus === "login_active" ||
      input.accessRow.inviteStatus === "accepted")
  ) {
    blockers.push({
      id: "pin_not_set",
      label: "PIN not set",
      description: "Staff accepted login but has not set a PIN yet.",
      href: accessHref,
    });
  }

  if (
    input.viewerCanViewIdentityAudit !== false &&
    input.identityAuditRow?.workspaceProfileStatus === "missing"
  ) {
    blockers.push({
      id: "missing_identity_link",
      label: "Missing staff identity link",
      description: "Workspace profile or fi_staff link is missing — review in Identity Audit.",
      href: identityHref,
    });
  }
  if (
    input.viewerCanViewIdentityAudit !== false &&
    input.identityAuditRow?.workspaceProfileStatus === "ambiguous"
  ) {
    blockers.push({
      id: "missing_identity_link",
      label: "Ambiguous identity link",
      description: "Multiple identity signals conflict — review in Identity Audit.",
      href: identityHref,
    });
  }

  const intel = input.workforceIntelligence;
  if (intel?.complianceStatus === "missing" || intel?.complianceStatus === "expired") {
    blockers.push({
      id: "missing_documents",
      label: "Missing documents",
      description: "Required compliance documents are missing or expired.",
      href: `${onboardingHref}#compliance`,
    });
  }

  if (input.checklist.trainingPending || (intel?.trainingRequiredCount ?? 0) > 0) {
    if (!onFullLeave) {
      blockers.push({
        id: "training_incomplete",
        label: "Training incomplete",
        description: "Assign or complete required training before staff are ready to work.",
        href: onboardingHref,
      });
    }
  }

  if (!input.checklist.permissionsAssigned && employment === "pending_onboarding") {
    blockers.push({
      id: "permissions_missing",
      label: "Permissions not assigned",
      description: "Staff entitlements and module grants need to be configured.",
      href: entitlementsHref,
    });
  }

  if (
    !onFullLeave &&
    intel?.readinessScore != null &&
    intel.readinessScore < 70 &&
    !intel.surgeryReady &&
    employment === "active"
  ) {
    blockers.push({
      id: "clinical_eligibility_blocked",
      label: "Clinical eligibility blocked",
      description: "Readiness score is below the threshold for clinical roster assignment.",
      href: rosterHref,
    });
  }

  if (
    !onFullLeave &&
    intel &&
    !intel.nextShiftLabel &&
    employment === "active" &&
    (intel.readinessScore == null || intel.readinessScore < 70)
  ) {
    blockers.push({
      id: "roster_unavailable",
      label: "Roster unavailable",
      description: "No working hours or upcoming shifts — configure availability in Roster.",
      href: rosterHref,
    });
  }

  return blockers;
}

export function resolveStaffLifecycleProgress(input: {
  employmentStatus: string;
  archivedAt: string | null;
  systemAccessRevoked: boolean;
  onboardingInviteStatus: OnboardingInviteDisplayStatus;
  checklist: OnboardingChecklistState;
  accessRow: StaffProfileAccessSnapshot | null;
  workforceIntelligence: StaffWorkforceIntelligence | null;
  leaveContext?: StaffProfileLeaveContext | null;
}): StaffLifecycleProgressStage[] {
  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();
  const suspended = input.systemAccessRevoked || employment === "suspended";
  const leavePresentation = resolveStaffLeavePresentation({
    employmentStatus: input.employmentStatus,
    availabilityBlocks: input.leaveContext?.availabilityBlocks ?? [],
    futureShifts: input.leaveContext?.futureShifts ?? [],
    nextShiftLabel: input.workforceIntelligence?.nextShiftLabel ?? null,
  });
  const onFullLeave = leavePresentation.isOnLeave;
  const onboardingComplete =
    input.onboardingInviteStatus === "accepted" && isOnboardingChecklistComplete(input.checklist);
  const accessActive = input.accessRow?.authLoginStatus === "login_active";
  const pinReady =
    input.accessRow != null && String(input.accessRow.pinStatus).toLowerCase().includes("active");
  const readinessReady =
    (input.workforceIntelligence?.readinessScore ?? 0) >= 70 ||
    Boolean(input.workforceIntelligence?.surgeryReady);
  const rosterEligible =
    !onFullLeave &&
    (Boolean(input.workforceIntelligence?.nextShiftLabel) ||
      (input.workforceIntelligence?.readinessScore ?? 0) >= 70);
  const fullyActive =
    !onFullLeave && employment === "active" && accessActive && pinReady && readinessReady;

  const stages: StaffLifecycleProgressStage[] = [
    { id: "created", label: "Created", status: "complete" },
    {
      id: "onboarding",
      label: "Onboarding",
      status: onboardingComplete
        ? "complete"
        : employment === "pending_onboarding"
          ? "current"
          : "upcoming",
      blockReason:
        !onboardingComplete && input.onboardingInviteStatus === "none"
          ? "Invite not sent"
          : !onboardingComplete && input.onboardingInviteStatus === "pending"
            ? "Invite pending"
            : undefined,
    },
    {
      id: "access",
      label: "Access",
      status:
        accessActive && pinReady
          ? "complete"
          : onboardingComplete || employment !== "pending_onboarding"
            ? accessActive || input.accessRow?.authLoginStatus === "invite_pending"
              ? "current"
              : "upcoming"
            : "upcoming",
      blockReason: suspended
        ? "Access suspended"
        : !accessActive && input.accessRow?.authLoginStatus === "no_login"
          ? "Login not provisioned"
          : accessActive && !pinReady
            ? "PIN not set"
            : undefined,
    },
    {
      id: "readiness",
      label: "Readiness",
      status: readinessReady ? "complete" : accessActive ? "current" : "upcoming",
      blockReason: input.checklist.trainingPending ? "Training incomplete" : undefined,
    },
    {
      id: "roster_eligible",
      label: onFullLeave
        ? leavePresentation.isMaternityLeave
          ? "On maternity leave"
          : "On leave"
        : "Roster eligible",
      status: onFullLeave
        ? "blocked"
        : rosterEligible
          ? "complete"
          : readinessReady
            ? "current"
            : "upcoming",
      blockReason: onFullLeave
        ? (leavePresentation.primaryStatusLabel ?? "On leave")
        : !rosterEligible && readinessReady
          ? "No working hours configured"
          : undefined,
    },
    {
      id: "active",
      label: "Active",
      status: onFullLeave
        ? "blocked"
        : fullyActive
          ? "complete"
          : employment === "active"
            ? "current"
            : "upcoming",
      blockReason: onFullLeave
        ? (leavePresentation.primaryStatusLabel ?? "On leave")
        : employment !== "active"
          ? `Employment: ${employment.replace(/_/g, " ")}`
          : undefined,
    },
  ];

  if (suspended) {
    const accessStage = stages.find((s) => s.id === "access");
    if (accessStage) {
      accessStage.status = "blocked";
      accessStage.blockReason = "Access suspended or revoked";
    }
  }

  return stages;
}

export function resolveStaffProfileActions(input: {
  tenantId: string;
  employmentStatus: string;
  email: string | null;
  systemAccessRevoked: boolean;
  onboardingInviteStatus: OnboardingInviteDisplayStatus;
  hasOnboardingInviteUrl: boolean;
  accessRow: StaffProfileAccessSnapshot | null;
  checklist: OnboardingChecklistState;
  limit?: number;
  viewerCanViewIdentityAudit?: boolean;
}): StaffLifecycleAction[] {
  const actions = resolveStaffProfileLifecycleActions(input);
  const cap = input.limit ?? 8;
  return actions.slice(0, cap);
}

function resolveStaffProfileLifecycleActions(input: {
  tenantId: string;
  employmentStatus: string;
  email: string | null;
  systemAccessRevoked: boolean;
  onboardingInviteStatus: OnboardingInviteDisplayStatus;
  hasOnboardingInviteUrl: boolean;
  accessRow: StaffProfileAccessSnapshot | null;
  checklist: OnboardingChecklistState;
  viewerCanViewIdentityAudit?: boolean;
}): StaffLifecycleAction[] {
  const onboardingHref = buildOnboardingCentreHrefForTenant(input.tenantId);
  const accessHref = buildStaffAccessCentreHrefForTenant(input.tenantId);
  const identityHref = buildStaffIdentityAuditHref(input.tenantId);
  const rosterHref = buildWorkforceRosterHref(input.tenantId);
  const entitlementsHref = buildStaffEntitlementsHref(input.tenantId);

  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();
  const isPendingOnboarding = employment === "pending_onboarding";

  const actions: StaffLifecycleAction[] = [];

  if (isPendingOnboarding) {
    const onboardingActions = resolveOnboardingCentreActions({
      email: input.email,
      systemAccessRevoked: input.systemAccessRevoked,
      employmentStatus: input.employmentStatus,
      inviteStatus: input.onboardingInviteStatus,
      hasInviteUrl: input.hasOnboardingInviteUrl,
    });
    for (const action of onboardingActions) {
      actions.push({
        ...action,
        href: action.id === "open_access_centre" ? accessHref : onboardingHref,
      });
    }
    if (input.onboardingInviteStatus === "none") {
      actions.unshift({
        id: "start_onboarding",
        label: "Start onboarding",
        href: onboardingHref,
        priority: "primary",
      });
    }
  }

  if (input.accessRow) {
    const accessActions = resolveStaffAccessCentreActions({
      canSendInvite: input.accessRow.canSendInvite,
      canResendInvite: input.accessRow.canResendInvite,
      canCopyInviteLink: input.accessRow.canCopyInviteLink,
      canResetPin: input.accessRow.canResetPin,
      canSuspendAccess: input.accessRow.canSuspendAccess,
      canRevokeAccess: input.accessRow.canRevokeAccess,
      authLoginStatus: input.accessRow.authLoginStatus,
      systemAccessRevoked: input.systemAccessRevoked,
    });
    for (const action of accessActions) {
      if (actions.some((a) => a.id === action.id)) continue;
      actions.push({
        ...action,
        href: action.id === "open_access_centre" ? accessHref : accessHref,
      });
    }
  }

  const linkActions: StaffLifecycleAction[] = [
    {
      id: "open_access_centre",
      label: "Open Staff Access",
      href: accessHref,
      priority: "secondary",
    },
    {
      id: "open_onboarding_centre",
      label: "Open Onboarding Centre",
      href: onboardingHref,
      priority: "secondary",
    },
  ];

  if (input.viewerCanViewIdentityAudit !== false) {
    linkActions.push({
      id: "open_identity_audit",
      label: "Open Identity Audit",
      href: identityHref,
      priority: "secondary",
    });
  }

  if (input.checklist.trainingPending) {
    linkActions.push({
      id: "assign_training",
      label: "Assign training",
      href: onboardingHref,
      priority: "secondary",
    });
  }

  if (!input.checklist.permissionsAssigned) {
    linkActions.push({
      id: "upload_document",
      label: "Edit staff entitlements",
      href: entitlementsHref,
      priority: "secondary",
    });
  }

  linkActions.push({
    id: "open_roster",
    label: "Open roster",
    href: rosterHref,
    priority: "secondary",
  });

  for (const link of linkActions) {
    if (!actions.some((a) => a.label === link.label)) {
      actions.push(link);
    }
  }

  return actions;
}

const ONBOARDING_MUTATION_IDS = new Set([
  "send_onboarding_invite",
  "resend_onboarding_invite",
  "copy_onboarding_invite_link",
]);

const ACCESS_MUTATION_IDS = new Set([
  "send_login_invite",
  "resend_login_invite",
  "copy_login_invite_link",
  "reset_pin",
]);

const DANGER_ACTION_IDS = new Set(["suspend_access", "revoke_access"]);

function profileActionKindForLifecycleId(id: string): StaffProfileActionKind {
  if (DANGER_ACTION_IDS.has(id)) return "danger";
  if (id === "copy_onboarding_invite_link" || id === "copy_login_invite_link") return "copy";
  if (
    id === "set_leave" ||
    id === "set_maternity_leave" ||
    id === "manage_leave" ||
    id === "manage_employment" ||
    id === "mark_inactive" ||
    id === "archive_staff" ||
    id === "re_enable_roster_after_return"
  ) {
    return "modal";
  }
  if (ONBOARDING_MUTATION_IDS.has(id) || ACCESS_MUTATION_IDS.has(id)) {
    return "server-action";
  }
  return "link";
}

function profileSectionForLifecycleId(id: string, isPrimary: boolean): StaffProfileActionSection {
  if (isPrimary) return "primary";
  if (
    id === "send_login_invite" ||
    id === "resend_login_invite" ||
    id === "copy_login_invite_link" ||
    id === "reset_pin" ||
    id === "open_access_centre" ||
    id === "open_identity_audit"
  ) {
    return "access";
  }
  if (
    id === "start_onboarding" ||
    id === "send_onboarding_invite" ||
    id === "resend_onboarding_invite" ||
    id === "copy_onboarding_invite_link" ||
    id === "open_onboarding_centre"
  ) {
    return "onboarding";
  }
  if (
    id === "assign_training" ||
    id === "upload_document" ||
    id === "open_command_centre" ||
    id === "open_documents"
  ) {
    return "readiness";
  }
  if (id === "open_roster") return "roster";
  if (
    id === "set_leave" ||
    id === "set_maternity_leave" ||
    id === "manage_leave" ||
    id === "edit_standard_hours" ||
    id === "manage_employment"
  ) {
    return "employment";
  }
  if (
    id === "mark_inactive" ||
    id === "archive_staff" ||
    id === "offboard_staff" ||
    id === "review_future_shifts"
  ) {
    return "offboarding";
  }
  if (DANGER_ACTION_IDS.has(id)) return "advanced";
  return "access";
}

function pendingLabelForAction(id: string): string | undefined {
  if (id === "send_onboarding_invite" || id === "send_login_invite") return "Sending…";
  if (id === "resend_onboarding_invite" || id === "resend_login_invite") return "Resending…";
  if (id === "copy_onboarding_invite_link" || id === "copy_login_invite_link") return "Copying…";
  if (id === "reset_pin") return "Creating reset link…";
  if (id === "suspend_access") return "Suspending…";
  if (id === "revoke_access") return "Revoking…";
  return undefined;
}

function permissionGateForAction(
  id: string,
  ctx: StaffProfileActionContext
): { disabled: boolean; disabledReason?: string } {
  if (ONBOARDING_MUTATION_IDS.has(id) && !ctx.viewerCanManageOnboarding) {
    return { disabled: true, disabledReason: "Only admins can manage onboarding invites." };
  }
  if ((ACCESS_MUTATION_IDS.has(id) || DANGER_ACTION_IDS.has(id)) && !ctx.viewerCanManageAccess) {
    const reason =
      id === "reset_pin"
        ? "Only admins can reset staff PIN access."
        : id === "resend_login_invite" || id === "send_login_invite"
          ? "Only admins can resend staff invites."
          : id === "copy_login_invite_link"
            ? "Only admins can copy staff invite links."
            : "Only admins can manage staff access.";
    return { disabled: true, disabledReason: reason };
  }
  return { disabled: false };
}

function confirmCopyForDangerAction(id: string): {
  confirmTitle?: string;
  confirmDescription?: string;
} {
  if (id === "suspend_access") {
    return {
      confirmTitle: "Suspend staff access?",
      confirmDescription:
        "The staff member will not be able to sign in until access is reactivated in Staff Access Centre.",
    };
  }
  if (id === "revoke_access") {
    return {
      confirmTitle: "Revoke staff access?",
      confirmDescription:
        "This permanently revokes login access. The staff member will need a new invite to sign in again.",
    };
  }
  return {};
}

/** Resolve normalized profile action menu from lifecycle snapshot — no 8-action cap. */
export function resolveStaffProfileActionMenu(input: {
  tenantId: string;
  staffMemberId: string;
  fiStaffId?: string | null;
  staffName?: string | null;
  employmentStatus: string;
  archivedAt?: string | null;
  email: string | null;
  systemAccessRevoked: boolean;
  onboardingInviteStatus: OnboardingInviteDisplayStatus;
  hasOnboardingInviteUrl: boolean;
  accessRow: StaffProfileAccessSnapshot | null;
  checklist: OnboardingChecklistState;
  blockers: StaffLifecycleBlocker[];
  actionContext: StaffProfileActionContext;
  leaveContext?: StaffProfileLeaveContext | null;
}): StaffProfileActionMenuModel {
  const lifecycleActions = resolveStaffProfileLifecycleActions({
    tenantId: input.tenantId,
    employmentStatus: input.employmentStatus,
    email: input.email,
    systemAccessRevoked: input.systemAccessRevoked,
    onboardingInviteStatus: input.onboardingInviteStatus,
    hasOnboardingInviteUrl: input.hasOnboardingInviteUrl,
    accessRow: input.accessRow,
    checklist: input.checklist,
    viewerCanViewIdentityAudit: input.actionContext.viewerCanViewIdentityAudit,
  });

  const onboardingHref = buildOnboardingCentreHrefForTenant(input.tenantId);
  const accessHref = buildStaffAccessCentreHrefForTenant(input.tenantId);
  const identityHref = buildStaffIdentityAuditHref(input.tenantId);
  const rosterHref = buildWorkforceRosterHref(input.tenantId);
  const entitlementsHref = buildStaffEntitlementsHref(input.tenantId);
  const commandHref = buildWorkforceCommandCentreHref(input.tenantId);
  const offboardingHref = `/fi-admin/${input.tenantId}/hr-os/offboarding`;
  const standardHoursHref = input.fiStaffId
    ? buildStaffStandardHoursEditorHref(input.tenantId, input.fiStaffId)
    : `${buildWorkforceRosterHref(input.tenantId)}/standard-hours`;
  const hrTaskMapHref = `${commandHref}/hr-task-map`;

  const leavePresentation = resolveStaffLeavePresentation({
    employmentStatus: input.employmentStatus,
    availabilityBlocks: input.leaveContext?.availabilityBlocks ?? [],
    futureShifts: input.leaveContext?.futureShifts ?? [],
  });

  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();
  const isArchived = Boolean(input.archivedAt);
  const isActiveEmployment = employment === "active" || employment === "on_leave";

  const hrefById: Record<string, string> = {
    start_onboarding: onboardingHref,
    send_onboarding_invite: onboardingHref,
    resend_onboarding_invite: onboardingHref,
    copy_onboarding_invite_link: onboardingHref,
    send_login_invite: accessHref,
    resend_login_invite: accessHref,
    copy_login_invite_link: accessHref,
    reset_pin: accessHref,
    open_access_centre: accessHref,
    open_onboarding_centre: onboardingHref,
    open_identity_audit: identityHref,
    assign_training: onboardingHref,
    upload_document: entitlementsHref,
    open_roster: rosterHref,
    open_command_centre: commandHref,
    open_documents: `${onboardingHref}#compliance`,
    suspend_access: accessHref,
    revoke_access: accessHref,
  };

  const primaryLifecycle =
    lifecycleActions.find((a) => a.id === "resend_onboarding_invite") ??
    lifecycleActions.find((a) => a.id === "send_onboarding_invite") ??
    lifecycleActions.find((a) => a.id === "start_onboarding") ??
    lifecycleActions.find((a) => a.id === "resend_login_invite") ??
    lifecycleActions.find((a) => a.id === "send_login_invite") ??
    lifecycleActions.find((a) => a.id === "reset_pin") ??
    lifecycleActions.find((a) => a.priority === "primary" && !a.guidance) ??
    lifecycleActions.find((a) => a.priority === "primary") ??
    null;

  const guidanceAction = lifecycleActions.find((a) => a.guidance);
  const guidance = guidanceAction?.guidance ?? null;

  const profileActions: StaffProfileAction[] = [];

  for (const action of lifecycleActions) {
    const normalizedId =
      action.id === "view_profile" && action.label.toLowerCase().includes("identity")
        ? "open_identity_audit"
        : action.id === "view_profile" && action.label.toLowerCase().includes("roster")
          ? "open_roster"
          : action.id;

    const isPrimary = primaryLifecycle != null && action.id === primaryLifecycle.id;
    const actionKind = profileActionKindForLifecycleId(normalizedId);
    const section = profileSectionForLifecycleId(normalizedId, isPrimary);
    const gate = permissionGateForAction(normalizedId, input.actionContext);
    const confirm = confirmCopyForDangerAction(normalizedId);

    profileActions.push({
      id: normalizedId,
      label: action.label,
      description: action.guidance,
      href: actionKind === "link" ? (hrefById[normalizedId] ?? action.href) : undefined,
      actionKind,
      section,
      disabled: gate.disabled,
      disabledReason: gate.disabledReason,
      pendingLabel: pendingLabelForAction(normalizedId),
      ...confirm,
    });
  }

  const extraLinks: StaffProfileAction[] = [
    {
      id: "open_command_centre",
      label: "Open Command Centre",
      href: commandHref,
      actionKind: "link",
      section: "readiness",
    },
  ];

  if (input.blockers.some((b) => b.id === "missing_documents")) {
    extraLinks.unshift({
      id: "open_documents",
      label: "Open documents & compliance",
      href: `${onboardingHref}#compliance`,
      actionKind: "link",
      section: "readiness",
    });
  }

  for (const extra of extraLinks) {
    if (!profileActions.some((a) => a.id === extra.id)) {
      profileActions.push(extra);
    }
  }

  const employmentActions: StaffProfileAction[] = [];
  const offboardingActions: StaffProfileAction[] = [];

  if (leavePresentation.isOnLeave) {
    employmentActions.push({
      id: "manage_leave",
      label: "Manage leave / return-to-work date",
      description: "Update maternity leave dates or return to active employment.",
      actionKind: "modal",
      section: "primary",
    });
    if (leavePresentation.futureShiftConflictCount > 0) {
      employmentActions.push({
        id: "review_future_shifts",
        label: "Review future shifts",
        href: rosterHref,
        actionKind: "link",
        section: "employment",
      });
    }
    employmentActions.push({
      id: "manage_access_leave",
      label: "Keep or disable login access",
      href: accessHref,
      actionKind: "link",
      section: "employment",
    });
    employmentActions.push({
      id: "re_enable_roster_after_return",
      label: "Re-enable roster eligibility after return",
      description: "Set employment to active and clear leave when staff returns.",
      actionKind: "modal",
      section: "employment",
    });
  } else if (isActiveEmployment && !isArchived) {
    employmentActions.push(
      {
        id: "set_leave",
        label: "Set leave",
        actionKind: "modal",
        section: "employment",
      },
      {
        id: "set_maternity_leave",
        label: "Set maternity leave",
        description: "Exclude from roster generation while preserving employment profile.",
        actionKind: "modal",
        section: "employment",
      },
      {
        id: "manage_employment",
        label: "Manage employment",
        actionKind: "modal",
        section: "employment",
      },
      {
        id: "edit_standard_hours",
        label: "Edit standard hours",
        href: standardHoursHref,
        actionKind: "link",
        section: "employment",
      }
    );
  }

  if (
    !isArchived &&
    employment !== "terminated" &&
    employment !== "resigned" &&
    employment !== "contract_ended"
  ) {
    offboardingActions.push(
      {
        id: "mark_inactive",
        label: "Mark inactive",
        actionKind: "modal",
        section: "offboarding",
      },
      {
        id: "archive_staff",
        label: "Archive staff",
        actionKind: "modal",
        section: "offboarding",
      },
      {
        id: "offboard_staff",
        label: "Offboard / terminate",
        href: offboardingHref,
        actionKind: "link",
        section: "offboarding",
      }
    );
  }

  employmentActions.push({
    id: "open_hr_task_map",
    label: "What do I do next?",
    href: hrTaskMapHref,
    actionKind: "link",
    section: "employment",
  });

  for (const action of [...employmentActions, ...offboardingActions]) {
    if (!profileActions.some((a) => a.id === action.id)) {
      profileActions.push(action);
    }
  }

  const leavePrimary = leavePresentation.isOnLeave
    ? (profileActions.find((a) => a.id === "manage_leave" && !a.disabled) ?? null)
    : null;

  const primaryAction =
    leavePrimary ??
    profileActions.find((a) => a.section === "primary" && !a.disabled) ??
    profileActions.find((a) => a.section === "primary") ??
    null;

  const recommendedStep = primaryAction;

  return {
    actions: profileActions,
    primaryAction,
    guidance,
    recommendedStep,
  };
}

export function buildStaffProfileOverviewModel(input: {
  tenantId: string;
  staffMemberId: string;
  fiStaffId?: string | null;
  staffName?: string | null;
  employmentStatus: string;
  archivedAt: string | null;
  email: string | null;
  systemAccessRevoked: boolean;
  onboardingInviteStatus: OnboardingInviteDisplayStatus;
  hasOnboardingInviteUrl: boolean;
  checklist: OnboardingChecklistState;
  accessRow: StaffProfileAccessSnapshot | null;
  workforceIntelligence: StaffWorkforceIntelligence | null;
  identityAuditRow: StaffProfileIdentityAuditSnapshot | null;
  pinStatus?: string | null;
  viewerCanManageAccess?: boolean;
  viewerCanManageOnboarding?: boolean;
  viewerCanManageReadiness?: boolean;
  viewerCanViewIdentityAudit?: boolean;
  leaveContext?: StaffProfileLeaveContext | null;
}): StaffProfileOverviewModel {
  const actionContext: StaffProfileActionContext = {
    tenantId: input.tenantId,
    staffMemberId: input.staffMemberId,
    viewerCanManageAccess: input.viewerCanManageAccess ?? false,
    viewerCanManageOnboarding: input.viewerCanManageOnboarding ?? false,
    viewerCanManageReadiness: input.viewerCanManageReadiness ?? false,
    viewerCanViewIdentityAudit: input.viewerCanViewIdentityAudit ?? false,
  };

  const blockers = resolveStaffLifecycleBlockers({
    tenantId: input.tenantId,
    employmentStatus: input.employmentStatus,
    systemAccessRevoked: input.systemAccessRevoked,
    onboardingInviteStatus: input.onboardingInviteStatus,
    accessRow: input.accessRow,
    checklist: input.checklist,
    workforceIntelligence: input.workforceIntelligence,
    identityAuditRow: input.identityAuditRow,
    leaveContext: input.leaveContext,
    viewerCanViewIdentityAudit: input.viewerCanViewIdentityAudit,
  });

  const actionMenu = resolveStaffProfileActionMenu({
    tenantId: input.tenantId,
    staffMemberId: input.staffMemberId,
    fiStaffId: input.fiStaffId,
    staffName: input.staffName,
    employmentStatus: input.employmentStatus,
    archivedAt: input.archivedAt,
    email: input.email,
    systemAccessRevoked: input.systemAccessRevoked,
    onboardingInviteStatus: input.onboardingInviteStatus,
    hasOnboardingInviteUrl: input.hasOnboardingInviteUrl,
    accessRow: input.accessRow,
    checklist: input.checklist,
    blockers,
    actionContext,
    leaveContext: input.leaveContext,
  });

  return {
    unifiedStatus: resolveStaffProfileExtendedStatus({
      employmentStatus: input.employmentStatus,
      archivedAt: input.archivedAt,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus: input.onboardingInviteStatus,
      authLoginStatus: input.accessRow?.authLoginStatus ?? null,
      inviteStatus: input.accessRow?.inviteStatus ?? null,
      pinStatus: input.pinStatus ?? input.accessRow?.pinStatus ?? null,
      workforceIntelligence: input.workforceIntelligence,
      identityAuditRow: input.identityAuditRow,
      onboardingChecklist: input.checklist,
      leaveContext: input.leaveContext,
    }),
    blockers,
    actions: resolveStaffProfileActions({
      tenantId: input.tenantId,
      employmentStatus: input.employmentStatus,
      email: input.email,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus: input.onboardingInviteStatus,
      hasOnboardingInviteUrl: input.hasOnboardingInviteUrl,
      accessRow: input.accessRow,
      checklist: input.checklist,
      viewerCanViewIdentityAudit: input.viewerCanViewIdentityAudit,
    }),
    progressStages: resolveStaffLifecycleProgress({
      employmentStatus: input.employmentStatus,
      archivedAt: input.archivedAt,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus: input.onboardingInviteStatus,
      checklist: input.checklist,
      accessRow: input.accessRow,
      workforceIntelligence: input.workforceIntelligence,
      leaveContext: input.leaveContext,
    }),
    actionMenu,
    actionContext,
  };
}

export { buildStaffProfileHref };
