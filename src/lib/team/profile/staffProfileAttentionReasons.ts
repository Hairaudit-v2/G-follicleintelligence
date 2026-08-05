/**
 * Aggregate prioritised profile attention while preserving originating domain.
 */

import { STAFF_ACCESS_ATTENTION_LABELS } from "@/src/lib/team/access/types";
import type { StaffAccessEntry } from "@/src/lib/team/access/types";
import { STAFF_COMPLIANCE_ATTENTION_LABELS } from "@/src/lib/team/compliance/types";
import type { StaffComplianceEntry } from "@/src/lib/team/compliance/types";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { STAFF_ONBOARDING_ATTENTION_LABELS } from "@/src/lib/team/onboarding/types";
import type { StaffOnboardingEntry } from "@/src/lib/team/onboarding/types";
import { ROSTER_STAFF_ATTENTION_LABELS } from "@/src/lib/team/roster/types";
import type { RosterStaffEntry } from "@/src/lib/team/roster/types";
import type {
  StaffProfileAttentionReason,
  StaffProfileAttentionSeverity,
} from "@/src/lib/team/profile/types";

const SEVERITY_RANK: Record<StaffProfileAttentionSeverity, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

const IDENTITY_PRIORITY = [
  "cross_tenant_mismatch",
  "identity_invalid",
  "identity_requires_reconciliation",
  "lifecycle_record_missing",
  "scheduling_record_missing",
  "identity_link_incomplete",
  "missing_auth_identity",
] as const;

function severityForIdentityCode(code: string): StaffProfileAttentionSeverity {
  if (
    code === "cross_tenant_mismatch" ||
    code === "identity_invalid" ||
    code === "identity_requires_reconciliation"
  ) {
    return "blocking";
  }
  if (code === "missing_auth_identity") return "info";
  return "warning";
}

function severityForAccessCode(code: string): StaffProfileAttentionSeverity {
  if (
    code === "cross_tenant_mismatch" ||
    code === "identity_invalid" ||
    code === "identity_requires_reconciliation" ||
    code === "terminated_with_active_access"
  ) {
    return "blocking";
  }
  if (code === "missing_auth_identity") return "info";
  return "warning";
}

function severityForOnboardingCode(code: string): StaffProfileAttentionSeverity {
  if (
    code === "cross_tenant_mismatch" ||
    code === "identity_invalid" ||
    code === "identity_requires_reconciliation"
  ) {
    return "blocking";
  }
  if (code === "onboarding_invite_expired") return "warning";
  if (code === "login_active_onboarding_incomplete") return "warning";
  return "info";
}

function severityForRosterCode(code: string): StaffProfileAttentionSeverity {
  if (
    code === "cross_tenant_mismatch" ||
    code === "identity_invalid" ||
    code === "identity_requires_reconciliation" ||
    code === "employment_blocks_new_assignment"
  ) {
    return "blocking";
  }
  return "warning";
}

function severityForComplianceCode(code: string): StaffProfileAttentionSeverity {
  if (
    code === "cross_tenant_mismatch" ||
    code === "identity_invalid" ||
    code === "identity_requires_reconciliation" ||
    code === "credentials_expired" ||
    code === "certifications_incomplete"
  ) {
    return "blocking";
  }
  if (code === "credentials_expiring_soon") return "warning";
  return "warning";
}

