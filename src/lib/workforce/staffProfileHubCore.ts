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
  buildOnboardingCentreHrefForTenant,
  buildStaffAccessCentreHrefForTenant,
  buildStaffEntitlementsHref,
  buildStaffIdentityAuditHref,
  buildStaffProfileHref,
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
  identityLinkLabel: string | null;
};

export type StaffProfileOverviewModel = {
  unifiedStatus: StaffProfileExtendedStatus;
  blockers: StaffLifecycleBlocker[];
  actions: StaffLifecycleAction[];
  progressStages: StaffLifecycleProgressStage[];
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
}): StaffProfileExtendedStatus {
  const checklist = input.onboardingChecklist;
  const intel = input.workforceIntelligence;
  const audit = input.identityAuditRow;

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
    intel?.readinessScore != null &&
    intel.readinessScore < 70 &&
    !intel.surgeryReady;

  return {
    ...base,
    onboardingLabel: onboardingStatusLabel(input.onboardingInviteStatus ?? null),
    clinicalEligibilityLabel: intel?.surgeryReady
      ? "Clinically eligible"
      : clinicalBlocked
        ? "Clinical eligibility blocked"
        : intel?.readinessScore != null
          ? "Clinical eligibility pending"
          : null,
    trainingLabel:
      intel?.trainingRequiredCount != null && intel.trainingRequiredCount > 0
        ? `${intel.trainingRequiredCount} training required`
        : checklist?.trainingPending
          ? "Training incomplete"
          : intel?.trainingProgressLabel && intel.trainingProgressLabel !== "—"
            ? intel.trainingProgressLabel
            : null,
    sopLabel: null,
    rosterLabel: intel?.nextShiftLabel
      ? `Next shift: ${intel.nextShiftLabel}`
      : intel?.readinessScore != null && intel.readinessScore >= 70
        ? "Roster eligible"
        : "No roster availability",
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
}): StaffLifecycleBlocker[] {
  const blockers: StaffLifecycleBlocker[] = [];
  const onboardingHref = buildOnboardingCentreHrefForTenant(input.tenantId);
  const accessHref = buildStaffAccessCentreHrefForTenant(input.tenantId);
  const identityHref = buildStaffIdentityAuditHref(input.tenantId);
  const rosterHref = buildWorkforceRosterHref(input.tenantId);
  const entitlementsHref = buildStaffEntitlementsHref(input.tenantId);

  const employment = String(input.employmentStatus ?? "").trim().toLowerCase();
  const suspended = input.systemAccessRevoked || employment === "suspended";

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

  if (input.identityAuditRow?.workspaceProfileStatus === "missing") {
    blockers.push({
      id: "missing_identity_link",
      label: "Missing staff identity link",
      description: "Workspace profile or fi_staff link is missing — review in Identity Audit.",
      href: identityHref,
    });
  }
  if (input.identityAuditRow?.workspaceProfileStatus === "ambiguous") {
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
    blockers.push({
      id: "training_incomplete",
      label: "Training incomplete",
      description: "Assign or complete required training before staff are ready to work.",
      href: onboardingHref,
    });
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
}): StaffLifecycleProgressStage[] {
  const employment = String(input.employmentStatus ?? "").trim().toLowerCase();
  const suspended = input.systemAccessRevoked || employment === "suspended";
  const onboardingComplete =
    input.onboardingInviteStatus === "accepted" && isOnboardingChecklistComplete(input.checklist);
  const accessActive = input.accessRow?.authLoginStatus === "login_active";
  const pinReady =
    input.accessRow != null &&
    String(input.accessRow.pinStatus).toLowerCase().includes("active");
  const readinessReady =
    (input.workforceIntelligence?.readinessScore ?? 0) >= 70 ||
    Boolean(input.workforceIntelligence?.surgeryReady);
  const rosterEligible =
    Boolean(input.workforceIntelligence?.nextShiftLabel) ||
    (input.workforceIntelligence?.readinessScore ?? 0) >= 70;
  const fullyActive = employment === "active" && accessActive && pinReady && readinessReady;

  const stages: StaffLifecycleProgressStage[] = [
    { id: "created", label: "Created", status: "complete" },
    {
      id: "onboarding",
      label: "Onboarding",
      status: onboardingComplete ? "complete" : employment === "pending_onboarding" ? "current" : "upcoming",
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
      status: accessActive && pinReady
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
      status: readinessReady
        ? "complete"
        : accessActive
          ? "current"
          : "upcoming",
      blockReason: input.checklist.trainingPending ? "Training incomplete" : undefined,
    },
    {
      id: "roster_eligible",
      label: "Roster eligible",
      status: rosterEligible
        ? "complete"
        : readinessReady
          ? "current"
          : "upcoming",
      blockReason: !rosterEligible && readinessReady ? "No working hours configured" : undefined,
    },
    {
      id: "active",
      label: "Active",
      status: fullyActive ? "complete" : employment === "active" ? "current" : "upcoming",
      blockReason: employment !== "active" ? `Employment: ${employment.replace(/_/g, " ")}` : undefined,
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
}): StaffLifecycleAction[] {
  const onboardingHref = buildOnboardingCentreHrefForTenant(input.tenantId);
  const accessHref = buildStaffAccessCentreHrefForTenant(input.tenantId);
  const identityHref = buildStaffIdentityAuditHref(input.tenantId);
  const rosterHref = buildWorkforceRosterHref(input.tenantId);
  const entitlementsHref = buildStaffEntitlementsHref(input.tenantId);

  const employment = String(input.employmentStatus ?? "").trim().toLowerCase();
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
        href:
          action.id === "open_access_centre"
            ? accessHref
            : onboardingHref,
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
    {
      id: "view_profile",
      label: "Open Identity Audit",
      href: identityHref,
      priority: "secondary",
    },
  ];

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
    id: "view_profile",
    label: "Open roster",
    href: rosterHref,
    priority: "secondary",
  });

  for (const link of linkActions) {
    if (!actions.some((a) => a.label === link.label)) {
      actions.push(link);
    }
  }

  return actions.slice(0, 8);
}

export function buildStaffProfileOverviewModel(input: {
  tenantId: string;
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
}): StaffProfileOverviewModel {
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
    }),
    blockers: resolveStaffLifecycleBlockers({
      tenantId: input.tenantId,
      employmentStatus: input.employmentStatus,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus: input.onboardingInviteStatus,
      accessRow: input.accessRow,
      checklist: input.checklist,
      workforceIntelligence: input.workforceIntelligence,
      identityAuditRow: input.identityAuditRow,
    }),
    actions: resolveStaffProfileActions({
      tenantId: input.tenantId,
      employmentStatus: input.employmentStatus,
      email: input.email,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus: input.onboardingInviteStatus,
      hasOnboardingInviteUrl: input.hasOnboardingInviteUrl,
      accessRow: input.accessRow,
      checklist: input.checklist,
    }),
    progressStages: resolveStaffLifecycleProgress({
      employmentStatus: input.employmentStatus,
      archivedAt: input.archivedAt,
      systemAccessRevoked: input.systemAccessRevoked,
      onboardingInviteStatus: input.onboardingInviteStatus,
      checklist: input.checklist,
      accessRow: input.accessRow,
      workforceIntelligence: input.workforceIntelligence,
    }),
  };
}

export { buildStaffProfileHref };
