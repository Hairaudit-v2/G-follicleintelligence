"use client";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PilotControlOverview } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { canShowActivationReadiness } from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";

export type PilotActivationSectionProps = {
  overview: PilotControlOverview | null | undefined;
  role: PilotControlRoleKey;
};

/**
 * 1B read-only activation readiness surface.
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

  const fieldEntries = Object.entries(gate.fields);

  return (
    <section className="space-y-3" aria-labelledby="pilot-activation-heading">
      <SectionHeader
        kicker="Governance"
        title="Pilot Activation Readiness"
        description="Read-only gate status. Approvals are recorded outside this UI; invitations stay disabled until an explicit human decision."
      />

      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-slate-400">Eligible for governance review</div>
          <div className="mt-1 text-sm text-slate-100">
            {gate.eligibleForGovernanceReview ? "Yes" : "No"}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-slate-400">Approved for initial invites</div>
          <div className="mt-1 text-sm text-slate-100">
            {gate.approvedForInitialInvites ? "Yes" : "No — human decision required"}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="text-slate-400">Gate version</div>
          <div className="mt-1 text-sm text-slate-100">{gate.version}</div>
        </div>
      </div>

      <ul className="grid gap-1 sm:grid-cols-2 text-xs text-slate-300">
        {fieldEntries.map(([key, value]) => (
          <li key={key} className="flex items-center justify-between gap-2 border-b border-white/5 py-1">
            <span className="text-slate-400">{formatField(key)}</span>
            <span className={value ? "text-emerald-300/90" : "text-amber-200/90"}>
              {value ? "Complete" : "Pending"}
            </span>
          </li>
        ))}
      </ul>

      {gate.blockers.length > 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
          <div className="font-medium text-amber-100">Current blockers</div>
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
          Warnings: {gate.warnings.join("; ")}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Recommendation:{" "}
        {gate.approvedForInitialInvites
          ? "Human invite enablement may proceed through the audited write path."
          : gate.eligibleForGovernanceReview
            ? "Technical evidence ready — submit for named clinical, privacy, operations, and director review."
            : "Complete outstanding software and human gates before governance review."}{" "}
        Formal production remains NO-GO. Stripe remains disabled.
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
