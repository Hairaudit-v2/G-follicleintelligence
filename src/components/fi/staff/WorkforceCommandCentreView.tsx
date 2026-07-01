"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { StatCard } from "@/src/components/fi-admin/dashboard-ui/StatCard";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import type { StaffDirectoryRowView } from "@/src/lib/staff/staffDirectoryFilters";
import type { WorkforceOperationalMetrics } from "@/src/lib/workforce/workforceOperationalMetrics.server";
import {
  WORKFORCE_ROLE_SEGMENTS,
  buildWorkforceAttentionQueue,
  buildWorkforceCommandCentreMetrics,
  buildWorkforceIntelligencePanel,
  complianceStatusPillClass,
  filterStaffByRoleSegment,
  formatComplianceStatusLabel,
  formatReadinessScore,
  readinessScorePillClass,
  resolveStaffWorkforceIntelligence,
  type StaffWorkforceIntelligence,
  type WorkforceRoleSegmentId,
} from "@/src/lib/staff/workforceCommandCentre";
import { cn } from "@/lib/utils";

export type WorkforceCommandCentreViewProps = {
  base: string;
  canManage: boolean;
  showTwinLinks: boolean;
  viewerStaffId: string | null;
  /** Full tenant staff list for metrics and attention queue. */
  allRows: StaffDirectoryRowView[];
  /** Rows after URL/search filters — role segment is applied on top for the directory. */
  directoryRows: StaffDirectoryRowView[];
  intelligenceByStaffId: Record<string, StaffWorkforceIntelligence | undefined>;
  operationalMetrics?: WorkforceOperationalMetrics | null;
  roleSegment: WorkforceRoleSegmentId;
  onRoleSegmentChange: (segment: WorkforceRoleSegmentId) => void;
  onAddStaff: () => void;
  onEditStaff: (row: StaffDirectoryRowView) => void;
};

function OperationalCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-white/[0.08] bg-[#0c1426]/70 p-4 transition-colors hover:border-[#22C1FF]/30 hover:bg-[#0c1426]"
    >
      <p className="text-xs uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{value}</p>
    </Link>
  );
}

function StatusPill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}