function pushUnique(
  out: StaffProfileAttentionReason[],
  seen: Set<string>,
  reason: StaffProfileAttentionReason
): void {
  const key = `${reason.source}:${reason.code}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(reason);
}

/**
 * Build one prioritised profile attention list from identity + domain projections.
 * Does not invent new policy codes — only remaps existing domain / identity reasons.
 */
export function deriveStaffProfileAttentionReasons(input: {
  identity: StaffIdentity;
  access: StaffAccessEntry | null;
  onboarding: StaffOnboardingEntry | null;
  roster: RosterStaffEntry | null;
  compliance: StaffComplianceEntry | null;
  hrefs?: {
    identityAudit?: string | null;
    access?: string | null;
    onboarding?: string | null;
    roster?: string | null;
    compliance?: string | null;
  };
}): StaffProfileAttentionReason[] {
  const hrefs = input.hrefs ?? {};
  const seen = new Set<string>();
  const out: StaffProfileAttentionReason[] = [];

  const { linkStatus } = input.identity.integrity;
  if (linkStatus === "cross_tenant_mismatch") {
    pushUnique(out, seen, {
      source: "identity",
      code: "cross_tenant_mismatch",
      severity: "blocking",
      label: "Cross-tenant identity mismatch",
      href: hrefs.identityAudit ?? null,
    });
  } else if (linkStatus === "invalid") {
    pushUnique(out, seen, {
      source: "identity",
      code: "identity_invalid",
      severity: "blocking",
      label: "Identity invalid",
      href: hrefs.identityAudit ?? null,
    });
  } else if (linkStatus === "ambiguous") {
    pushUnique(out, seen, {
      source: "identity",
      code: "identity_requires_reconciliation",
      severity: "blocking",
      label: "Identity requires reconciliation",
      href: hrefs.identityAudit ?? null,
    });
  } else if (linkStatus === "scheduling_only") {
    pushUnique(out, seen, {
      source: "identity",
      code: "lifecycle_record_missing",
      severity: "warning",
      label: "Lifecycle record missing",
      href: hrefs.identityAudit ?? null,
    });
    pushUnique(out, seen, {
      source: "identity",
      code: "identity_link_incomplete",
      severity: "warning",
      label: "Identity link incomplete",
      href: hrefs.identityAudit ?? null,
    });
  } else if (linkStatus === "lifecycle_only") {
    pushUnique(out, seen, {
      source: "identity",
      code: "scheduling_record_missing",
      severity: "warning",
      label: "Scheduling record missing",
      href: hrefs.identityAudit ?? null,
    });
    pushUnique(out, seen, {
      source: "identity",
      code: "identity_link_incomplete",
      severity: "warning",
      label: "Identity link incomplete",
      href: hrefs.identityAudit ?? null,
    });
  }

  if (
    linkStatus === "linked" &&
    !input.identity.integrity.hasAuthIdentity &&
    input.identity.accessStatus !== "revoked"
  ) {
    pushUnique(out, seen, {
      source: "identity",
      code: "missing_auth_identity",
      severity: "info",
      label: "No auth user linked yet",
      href: hrefs.access ?? null,
    });
  }

  for (const code of input.access?.attentionReasons ?? []) {
    pushUnique(out, seen, {
      source: "access",
      code,
      severity: severityForAccessCode(code),
      label: STAFF_ACCESS_ATTENTION_LABELS[code],
      href: hrefs.access ?? null,
    });
  }

  for (const code of input.onboarding?.attentionReasons ?? []) {
    pushUnique(out, seen, {
      source: "onboarding",
      code,
      severity: severityForOnboardingCode(code),
      label: STAFF_ONBOARDING_ATTENTION_LABELS[code],
      href: hrefs.onboarding ?? null,
    });
  }

  for (const code of input.roster?.attentionReasons ?? []) {
    pushUnique(out, seen, {
      source: "roster",
      code,
      severity: severityForRosterCode(code),
      label: ROSTER_STAFF_ATTENTION_LABELS[code],
      href: hrefs.roster ?? null,
    });
  }

  for (const code of input.compliance?.attentionReasons ?? []) {
    pushUnique(out, seen, {
      source: "compliance",
      code,
      severity: severityForComplianceCode(code),
      label: STAFF_COMPLIANCE_ATTENTION_LABELS[code],
      href: hrefs.compliance ?? null,
    });
  }

  return out.sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    const aIdentity = a.source === "identity" ? 0 : 1;
    const bIdentity = b.source === "identity" ? 0 : 1;
    if (aIdentity !== bIdentity) return aIdentity - bIdentity;
    const aIdx = IDENTITY_PRIORITY.indexOf(a.code as (typeof IDENTITY_PRIORITY)[number]);
    const bIdx = IDENTITY_PRIORITY.indexOf(b.code as (typeof IDENTITY_PRIORITY)[number]);
    if (aIdx >= 0 || bIdx >= 0) {
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    }
    return a.code.localeCompare(b.code);
  });
}

export function severityForStaffProfileAttention(
  reason: StaffProfileAttentionReason
): StaffProfileAttentionSeverity {
  return reason.severity;
}
