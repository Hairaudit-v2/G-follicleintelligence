import Link from "next/link";

import { ClinicalStaffingStatusBadge } from "@/src/components/fi/workforce/ClinicalStaffingStatusBadge";
import { formatRequiredRolesLine } from "@/src/lib/workforce-os/clinicalStaffingStatusDisplay";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import {
  buildRosterCommandCentreHref,
  type BuildRosterCommandCentreHrefInput,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";

export type ClinicalStaffingStatusCardProps = {
  tenantId?: string;
  summary: ClinicalStaffingSummaryDto;
  compact?: boolean;
  className?: string;
  rosterLink?: Pick<
    BuildRosterCommandCentreHrefInput,
    "eventSource" | "eventId" | "date" | "status"
  >;
};

function rosterHref(
  tenantId: string,
  summary: ClinicalStaffingSummaryDto,
  rosterLink?: ClinicalStaffingStatusCardProps["rosterLink"]
): string {
  return buildRosterCommandCentreHref({
    tenantId,
    eventSource: rosterLink?.eventSource ?? null,
    eventId: rosterLink?.eventId ?? null,
    date: rosterLink?.date ?? null,
    status: rosterLink?.status ?? (summaryNeedsRoster(summary) ? "missing_roles" : null),
  });
}

function summaryNeedsRoster(summary: ClinicalStaffingSummaryDto): boolean {
  return summary.displayStatus === "missing_roles" || summary.displayStatus === "blocked";
}

export function ClinicalStaffingStatusCard({
  tenantId,
  summary,
  compact,
  className,
  rosterLink,
}: ClinicalStaffingStatusCardProps) {
  const shellClass = compact
    ? "rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
    : "rounded-xl border border-white/[0.08] bg-[#0F1629]/60 p-4";

  return (
    <section className={[shellClass, className].filter(Boolean).join(" ")} aria-label="Clinical staffing status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Staffing readiness</h3>
        <ClinicalStaffingStatusBadge status={summary.displayStatus} compact={compact} />
      </div>

      {!compact ? (
        <p className="mt-2 text-xs text-slate-400">
          WorkforceOS validates required roles, clinical eligibility, and availability for this event.
        </p>
      ) : null}

      <dl className="mt-3 space-y-1.5 text-xs text-slate-400">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="text-slate-500">Required</dt>
          <dd className="text-slate-300">{formatRequiredRolesLine(summary.requiredRoles)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="text-slate-500">Assigned</dt>
          <dd className="text-slate-300">{formatRequiredRolesLine(summary.assignedCounts)}</dd>
        </div>
        {summary.readinessScore > 0 ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-slate-500">Avg readiness</dt>
            <dd className="font-mono text-slate-300">{summary.readinessScore}</dd>
          </div>
        ) : null}
      </dl>

      {summary.missingRoles.length ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-200">
          {summary.missingRoles.map((row) => (
            <li key={row.role}>
              Missing {row.role}: {row.assigned}/{row.required}
            </li>
          ))}
        </ul>
      ) : null}

      {summary.blockedAssignments.length ? (
        <ul className="mt-2 space-y-1 text-xs text-rose-200">
          {summary.blockedAssignments.slice(0, compact ? 2 : 5).map((row) => (
            <li key={`${row.staffId}:${row.role}`}>
              {row.role}: {row.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {summary.warnings.length ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
          {summary.warnings.slice(0, compact ? 2 : 4).map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {tenantId ? (
        <div className="mt-3">
          <Link
            href={rosterHref(tenantId, summary, rosterLink)}
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
          >
            Manage staffing →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
