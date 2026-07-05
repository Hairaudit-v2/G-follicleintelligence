"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { StatCard } from "@/src/components/fi-admin/dashboard-ui/StatCard";
import {
  buildStaffDirectorySearchParams,
  type StaffDirectoryFilterState,
  type StaffDirectoryRowView,
} from "@/src/lib/staff/staffDirectoryFilters";
import {
  buildStaffAccessCentreHref,
  buildStaffDirectoryPrimaryActionHref,
  staffDirectoryLifecycleGuidance,
} from "@/src/lib/workforce/staffLifecycleUxCore";
import { STAFF_LIFECYCLE_LABELS } from "@/src/lib/workforce/staffLifecycleCopy";
import type { WorkforceOperationalMetrics } from "@/src/lib/workforce/workforceOperationalMetrics.server";
import { canonicalStaffLifecyclePillClass } from "@/src/lib/workforce-os/staffCanonicalLifecycle";
import {
  buildWorkforceAttentionQueue,
  buildWorkforceCommandCentreMetrics,
  complianceStatusPillClass,
  formatComplianceStatusLabel,
  formatReadinessScore,
  readinessScorePillClass,
  resolveStaffWorkforceIntelligence,
  type StaffWorkforceIntelligence,
} from "@/src/lib/staff/workforceCommandCentre";
import { cn } from "@/lib/utils";

