"use client";

import Link from "next/link";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type {
  StaffIdentityReadinessAuditResult,
  StaffIdentityReadinessAuditRow,
  StaffTestingReadinessSummary,
} from "@/src/lib/workforce-os/staffIdentityReadinessAudit.server";

function readinessBadgeClass(status: StaffTestingReadinessSummary): string {
  if (status === "ready") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "watch") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-rose-500/40 bg-rose-500/10 text-rose-100";
}

function statusClass(kind: "login" | "profile" | "pin" | "onboarding", value: string): string {
  const v = value.toLowerCase();
  if (v === "ready") return "text-emerald-400";
  if (v === "missing" || v === "missing_user" || v === "missing_auth") return "text-rose-400";
  if (v === "invited" || v === "pending") return "text-amber-300";
  if (v === "suspended" || v === "blocked") return "text-rose-400";
  if (v === "not_required") return "text-slate-500";
  if (kind === "profile" && v === "ambiguous") return "text-amber-300";
  return "text-slate-400";
}

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <DashboardCard className="p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#F8FAFC]">{value}</p>
    </DashboardCard>
  );
}

function AuditRow({ row, tenantId }: { row: StaffIdentityReadinessAuditRow; tenantId: string }) {
  const profileHref = `/fi-admin/${tenantId}/workforce-os/staff/${row.staffMemberId}`;

  return (
    <tr className="border-t border-white/5 align-top">
      <td className="px-3 py-3 text-sm text-[#F8FAFC]">
        <div className="font-medium">
          <Link
            href={profileHref}
            className="text-[#22C1FF] hover:underline"
            data-testid="identity-audit-profile-link"
          >
            {row.displayLabel}
          </Link>
        </div>
        {row.roleCode ? <div className="mt-1 text-xs text-[#94A3B8]">{row.roleCode}</div> : null}
      </td>
      <td className="px-3 py-3 text-sm text-[#CBD5E1]">{row.employmentStatus}</td>
      <td className={`px-3 py-3 text-sm capitalize ${statusClass("login", row.loginStatus)}`}>
        {formatStatusLabel(row.loginStatus)}
      </td>
      <td
        className={`px-3 py-3 text-sm capitalize ${statusClass("profile", row.workspaceProfileStatus)}`}
      >
        {formatStatusLabel(row.workspaceProfileStatus)}
      </td>
      <td className={`px-3 py-3 text-sm capitalize ${statusClass("pin", row.pinStatus)}`}>
        {formatStatusLabel(row.pinStatus)}
      </td>
      <td
        className={`px-3 py-3 text-sm capitalize ${statusClass("onboarding", row.onboardingStatus)}`}
      >
        {formatStatusLabel(row.onboardingStatus)}
      </td>
      <td className="px-3 py-3 text-sm text-[#CBD5E1]">
        <p>{row.recommendedAction}</p>
        {row.issues.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#94A3B8]">
            {row.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </td>
    </tr>
  );
}

export function StaffIdentityReadinessAuditClient({
  tenantId,
  audit,
}: {
  tenantId: string;
  audit: StaffIdentityReadinessAuditResult;
}) {
  const { summary, rows } = audit;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">Team</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Identity Audit</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
          Check whether staff identity, login, PIN, and readiness records are linked correctly.
        </p>
      </header>

      <DashboardCard className={`p-4 ${readinessBadgeClass(summary.testingReadiness)}`}>
        <p className="text-xs uppercase tracking-[0.14em] opacity-80">Staff UAT readiness</p>
        <p className="mt-2 text-lg font-semibold capitalize">{summary.testingReadiness}</p>
        <p className="mt-2 text-sm opacity-90">
          {summary.testingReadiness === "ready"
            ? "Active staff have login, workspace profile, and access pathways in place."
            : summary.testingReadiness === "watch"
              ? "Identity chain is mostly intact — PIN or invite cleanup may remain before staff UAT."
              : "Staff UAT is blocked until login, auth, or workspace profile gaps are resolved."}
        </p>
      </DashboardCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Ready staff" value={summary.readyCount} />
        <SummaryCard label="Missing login link" value={summary.missingLoginLinkCount} />
        <SummaryCard label="Pending invite" value={summary.pendingInviteCount} />
        <SummaryCard
          label="Missing workspace profile"
          value={summary.missingWorkspaceProfileCount}
        />
        <SummaryCard label="PIN missing" value={summary.pinMissingCount} />
        <SummaryCard label="Suspended / revoked" value={summary.suspendedRevokedCount} />
      </div>

      <DashboardCard className="overflow-hidden p-0">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">Staff readiness</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Audit only — no automatic fixes are applied from this page.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-[#94A3B8]">
              <tr>
                <th className="px-3 py-3 font-medium">Staff</th>
                <th className="px-3 py-3 font-medium">Employment</th>
                <th className="px-3 py-3 font-medium">Login</th>
                <th className="px-3 py-3 font-medium">Workspace</th>
                <th className="px-3 py-3 font-medium">PIN</th>
                <th className="px-3 py-3 font-medium">Onboarding</th>
                <th className="px-3 py-3 font-medium">Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#94A3B8]">
                    No active staff members to audit.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <AuditRow key={row.staffMemberId} row={row} tenantId={tenantId} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={`/fi-admin/${tenantId}/workforce-os/staff-access`}
          className="text-[#22C1FF] underline-offset-2 hover:underline"
        >
          Staff access
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/workforce-os`}
          className="text-[#22C1FF] underline-offset-2 hover:underline"
        >
          Team overview
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/staff`}
          className="text-[#22C1FF] underline-offset-2 hover:underline"
        >
          Staff Directory
        </Link>
      </div>
    </div>
  );
}
