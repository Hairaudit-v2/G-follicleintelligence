"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Download, ExternalLink, RefreshCw, UserCog, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { runHrStaffSyncNowAction } from "@/src/lib/actions/fi-hr-sync-health-actions";
import {
  buildStaffReadinessCsvExport,
  filterStaffReadinessRows,
  STAFF_READINESS_FILTER_LABELS,
  type StaffReadinessFilter,
} from "@/src/lib/hr/hrStaffReadinessDashboard";
import type { HrStaffReadinessPageModel } from "@/src/lib/hr/hrStaffReadinessPage.server";

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function readinessBadgeClass(state: string): string {
  if (state === "ready") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (state === "inactive") return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  return "border-amber-500/40 bg-amber-500/10 text-amber-200";
}

export function HrStaffReadinessClient({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: HrStaffReadinessPageModel;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [filter, setFilter] = useState<StaffReadinessFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { overview, rows, canPerformAdminActions } = pageModel;

  const visibleRows = useMemo(() => filterStaffReadinessRows(rows, filter), [rows, filter]);

  const exportCsv = useCallback(() => {
    const csv = buildStaffReadinessCsvExport(visibleRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff-readiness.csv";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [visibleRows]);

  const runSync = useCallback(() => {
    setError(null);
    setActionMessage(null);
    startTransition(async () => {
      const r = await runHrStaffSyncNowAction({ tenantId });
      if (!r.ok) {
        setError(r.error ?? "Sync failed.");
        return;
      }
      setActionMessage(r.message ?? "HR sync completed.");
      router.refresh();
    });
  }, [router, tenantId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">HR</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">
          Staff readiness
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Operational view of payroll links, FI role assignment, HR onboarding, training readiness,
          and clinical availability. Safe fields only — no payroll or sensitive HR data is shown or
          exported.
        </p>
        <p className="text-sm text-[#94A3B8]">
          <Link href={`${base}/staff`} className="text-[#22C1FF] hover:underline">
            ← Staff directory
          </Link>
          <span className="mx-2 text-[#475569]">·</span>
          <Link href={`${base}/hr/sync-health`} className="text-[#22C1FF] hover:underline">
            HR sync health
          </Link>
          <span className="mx-2 text-[#475569]">·</span>
          <Link href={`${base}/staff/role-review`} className="text-[#22C1FF] hover:underline">
            Role review
          </Link>
          <span className="mx-2 text-[#475569]">·</span>
          <Link href={`${base}/hr/staff-import/payroll`} className="text-[#22C1FF] hover:underline">
            Payroll import
          </Link>
        </p>
      </header>

      {error ? (
        <InfoNotice variant="danger" title="Action failed">
          {error}
        </InfoNotice>
      ) : null}
      {actionMessage ? (
        <InfoNotice variant="success" title="Success">
          {actionMessage}
        </InfoNotice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active staff" value={overview.totalActiveStaff} />
        <StatCard label="Needs role" value={overview.needsRoleAssignment} />
        <StatCard label="HR incomplete" value={overview.hrOnboardingIncomplete} />
        <StatCard label="Training incomplete" value={overview.trainingIncomplete} />
        <StatCard label="Clinically available" value={overview.clinicallyAvailableStaff} />
        <StatCard label="Inactive" value={overview.inactiveStaff} />
      </div>

      <DashboardCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#F8FAFC]">
              <Users className="h-4 w-4 text-[#22C1FF]" aria-hidden />
              Staff readiness
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Showing {visibleRows.length} of {rows.length} staff
              {!canPerformAdminActions ? " · Read-only (admin actions disabled)" : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canPerformAdminActions ? (
              <Button type="button" disabled={pending} onClick={runSync}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Run HR sync
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={visibleRows.length === 0}
              onClick={exportCsv}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(STAFF_READINESS_FILTER_LABELS) as StaffReadinessFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                filter === key
                  ? "border-[#22C1FF]/60 bg-[#22C1FF]/15 text-[#E0F7FF]"
                  : "border-white/10 bg-white/5 text-[#94A3B8] hover:border-white/20"
              }`}
            >
              {STAFF_READINESS_FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <p className="mt-4 text-sm text-[#94A3B8]">No staff match this filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-2 py-2 font-medium">Staff</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Position</th>
                  <th className="px-2 py-2 font-medium">Clinic</th>
                  <th className="px-2 py-2 font-medium">Payroll</th>
                  <th className="px-2 py-2 font-medium">HR link</th>
                  <th className="px-2 py-2 font-medium">Onboarding</th>
                  <th className="px-2 py-2 font-medium">Training</th>
                  <th className="px-2 py-2 font-medium">Certs</th>
                  <th className="px-2 py-2 font-medium">Hours</th>
                  <th className="px-2 py-2 font-medium">Clinical</th>
                  <th className="px-2 py-2 font-medium">Last sync</th>
                  <th className="px-2 py-2 font-medium">State</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.staffId} className="border-b border-white/5 text-[#E2E8F0]">
                    <td className="px-2 py-2 font-medium">{row.fullName}</td>
                    <td className="px-2 py-2 capitalize">{row.staffRole}</td>
                    <td className="px-2 py-2 text-[#94A3B8]">{row.positionTitle ?? "—"}</td>
                    <td className="px-2 py-2 text-[#94A3B8]">{row.primaryClinicName ?? "—"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          row.payrollLinkStatus === "linked" ? "text-emerald-300" : "text-[#64748B]"
                        }
                      >
                        {row.payrollLinkStatus === "linked" ? "Linked" : "Not linked"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          row.hrLinkStatus === "linked" ? "text-emerald-300" : "text-amber-300"
                        }
                      >
                        {row.hrLinkStatus === "linked" ? "Linked" : "No link"}
                      </span>
                    </td>
                    <td className="px-2 py-2 capitalize">{row.hrOnboardingStatus}</td>
                    <td className="px-2 py-2">{row.trainingRequiredCount ?? "—"}</td>
                    <td className="px-2 py-2">{row.certificatesOutstandingCount ?? "—"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          row.workingHoursStatus === "configured"
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                      >
                        {row.workingHoursStatus === "configured" ? "Set" : "Missing"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          row.clinicalAvailabilityStatus === "available"
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                        title={row.clinicalAvailabilityReason ?? undefined}
                      >
                        {row.clinicalAvailabilityStatus === "available" ? "Available" : "Blocked"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-[#94A3B8]">
                      {formatIso(row.lastHrSyncAt)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${readinessBadgeClass(row.readinessState)}`}
                      >
                        {row.readinessStateLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.needsRoleReview ? (
                          <Link
                            href={`${base}/staff/role-review`}
                            className="rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium text-[#22C1FF] hover:bg-white/5"
                          >
                            Assign role
                          </Link>
                        ) : null}
                        <Link
                          href={`${base}/staff`}
                          className="rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium text-[#CBD5E1] hover:bg-white/5"
                        >
                          Edit staff
                        </Link>
                        <Link
                          href={`${base}/staff/${row.staffId}/twin`}
                          className="rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium text-[#CBD5E1] hover:bg-white/5"
                        >
                          Staff Twin
                        </Link>
                        {row.hrPortalUrl ? (
                          <a
                            href={row.hrPortalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium text-[#CBD5E1] hover:bg-white/5"
                          >
                            HR portal
                            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {canPerformAdminActions ? (
        <DashboardCard className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#F8FAFC]">
            <UserCog className="h-4 w-4 text-[#22C1FF]" aria-hidden />
            Admin note
          </h2>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Run HR sync to refresh IIOHR metadata. Clinical availability requires an assigned role,
            working hours, fresh HR sync (when linked), and cleared HR/training policy for clinical
            provider roles.
          </p>
        </DashboardCard>
      ) : null}
    </div>
  );
}