function StatusPill({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}

function StaffRowCard({
  row,
  intel,
  base,
  workforceOsBase,
  canManage,
  showTwinLinks,
  viewerStaffId,
  onEdit,
}: {
  row: StaffDirectoryRowView;
  intel: StaffWorkforceIntelligence;
  base: string;
  workforceOsBase: string;
  canManage: boolean;
  showTwinLinks: boolean;
  viewerStaffId: string | null;
  onEdit: () => void;
}) {
  const canViewTwin = canManage || row.id === viewerStaffId;

  return (
    <article
      className={cn(
        "rounded-xl border border-white/[0.07] bg-[#0c1426]/60 px-4 py-3 transition-colors hover:border-white/[0.12]",
        !row.isLifecycleActive && "opacity-70",
        row.needsReview && "border-amber-500/20"
      )}
      data-testid={`staff-directory-row-${row.id}`}
      data-lifecycle-status={row.lifecycleStatus}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/10"
            style={{ backgroundColor: row.calendar_color?.trim() || "#64748b" }}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="truncate font-medium text-[#F8FAFC]">{row.full_name}</h3>
            <p className="text-xs capitalize text-[#64748B]">{row.staff_role.replace(/_/g, " ")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill className={canonicalStaffLifecyclePillClass(row.lifecycleStatus)}>
            {row.lifecycleLabel}
          </StatusPill>
          {row.isDuplicate ? (
            <StatusPill
              className="bg-amber-500/15 text-amber-200 ring-amber-500/25"
              title="Another staff record with the same identity is the canonical profile. Do not schedule against this record."
            >
              Duplicate record
            </StatusPill>
          ) : null}
          <StatusPill className={readinessScorePillClass(intel.readinessScore)}>
            {formatReadinessScore(intel.readinessScore)}
          </StatusPill>
          <StatusPill className={complianceStatusPillClass(intel.complianceStatus)}>
            {formatComplianceStatusLabel(intel.complianceStatus)}
          </StatusPill>
        </div>
        <div className="flex shrink-0 gap-3 text-xs">
          <Link
            href={`${workforceOsBase}/staff/${row.id}`}
            className="font-medium text-[#22C1FF] hover:underline"
            data-testid="staff-directory-profile-link"
          >
            Profile
          </Link>
          {canViewTwin && showTwinLinks ? (
            <Link href={`${base}/staff/${row.id}/twin`} className="font-medium text-[#22C1FF] hover:underline">
              View
            </Link>
          ) : null}
          {canManage ? (
            <button type="button" onClick={onEdit} className="font-medium text-[#22C1FF] hover:underline">
              Edit
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function activeFilterHref(
  pathname: string,
  filters: StaffDirectoryFilterState,
  activeFilter: StaffDirectoryFilterState["activeFilter"]
): string {
  const params = buildStaffDirectorySearchParams({ ...filters, activeFilter });
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function StaffDirectorySecondaryView({
  base,
  workforceOsBase,
  canManage,
  showTwinLinks,
  viewerStaffId,
  allRows,
  directoryRows,
  intelligenceByStaffId,
  operationalMetrics,
  filters,
  onEditStaff,
}: {
  base: string;
  workforceOsBase: string;
  canManage: boolean;
  showTwinLinks: boolean;
  viewerStaffId: string | null;
  allRows: StaffDirectoryRowView[];
  directoryRows: StaffDirectoryRowView[];
  intelligenceByStaffId: Record<string, StaffWorkforceIntelligence | undefined>;
  operationalMetrics?: WorkforceOperationalMetrics | null;
  filters?: StaffDirectoryFilterState;
  onEditStaff: (row: StaffDirectoryRowView) => void;
}) {
  const pathname = usePathname();
  const metrics = buildWorkforceCommandCentreMetrics(allRows, intelligenceByStaffId);
  const attentionCount = buildWorkforceAttentionQueue(allRows, intelligenceByStaffId).length;
  const lifecycleCopy = staffDirectoryLifecycleGuidance();
  const onboardingHref = buildStaffDirectoryPrimaryActionHref(base);
  const staffAccessHref = buildStaffAccessCentreHref(base);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Workforce · Directory</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC]">Staff Directory</h1>
          <p className="max-w-2xl text-sm text-[#94A3B8]">
            All staff records for this clinic — roles, calendars, and scheduling defaults. Use
            Onboarding for new hires and Staff Access for login and PIN management.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={workforceOsBase}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#F8FAFC] hover:bg-white/[0.07]"
          >
            {STAFF_LIFECYCLE_LABELS.workforceCommandCentre}
          </Link>
          <Link
            href={staffAccessHref}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#F8FAFC] hover:bg-white/[0.07]"
          >
            {STAFF_LIFECYCLE_LABELS.staffAccess}
          </Link>
          {canManage ? (
            <Link
              href={onboardingHref}
              className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-4 py-2 text-sm font-semibold text-[#22C1FF] hover:bg-[#22C1FF]/20"
              data-testid="start-onboarding-button"
            >
              Start onboarding
            </Link>
          ) : null}
        </div>
      </header>

      <DashboardCard className="border-[#22C1FF]/15 bg-gradient-to-r from-[#0c1426]/90 to-[#0f1a30]/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#F8FAFC]">{lifecycleCopy.headline}</p>
            <p className="text-xs text-[#94A3B8]">{lifecycleCopy.body}</p>
            <p className="text-xs text-[#64748B]">
              <Link href={onboardingHref} className="font-medium text-[#22C1FF] hover:underline">
                {STAFF_LIFECYCLE_LABELS.onboardingCentre}
              </Link>
              {" · "}
              <Link href={staffAccessHref} className="font-medium text-[#22C1FF] hover:underline">
                {STAFF_LIFECYCLE_LABELS.staffAccessCentre}
              </Link>
              {" · "}
              <Link href={workforceOsBase} className="font-medium text-[#22C1FF] hover:underline">
                {STAFF_LIFECYCLE_LABELS.workforceCommandCentre}
              </Link>
            </p>
          </div>
          <Link
            href={`${workforceOsBase}/planning`}
            className="shrink-0 text-sm font-medium text-[#22C1FF] hover:underline"
          >
            Open workforce planning →
          </Link>
        </div>
      </DashboardCard>

      <section aria-label="Compact workforce summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total staff" value={metrics.totalStaff} />
        <StatCard label="Active" value={metrics.activeStaff} />
        <StatCard label="Needs attention" value={attentionCount} />
        <StatCard label="Compliance issues" value={metrics.complianceIssues} />
        <StatCard
          label="Clinically eligible"
          value={operationalMetrics?.clinicallyEligibleStaff ?? "—"}
        />
      </section>

      <section aria-label="Staff list">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">
            Staff records ({directoryRows.length}
            {directoryRows.length !== allRows.length ? ` of ${allRows.length}` : ""})
          </h2>
          {filters ? (
            <nav aria-label="Staff status filter" className="flex gap-1.5 text-xs">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "inactive", label: "Inactive" },
                ] as const
              ).map((opt) => (
                <Link
                  key={opt.id}
                  href={activeFilterHref(pathname, filters, opt.id)}
                  data-testid={`staff-directory-filter-${opt.id}`}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-medium transition-colors",
                    filters.activeFilter === opt.id
                      ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
                      : "border-white/[0.08] text-slate-400 hover:border-white/[0.14] hover:text-slate-200"
                  )}
                >
                  {opt.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        {directoryRows.length === 0 ? (
          <DashboardCard className="p-8 text-center">
            <p className="text-sm text-[#94A3B8]">
              {allRows.length === 0 ? (
                <>
                  {lifecycleCopy.emptyState}{" "}
                  {canManage ? (
                    <Link href={onboardingHref} className="font-medium text-[#22C1FF] hover:underline">
                      Start onboarding →
                    </Link>
                  ) : null}
                </>
              ) : (
                "No staff match the current filters."
              )}
            </p>
          </DashboardCard>
        ) : (
          <div className="space-y-2">
            {directoryRows.map((row) => (
              <StaffRowCard
                key={row.id}
                row={row}
                intel={resolveStaffWorkforceIntelligence(row, intelligenceByStaffId[row.id])}
                base={base}
                workforceOsBase={workforceOsBase}
                canManage={canManage}
                showTwinLinks={showTwinLinks}
                viewerStaffId={viewerStaffId}
                onEdit={() => onEditStaff(row)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}