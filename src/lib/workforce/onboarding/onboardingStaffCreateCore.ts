import {
  normalizeEmail,
  reconcileInboundStaffIdentity,
  type InboundStaffIdentity,
  type ReconcileInboundStaffIdentityResult,
} from "@/src/lib/workforce/identityReconciliationCore";
import type {
  IdentityLinkSnapshot,
  StaffMemberSnapshot,
} from "@/src/lib/workforce/identityReconciliationCore";

export const ONBOARDING_STAFF_SOURCE = "workforce_os_onboarding_centre" as const;

export const ONBOARDING_AUDIT_SOURCE = ONBOARDING_STAFF_SOURCE;

export type OnboardingStaffCreationDecision =
  | { action: "create" }
  | { action: "reject"; message: string };

export function buildOnboardingInboundIdentity(input: {
  email: string;
  fullName: string;
}): InboundStaffIdentity {
  const email = normalizeEmail(input.email) ?? input.email.trim().toLowerCase();
  return {
    sourceSystem: ONBOARDING_STAFF_SOURCE,
    externalId: email,
    email,
    fullName: input.fullName.trim(),
  };
}

export function resolveOnboardingStaffCreationDecision(
  reconcile: ReconcileInboundStaffIdentityResult
): OnboardingStaffCreationDecision {
  if (reconcile.requiresManualReview) {
    return {
      action: "reject",
      message:
        reconcile.conflictReason ??
        "This staff identity requires manual review before onboarding.",
    };
  }

  if (reconcile.staffMemberId) {
    return {
      action: "reject",
      message: "A staff member with this email already exists in this workspace.",
    };
  }

  if (!reconcile.shouldCreate) {
    return {
      action: "reject",
      message: "A staff member with this email already exists in this workspace.",
    };
  }

  return { action: "create" };
}

export function evaluateOnboardingStaffCreation(input: {
  tenantId: string;
  email: string;
  fullName: string;
  staffMembers: StaffMemberSnapshot[];
  identityLinks: IdentityLinkSnapshot[];
}): OnboardingStaffCreationDecision {
  const inbound = buildOnboardingInboundIdentity({
    email: input.email,
    fullName: input.fullName,
  });
  const reconcile = reconcileInboundStaffIdentity({
    tenantId: input.tenantId,
    inbound,
    staffMembers: input.staffMembers,
    identityLinks: input.identityLinks,
  });
  return resolveOnboardingStaffCreationDecision(reconcile);
}
