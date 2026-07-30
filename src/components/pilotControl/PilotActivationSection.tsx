"use client";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PilotControlOverview } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { canShowActivationReadiness } from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";

export type PilotActivationSectionProps = {
  overview: PilotControlOverview | null | undefined;
  role: PilotControlRoleKey;
};

const GOVERNANCE_FIELD_LABELS: Record<string, string> = {
  controlCentreAccepted: "Control Centre accepted",
  migrationsApplied: "Migrations applied",
  tenantIsolationProven: "Tenant isolation proven",
  roleMatrixProven: "Role matrix proven",
  financeRoleMappingCorrect: "Finance role mapping",
  exportSurfaceProven: "Export surface proven",
  identityPreflightProven: "Identity preflight proven",
  financePreflightProven: "Finance preflight proven",
  consentControlsProven: "Consent controls proven",
  eventCoverageSufficient: "Minimum event coverage",
  teamBriefingCompleted: "Combined pilot briefing + staff acknowledgement",
  clinicalWorkflowConfirmed: "Clinical workflow confirmed",
  financeWorkflowConfirmed: "Finance workflow confirmed",
  supportContactConfirmed: "Support contact confirmed",
  fallbackConfirmed: "Fallback / pause confirmed",
  directorApproval: "Director approval",
  operationalSopApproved: "SOP approval",
  staffTrainingCompleted: "Staff training completion",
  supportCoverageConfirmed: "Support coverage",
  incidentResponseConfirmed: "Tabletop / incident response",
  manualFallbackConfirmed: "Manual fallback",
  rollbackConfirmed: "Rollback confirmed",
  patientPilotConsentApproved: "Patient pilot consent approval",
  clinicalGovernanceApproved: "Clinical governance approval",
  privacyApproved: "Privacy approval",
  financeApproved: "Finance approval",
  initialPathwayApproved: "Initial pathway approval",
  initialCohortApproved: "Initial cohort approval",
  formalPrivacyCommitteeApproval: "Formal privacy committee approval",
  multiClinicGovernanceConfirmed: "Multi-clinic governance",
  enterpriseIncidentExerciseConfirmed: "Enterprise incident exercise",
  enterpriseSegregationOfDutiesConfirmed: "Segregation of duties",
  enterpriseIntegrationApprovalsConfirmed: "Integration-specific approvals",
  enterpriseStagedRolloutApproved: "Staged rollout decision",
};

const TIER_LABELS: Record<string, string> = {
  small_team_pilot: "Small team pilot",
  standard_tenant: "Standard tenant",
  enterprise_or_high_risk: "Enterprise / high-risk",
};

/**
 * 1B read-only activation readiness surface (tiered governance).
 * No approval controls — human approvals remain in the governance process.
 */
export function PilotActivationSection({ overview, role }: PilotActivationSectionProps) {
  if (!canShowActivationReadiness(role)) return null;

  const gate = overview?.activationGate;
  if (!gate) {
    return (
      <section className="space-y-2" aria-labelledby="pilot-activation-heading">
        <SectionHeader
          kicker="Governance"
          title="Pilot Activation Readiness"
          description="Activation gate unavailable for this session."
        />
      </section>
    );
  }

  const tier = gate.governanceTier ?? "standard_tenant";
  const applicability = gate.fieldApplicability ?? {};
  const requiredHuman = new Set(gate.requiredHumanFields ?? []);
  const fieldEntries = Object.entries(gate.fields);
  const recommendation = gate.approvedForInitialInvites
    ? "approve_invites"
    : gate.eligibleForGovernanceReview
      ? "defer"
      : "hold_technical";

  return (
    <section className="space-y-3" aria-labelledby="pilot-activation-heading">
      <SectionHeader
        kicker="Governance"
        title="Pilot Activation Readiness"
        description="Read-only gate status. Approvals are recorded outside this UI; invitations stay disabled until an explicit human decision."
      />

      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-slate-400">Governance tier</div>
          <div className="mt-1 text-sm text-slate-100">
            {TIER_LABELS[tier] ?? tier}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-slate-400">Eligible for governance review</div>
          <div className="mt-1 text-sm text-slate-100">
            {gate.eligibleForGovernanceReview ? "Eligible for governance review" : "Not yet eligible"}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-slate-400">Approved for initial invites</div>
          <div className="mt-1 text-sm text-slate-100">
            {gate.approvedForInitialInvites
              ? "Yes"
              : "Not approved for initial invitations"}
          </div>
        </div>
      </div>

      <ul className="grid gap-1 sm:grid-cols-2 text-xs text-slate-300">
        {fieldEntries.map(([key, value]) => {
          const kind =
            applicability[key] ??
            (requiredHuman.has(key)
              ? "required"
              : key in GOVERNANCE_FIELD_LABELS && !key.startsWith("control")
                ? "required"
                : "software");
          const isHuman = kind === "required" || kind === "not_applicable";
          return (
            <li key={key} className="flex items-center justify-between gap-2 border-b border-white/5 py-1">
              <span className="text-slate-400">
                {GOVERNANCE_FIELD_LABELS[key] ?? formatField(key)}
              </span>
              <span
                className={
                  kind === "not_applicable"
                    ? "text-slate-500"
                    : value
                      ? "text-emerald-300/90"
                      : "text-amber-200/90"
                }
              >
                {kind === "not_applicable"
                  ? "Not applicable for this tier"
                  : value
                    ? isHuman
                      ? "Named confirmation recorded"
                      : "Complete"
                    : isHuman
                      ? "Pending named confirmation"
                      : "Pending"}
              </span>
            </li>
          );
        })}
      </ul>

      {tier === "small_team_pilot" ? (
        <p className="text-[11px] text-slate-500">
          Small-team pilot: separate SOP approval, training register, support coverage
          document, privacy committee, and tabletop artefacts are not mandatory. Keep
          those templates for larger tenants; Evolved requires the compact briefing set.
        </p>
      ) : null}

      {gate.blockers.length > 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
          <div className="font-medium text-amber-100">Gate blockers</div>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {gate.blockers.slice(0, 12).map((b) => (
              <li key={b}>{b}</li>
            ))}
            {gate.blockers.length > 12 ? (
              <li>+{gate.blockers.length - 12} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {gate.warnings.length > 0 ? (
        <div className="text-[11px] text-slate-400">
          Gate warnings: {gate.warnings.join("; ")}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Gate version: {gate.version}. Current recommendation:{" "}
        {recommendation === "approve_invites"
          ? "Human invite enablement may proceed through the audited write path."
          : recommendation === "defer"
            ? tier === "small_team_pilot"
              ? "defer — technical evidence ready; small-team briefing confirmations still required."
              : "defer — technical evidence ready; named human approvals still required."
            : "Complete outstanding software gates before governance review."}{" "}
        Formal production remains NO-GO. Stripe remains disabled. Programme remains planned.
      </p>
    </section>
  );
}

function formatField(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
