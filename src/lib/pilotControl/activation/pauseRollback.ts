/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — pause recommendation + rollback preservation (pure).
 */

import {
  ROLLBACK_PRESERVED_RECORD_CLASSES,
  type RollbackPreservedRecordClass,
} from "./activationTypes";
import { programmePauseStopsNewInvitations } from "./activationState";
import type { PilotActivationState } from "./activationTypes";

export type PauseTrigger =
  | "critical_identity_issue"
  | "cross_tenant_concern"
  | "wrong_patient_record"
  | "wrong_patient_payment"
  | "wrong_patient_consent"
  | "incorrect_readiness_affecting_care"
  | "material_privacy_incident"
  | "repeated_system_wide_failure"
  | "inability_to_support_safely"
  | "governance_approval_withdrawn";

export type PauseRecommendation = {
  recommendPause: boolean;
  triggers: PauseTrigger[];
  severity: "critical" | "high" | "none";
  stopNewInvitations: boolean;
  humanActionRequired: true;
};

export function evaluatePilotPauseRecommendation(args: {
  triggers: readonly PauseTrigger[];
  activationState: PilotActivationState;
}): PauseRecommendation {
  const criticalSet = new Set<PauseTrigger>([
    "critical_identity_issue",
    "cross_tenant_concern",
    "wrong_patient_record",
    "wrong_patient_payment",
    "wrong_patient_consent",
    "incorrect_readiness_affecting_care",
    "material_privacy_incident",
    "repeated_system_wide_failure",
    "inability_to_support_safely",
    "governance_approval_withdrawn",
  ]);

  const triggers = args.triggers.filter((t) => criticalSet.has(t));
  const recommendPause = triggers.length > 0;

  return {
    recommendPause,
    triggers: [...triggers],
    severity: recommendPause ? "critical" : "none",
    stopNewInvitations:
      recommendPause || programmePauseStopsNewInvitations(args.activationState),
    humanActionRequired: true,
  };
}

export function mayDeleteOnRollback(
  recordClass: RollbackPreservedRecordClass | string
): boolean {
  return !(ROLLBACK_PRESERVED_RECORD_CLASSES as readonly string[]).includes(
    recordClass
  );
}

export type RollbackPlan = {
  mayReset: readonly string[];
  mustPreserve: readonly RollbackPreservedRecordClass[];
  preservesEvidence: true;
};

export function buildPilotRollbackPlan(): RollbackPlan {
  return {
    mayReset: [
      "programme_activation_state",
      "invitation_enablement_flag",
      "pilot_ui_visibility_flag",
      "event_emitter_enablement",
      "external_integration_settings",
      "notification_settings",
    ],
    mustPreserve: [...ROLLBACK_PRESERVED_RECORD_CLASSES],
    preservesEvidence: true,
  };
}

/** Soft invitation controls — never bulk, always confirmable. */
export type InvitationSafeguards = {
  maxInitialInviteCount: number;
  oneByOneOnly: true;
  bulkInvitationForbidden: true;
  requiresExplicitConfirmation: true;
  cohortLimitEnforced: true;
  auditEventRequired: true;
  canDisableImmediately: true;
  invitationsEnabledByDefault: false;
};

export function getInitialInvitationSafeguards(
  maxInitialInviteCount = 5
): InvitationSafeguards {
  return {
    maxInitialInviteCount,
    oneByOneOnly: true,
    bulkInvitationForbidden: true,
    requiresExplicitConfirmation: true,
    cohortLimitEnforced: true,
    auditEventRequired: true,
    canDisableImmediately: true,
    invitationsEnabledByDefault: false,
  };
}

export function mayIssueInvitation(args: {
  activationState: PilotActivationState;
  humanApprovedForInitialInvites: boolean;
  candidateApproved: boolean;
  identityPreflightPass: boolean;
  operationalPreflightPass: boolean;
  humanClinicalApproval: boolean;
  patientPilotConsentReady: boolean;
  criticalBlockerOpen: boolean;
  namedOwnerPresent: boolean;
  supportCoverageActive: boolean;
  invitesEnabled: boolean;
  currentInviteCount: number;
  maxInvites: number;
}): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!args.invitesEnabled) reasons.push("invites_disabled");
  if (
    args.activationState !== "approved_for_initial_invites" &&
    args.activationState !== "initial_cohort_active"
  ) {
    reasons.push(`activation_state:${args.activationState}`);
  }
  if (!args.humanApprovedForInitialInvites) reasons.push("human_invite_approval_required");
  if (!args.candidateApproved) reasons.push("candidate_not_approved");
  if (!args.identityPreflightPass) reasons.push("identity_preflight_failed");
  if (!args.operationalPreflightPass) reasons.push("operational_preflight_failed");
  if (!args.humanClinicalApproval) reasons.push("clinical_approval_required");
  if (!args.patientPilotConsentReady) reasons.push("patient_pilot_consent_not_ready");
  if (args.criticalBlockerOpen) reasons.push("critical_blocker_open");
  if (!args.namedOwnerPresent) reasons.push("named_owner_required");
  if (!args.supportCoverageActive) reasons.push("support_coverage_inactive");
  if (args.currentInviteCount >= args.maxInvites) reasons.push("invite_limit_reached");

  return { allowed: reasons.length === 0, reasons };
}