function StaffDirectoryCard({
  row,
  intel,
  base,
  canManage,
  showTwinLinks,
  viewerStaffId,
  onEdit,
}: {
  row: StaffDirectoryRowView;
  intel: StaffWorkforceIntelligence;
  base: string;
  canManage: boolean;
  showTwinLinks: boolean;
  viewerStaffId: string | null;
  onEdit: () => void;
}) {
  const canViewTwin = canManage || row.id === viewerStaffId;

  return (
    <article
      className={cn(
        "rounded-xl border border-white/[0.07] bg-[#0c1426]/70 p-4 transition-colors",
        !row.is_active && "opacity-75",
        row.needsReview && "border-amber-500/25 bg-amber-500/[0.04]"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full border border-white/10"
            style={{ backgroundColor: row.calendar_color?.trim() || "#64748b" }}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="truncate font-medium text-[#F8FAFC]">{row.full_name}</h3>
            <p className="mt-0.5 text-sm capitalize text-[#94A3B8]">
              {row.staff_role.replace(/_/g, " ")}
            </p>
            {row.email ? <p className="mt-1 truncate text-xs text-[#64748B]">{row.email}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <StatusPill
            className={
              row.is_active
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
                : "bg-slate-500/15 text-slate-400 ring-slate-500/20"
            }
          >
            {row.is_active ? "Active" : "Inactive"}
          </StatusPill>
          {row.needsReview ? (
            <StatusPill className="bg-amber-500/15 text-amber-200 ring-amber-500/25">
              Needs review
            </StatusPill>
          ) : null}
          {intel.readinessBandLabel ? (
            <StatusPill className={readinessScorePillClass(intel.readinessScore)}>
              {intel.readinessBandLabel}
            </StatusPill>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#64748B]">Readiness</dt>
          <dd className="mt-1">
            <StatusPill className={readinessScorePillClass(intel.readinessScore)}>
              {formatReadinessScore(intel.readinessScore)}
            </StatusPill>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#64748B]">Compliance</dt>
          <dd className="mt-1">
            <StatusPill className={complianceStatusPillClass(intel.complianceStatus)}>
              {formatComplianceStatusLabel(intel.complianceStatus)}
            </StatusPill>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#64748B]">Training</dt>
          <dd className="mt-1 text-[#CBD5E1]">{intel.trainingProgressLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#64748B]">Next shift</dt>
          <dd className="mt-1 text-[#CBD5E1]">{intel.nextShiftLabel ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
        {canViewTwin && showTwinLinks ? (
          <Link
            href={`${base}/staff/${row.id}/twin`}
            className="text-xs font-medium text-[#22C1FF] hover:text-[#5DD4FF]"
          >
            View
          </Link>
        ) : (
          <span className="text-xs text-[#64748B]">View</span>
        )}
        {canManage ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-[#22C1FF] hover:text-[#5DD4FF]"
          >
            Edit
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function WorkforceCommandCentreView({
  base,
  canManage,
  showTwinLinks,
  viewerStaffId,
  allRows,
  directoryRows,
  intelligenceByStaffId,
  operationalMetrics,
  roleSegment,
  onRoleSegmentChange,
  onAddStaff,
  onEditStaff,
}: WorkforceCommandCentreViewProps) {
  const metrics = buildWorkforceCommandCentreMetrics(allRows, intelligenceByStaffId);
  const panel = buildWorkforceIntelligencePanel(allRows, intelligenceByStaffId, metrics);
  const attentionQueue = buildWorkforceAttentionQueue(allRows, intelligenceByStaffId);
  const segmentRows = filterStaffByRoleSegment(directoryRows, roleSegment);

  const displayAverageReadiness = metrics.averageReadinessScore;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">
            WorkforceOS · Settings
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC]">
            Workforce Command Centre
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
            Manage clinical readiness, compliance, permissions and workforce allocation.
          </p>
          <p className="text-xs text-[#64748B]">
            <Link href={base} className="text-[#22C1FF] hover:underline">
              ← Dashboard
            </Link>
            {canManage ? (
              <>
                <span className="mx-2">·</span>
                <Link
                  href={`${base}/hr/staff-readiness`}
                  className="text-[#22C1FF] hover:underline"
                >
                  Staff readiness
                </Link>
                <span className="mx-2">·</span>
                <Link href={`${base}/hr-os`} className="text-[#22C1FF] hover:underline">
                  HR OS
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="border-white/[0.12] bg-transparent text-[#CBD5E1] hover:bg-white/[0.06] hover:text-[#F8FAFC]"
                asChild
              >
                <Link href={`${base}/hr/staff-readiness`}>Assign training</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/[0.12] bg-transparent text-[#CBD5E1] hover:bg-white/[0.06] hover:text-[#F8FAFC]"
                asChild
              >
                <Link href={`${base}/hr/sync-health`}>View compliance issues</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/[0.12] bg-transparent text-[#CBD5E1] hover:bg-white/[0.06] hover:text-[#F8FAFC]"
                asChild
              >
                <Link href={`${base}/staff/role-review`}>Manage roles</Link>
              </Button>
              <Button type="button" onClick={onAddStaff} data-testid="add-staff-button">
                Add staff
              </Button>
            </>
          ) : (
            <p className="text-xs text-[#64748B]">
              View only — admin or fi_admin can add or edit staff.
            </p>
          )}
        </div>
      </header>

      <section aria-label="Workforce metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total staff" value={metrics.totalStaff} />
        <StatCard label="Active staff" value={metrics.activeStaff} />
        <StatCard label="Pending onboarding" value={metrics.pendingOnboarding} />
        <StatCard label="Compliance issues" value={metrics.complianceIssues} />
        <StatCard
          label="Avg readiness score"
          value={displayAverageReadiness != null ? `${displayAverageReadiness}%` : "—"}
        />
      </section>

      {operationalMetrics ? (
        <section
          aria-label="HR operational control"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <OperationalCard
            label="Sync Health"
            value={
              operationalMetrics.syncHealthPercent != null
                ? `${operationalMetrics.syncHealthPercent}%`
                : "—"
            }
            href={`${base}/hr-os/sync-health`}
          />
          <OperationalCard
            label="Duplicate Conflicts"
            value={operationalMetrics.openDuplicateCount}
            href={`${base}/hr-os/duplicates`}
          />
          <OperationalCard
            label="Unlinked Staff"
            value={operationalMetrics.unlinkedStaffCount}
            href={`${base}/hr-os/staff-reconciliation`}
          />
          <OperationalCard
            label="Inactive Staff"
            value={operationalMetrics.inactiveStaffCount}
            href={`${base}/hr-os/offboarding`}
          />
        </section>
      ) : null}

      <DashboardCard className="p-5 sm:p-6" elevated>
        <h2 className="text-sm font-semibold text-[#F8FAFC]">Workforce intelligence</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Operational readiness snapshot across your active workforce.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">Workforce readiness</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">
              {panel.workforceReadinessScore != null ? `${panel.workforceReadinessScore}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">Surgery-ready</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">
              {panel.surgeryReadyCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">Training required</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">
              {panel.trainingRequiredCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">Compliance attention</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-rose-300">
              {panel.complianceAttentionCount}
            </dd>
          </div>
        </dl>
        <p className="mt-5 rounded-lg border border-[#22C1FF]/20 bg-[#22C1FF]/5 px-4 py-3 text-sm text-[#CBD5E1]">
          <span className="font-medium text-[#22C1FF]">Next action · </span>
          {panel.nextAction}
        </p>
      </DashboardCard>

      <section aria-label="Role filters">
        <div className="flex flex-wrap gap-2">
          {WORKFORCE_ROLE_SEGMENTS.map((segment) => (
            <button
              key={segment.id}
              type="button"
              onClick={() => onRoleSegmentChange(segment.id)}
              aria-pressed={roleSegment === segment.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                roleSegment === segment.id
                  ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
                  : "border-white/[0.08] bg-[#0c1426]/60 text-[#94A3B8] hover:border-white/[0.14] hover:text-[#CBD5E1]"
              )}
            >
              {segment.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#64748B]">
          Showing {segmentRows.length} of {directoryRows.length} staff
          {directoryRows.length !== allRows.length ? ` (${allRows.length} total)` : ""}
        </p>
      </section>

      <section aria-label="Staff directory">
        <h2 className="text-sm font-semibold text-[#F8FAFC]">Staff directory</h2>
        {segmentRows.length === 0 ? (
          <DashboardCard className="mt-3 p-8 text-center">
            <p className="text-sm text-[#94A3B8]">
              {directoryRows.length === 0
                ? allRows.length === 0
                  ? "No staff rows yet. Add your first team member to begin."
                  : "No staff match the current filters."
                : "No staff match the current role filter."}
            </p>
          </DashboardCard>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {segmentRows.map((row) => (
              <StaffDirectoryCard
                key={row.id}
                row={row}
                intel={resolveStaffWorkforceIntelligence(row, intelligenceByStaffId[row.id])}
                base={base}
                canManage={canManage}
                showTwinLinks={showTwinLinks}
                viewerStaffId={viewerStaffId}
                onEdit={() => onEditStaff(row)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Needs attention">
        <h2 className="text-sm font-semibold text-[#F8FAFC]">Needs attention</h2>
        {attentionQueue.length === 0 ? (
          <DashboardCard className="mt-3 p-6 text-center">
            <p className="text-sm text-[#94A3B8]">All active staff are operationally clear.</p>
          </DashboardCard>
        ) : (
          <ul className="mt-3 space-y-2">
            {attentionQueue.map((item) => (
              <li key={item.staffId}>
                <DashboardCard className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-[#F8FAFC]">{item.fullName}</p>
                    <p className="text-xs capitalize text-[#64748B]">
                      {item.staffRole.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill className="bg-amber-500/15 text-amber-200 ring-amber-500/25">
                      {item.primaryLabel}
                    </StatusPill>
                    {canManage ? (
                      <Link
                        href={`${base}/staff/${item.staffId}/twin`}
                        className="text-xs font-medium text-[#22C1FF] hover:underline"
                      >
                        Review
                      </Link>
                    ) : null}
                  </div>
                </DashboardCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
