/**
 * Derive Command Centre workforce KPIs from composed person summaries.
 * Definitions are behaviour-neutral vs legacy directory / operational metrics.
 */

import type {
  CommandCentreStaffSummary,
  TeamCommandCentreKpis,
} from "@/src/lib/team/commandCentre/types";

const TERMINATED = new Set(["terminated", "resigned", "contract_ended", "contract_expired"]);

function isCrossTenant(summary: CommandCentreStaffSummary): boolean {
  return summary.identity.integrity.linkStatus === "cross_tenant_mismatch";
}

function isInvalid(summary: CommandCentreStaffSummary): boolean {
  return summary.identity.integrity.linkStatus === "invalid";
}

function isTerminatedOrArchived(summary: CommandCentreStaffSummary): boolean {
  if (summary.identity.archivedAt) return true;
  return TERMINATED.has(String(summary.identity.employmentStatus ?? "").toLowerCase());
}

/**
 * Counts that feed workforce totals — excludes cross-tenant and invalid-without-repair.
 * Invalid identities are retained only when they carry actionable attention.
 */
export function isInWorkforceHeadcount(summary: CommandCentreStaffSummary): boolean {
  if (isCrossTenant(summary)) return false;
  if (isInvalid(summary) && summary.attentionReasons.length === 0) return false;
  if (isTerminatedOrArchived(summary)) return false;
  return true;
}

export function isActiveWorkforce(summary: CommandCentreStaffSummary): boolean {
  if (!isInWorkforceHeadcount(summary)) return false;
  const status = String(summary.identity.employmentStatus ?? "").toLowerCase();
  return status === "active" || status === "on_leave" || status === "suspended";
}

export function composeCommandCentreKpis(
  staff: readonly CommandCentreStaffSummary[]
): TeamCommandCentreKpis {
  let totalStaff = 0;
  let activeStaff = 0;
  let onboardingIncomplete = 0;
  let accessPending = 0;
  let credentialIssues = 0;
  let rosterReady = 0;
  let identityReconciliation = 0;
  let attentionRequired = 0;
  let crossTenantIntegrityIssues = 0;

  for (const summary of staff) {
    if (isCrossTenant(summary)) {
      crossTenantIntegrityIssues += 1;
      attentionRequired += 1;
      continue;
    }

    if (isInWorkforceHeadcount(summary)) {
      totalStaff += 1;
    }
    if (isActiveWorkforce(summary)) {
      activeStaff += 1;
    }

    const onboardingStatus = summary.onboarding?.onboardingStatus;
    if (
      onboardingStatus &&
      onboardingStatus !== "completed" &&
      onboardingStatus !== "cancelled"
    ) {
      onboardingIncomplete += 1;
    }

    if (
      summary.access?.accessStatus === "invite_pending" ||
      summary.access?.accessStatus === "not_invited"
    ) {
      // Count pending/not-invited among headcount only when employed (not terminated).
      if (isInWorkforceHeadcount(summary)) accessPending += 1;
    }

    const cred = summary.compliance?.credentials;
    if (cred && (cred.expired > 0 || cred.expiringSoon > 0)) {
      credentialIssues += 1;
    } else if (
      summary.attentionReasons.some(
        (r) =>
          r.source === "compliance" &&
          (r.code === "credentials_expired" ||
            r.code === "credentials_expiring_soon" ||
            r.code === "certifications_incomplete")
      )
    ) {
      credentialIssues += 1;
    }

    if (summary.roster?.actions.canBeRostered) {
      rosterReady += 1;
    }

    const link = summary.identity.integrity.linkStatus;
    if (
      link === "ambiguous" ||
      link === "scheduling_only" ||
      link === "lifecycle_only" ||
      (link === "linked" && !summary.identity.integrity.hasAuthIdentity)
    ) {
      identityReconciliation += 1;
    }

    if (summary.attentionReasons.some((r) => r.severity === "blocking" || r.severity === "warning")) {
      attentionRequired += 1;
    }
  }

  return {
    totalStaff,
    activeStaff,
    onboardingIncomplete,
    accessPending,
    credentialIssues,
    rosterReady,
    identityReconciliation,
    attentionRequired,
    crossTenantIntegrityIssues,
  };
}
