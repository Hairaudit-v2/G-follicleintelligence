"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import { runComplianceAuditAction } from "@/src/lib/actions/workforce-phase-1c-sprint-3-actions";
import type { CompliancePageAlertRow } from "@/src/lib/workforce/compliancePage.server";

const SEVERITY_CLASS: Record<string, string> = {
  low: "text-slate-400",
  medium: "text-amber-300",
  high: "text-orange-300",
  critical: "text-rose-400",
};

export function StaffComplianceClient({
  tenantId,
  alerts,
  recentRuns,
  canManage,
}: {
  tenantId: string;
  alerts: CompliancePageAlertRow[];
  recentRuns: Array<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    staffChecked: number;
    alertsGenerated: number;
    status: string;
  }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const onRunAudit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await runComplianceAuditAction(tenantId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(
        `Audit complete — ${result.staffChecked} staff checked, ${result.alertsGenerated} alerts.`
      );
      router.refresh();
    });
  }, [router, tenantId]);

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Compliance</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Automated workforce compliance alerts — deduplicated via upsert. Daily cron also runs at
            /api/cron/workforce-compliance-audit.
          </p>
        </div>
        {canManage ? (
          <Button type="button" disabled={pending} onClick={onRunAudit}>
            {pending ? "Running…" : "Run audit now"}
          </Button>
        ) : null}
      </header>

      {error ? (
        <InfoNotice variant="warning" title="Audit failed" className="mt-6">
          <p className="text-sm">{error}</p>
        </InfoNotice>
      ) : null}
      {summary ? (
        <InfoNotice variant="success" title="Audit complete" className="mt-6">
          <p className="text-sm">{summary}</p>
        </InfoNotice>
      ) : null}

      <DashboardCard className="mt-6 p-5" elevated>
        <h2 className="text-sm font-semibold text-slate-100">
          Open alerts ({alerts.length})
        </h2>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No open compliance alerts.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-200">{a.staffName}</span>
                  <span
                    className={`text-xs font-semibold uppercase ${SEVERITY_CLASS[a.severity] ?? "text-slate-400"}`}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1 text-slate-400">{a.message ?? a.alertType}</p>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="mt-6 p-5" elevated>
        <h2 className="text-sm font-semibold text-slate-100">Recent audit runs</h2>
        {recentRuns.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No audit runs yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {recentRuns.map((r) => (
              <li key={r.id}>
                {new Date(r.startedAt).toLocaleString()} — {r.staffChecked} staff,{" "}
                {r.alertsGenerated} alerts ({r.status})
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}