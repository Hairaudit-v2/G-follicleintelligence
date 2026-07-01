"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { StatCard } from "@/src/components/fi-admin/dashboard-ui/StatCard";
import type { StaffDirectoryRowView } from "@/src/lib/staff/staffDirectoryFilters";
import type { WorkforceOperationalMetrics } from "@/src/lib/workforce/workforceOperationalMetrics.server";
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

function StaffRowCard({
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
        "rounded-xl border border-white/[0.07] bg-[#0c1426]/60 px-4 py-3 transition-colors hover:border-white/[0.12]",
        !row.is_active && "opacity-70",
        row.needsReview && "border-amber-500/20"
      )}
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
          <StatusPill
            className={
              row.is_active
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
                : "bg-slate-500/15 text-slate-400 ring-slate-500/20"
            }
          >
            {row.is_active ? "Active" : "Inactive"}
          </StatusPill>
          <StatusPill className={readinessScorePillClass(intel.readinessScore)}>
            {formatReadinessScore(intel.readinessScore)}
          </StatusPill>
          <StatusPill className={complianceStatusPillClass(intel.complianceStatus)}>
            {formatComplianceStatusLabel(intel.complianceStatus)}
          </StatusPill>
        </div>
        <div className="flex shrink-0 gap-3 text-xs">
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
  onAddStaff,
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
  onAddStaff: () => void;
  onEditStaff: (row: StaffDirectoryRowView) => void;
}) {
  const metrics = buildWorkforceCommandCentreMetrics(allRows, intelligenceByStaffId);
  const attentionCount = buildWorkforceAttentionQueue(allRows, intelligenceByStaffId).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Staff · Directory</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC]">Staff Directory</h1>
          <p className="max-w-2xl text-sm text-[#94A3B8]">
            FI staff records, roles, calendars, and access. For workforce intelligence, open the
            Command Centre.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={workforceOsBase}
            className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-4 py-2 text-sm font-semibold text-[#22C1FF] hover:bg-[#22C1FF]/20"
          >
            Workforce Command Centre
          </Link>
          {canManage ? (
            <Button type="button" onClick={onAddStaff} data-testid="add-staff-button">
              Add staff
            </Button>
          ) : null}
        </div>
      </header>

      <DashboardCard className="border-[#22C1FF]/15 bg-gradient-to-r from-[#0c1426]/90 to-[#0f1a30]/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#F8FAFC]">Workforce intelligence lives in WorkforceOS</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Planning, payroll, procedure staffing, and compliance dashboards are on the command centre.
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">
            Staff records ({directoryRows.length}
            {directoryRows.length !== allRows.length ? ` of ${allRows.length}` : ""})
          </h2>
        </div>
        {directoryRows.length === 0 ? (
          <DashboardCard className="p-8 text-center">
            <p className="text-sm text-[#94A3B8]">
              {allRows.length === 0
                ? "No staff rows yet. Add your first team member to begin."
                : "No staff match the current filters."}
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