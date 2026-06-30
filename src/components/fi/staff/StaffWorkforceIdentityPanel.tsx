"use client";

import { CheckCircle2, Link2, Unlink } from "lucide-react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { WorkforceIdentitySummary } from "@/src/lib/workforce-os/workforceIdentitySummary";

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function LinkRow({
  label,
  status,
  variant = "dark",
}: {
  label: string;
  status: WorkforceIdentitySummary["hr"];
  variant?: "dark" | "light";
}) {
  const linked = status.linked;
  const textMuted = variant === "dark" ? "text-[#94A3B8]" : "text-slate-500";
  const textMain = variant === "dark" ? "text-[#E2E8F0]" : "text-slate-200";

  return (
    <div
      className={
        variant === "dark"
          ? "rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
          : "rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-3"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {linked ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <Unlink className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
          <div>
            <p className="text-sm font-medium text-inherit">{label}</p>
            <p className={`mt-0.5 text-xs ${textMuted}`}>{status.sourceSystemLabel}</p>
          </div>
        </div>
        <span
          className={
            linked
              ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"
              : "rounded-full border border-slate-600/50 bg-slate-800/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          }
        >
          {linked ? "Linked" : "Not linked"}
        </span>
      </div>
      {linked ? (
        <dl className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${textMain}`}>
          <div>
            <dt className={textMuted}>Sync status</dt>
            <dd className="mt-0.5">{status.syncStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className={textMuted}>Last synced</dt>
            <dd className="mt-0.5">{formatIso(status.lastSyncedAt)}</dd>
          </div>
          {status.isSyncStale ? (
            <div className="sm:col-span-2 text-amber-200/90">
              Sync metadata is stale — refresh from source system.
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

export function StaffWorkforceIdentityPanel({
  summary,
  variant = "dark",
}: {
  summary: WorkforceIdentitySummary;
  variant?: "dark" | "light";
}) {
  const heading = variant === "dark" ? "text-[#F8FAFC]" : "text-slate-50";
  const sub = variant === "dark" ? "text-[#94A3B8]" : "text-slate-400";

  return (
    <div>
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-cyan-400/90" aria-hidden />
        <h2 className={`text-lg font-semibold ${heading}`}>Workforce identity</h2>
      </div>
      <p className={`mt-1 text-sm ${sub}`}>
        Operational links to IIOHR HR, Academy, and Nexus. FI OS projects readiness metadata only —
        source systems remain authoritative for HR, training, and certification records.
      </p>
      <div className="mt-4 space-y-3">
        <LinkRow label="HR identity" status={summary.hr} variant={variant} />
        <LinkRow label="Academy identity" status={summary.academy} variant={variant} />
        <LinkRow label="Nexus global professional" status={summary.nexus} variant={variant} />
      </div>
      <p className={`mt-4 text-xs ${sub}`}>
        {summary.linkedIdentityCount} of 3 identity systems linked
        {summary.hasStaleIdentitySync ? " · at least one link has stale sync metadata" : ""}.
      </p>
    </div>
  );
}

export function WorkforceIdentitySummaryCard({
  summary,
  className,
}: {
  summary: WorkforceIdentitySummary;
  className?: string;
}) {
  return (
    <DashboardCard className={className ?? "p-6 sm:p-8"}>
      <StaffWorkforceIdentityPanel summary={summary} variant="dark" />
    </DashboardCard>
  );
}
