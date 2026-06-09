import Link from "next/link";
import { AlertTriangle, ClipboardList, Phone, Scissors } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";
import type { TenantActionCentre } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function ActionRow({
  href,
  label,
  detail,
  count,
  icon,
  tone = "default",
}: {
  href: string;
  label: string;
  detail: string;
  count: number;
  icon: ReactNode;
  tone?: "default" | "alert";
}) {
  const hasItems = count > 0;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition sm:px-4",
        hasItems
          ? tone === "alert"
            ? "border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-400/40 hover:bg-amber-500/10"
            : "border-white/[0.09] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          hasItems && tone === "alert"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-cyan-500/15 bg-cyan-500/10 text-cyan-400",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{detail}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
          hasItems
            ? tone === "alert"
              ? "bg-amber-500/15 text-amber-100"
              : "bg-cyan-500/12 text-cyan-100"
            : "bg-white/[0.04] text-slate-500",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

export function DashboardActionCentre(props: { base: string; actionCentre: TenantActionCentre; showCrmNav: boolean }) {
  const { base, actionCentre, showCrmNav } = props;
  const total =
    actionCentre.leadsAwaitingContact +
    actionCentre.consultationsAwaitingCompletion +
    actionCentre.followUpsDue +
    actionCentre.surgeryReadinessAlerts;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-action-centre-heading">
      <SectionHeader
        id="dash-action-centre-heading"
        kicker="Attention"
        title="Action centre"
        description="Items that need a response before the clinic day moves on."
      />
      {total === 0 ? (
        <DashboardEmptyState
          className="mt-4"
          title="You're caught up"
          description="No leads, consultations, follow-ups, or surgery prep items need attention right now."
          actionLabel="View calendar"
          actionHref={`${base}/calendar`}
        />
      ) : (
        <div className="mt-4 space-y-2">
          <ActionRow
            href={showCrmNav ? `${base}/crm` : `${base}/calendar`}
            label="Leads awaiting contact"
            detail="Open enquiries not yet worked."
            count={actionCentre.leadsAwaitingContact}
            icon={<Phone className="h-4 w-4" />}
          />
          <ActionRow
            href={`${base}/consultations`}
            label="Consultations awaiting completion"
            detail="Draft, in progress, or quoted workspaces."
            count={actionCentre.consultationsAwaitingCompletion}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <ActionRow
            href={`${base}/calendar`}
            label="Follow-ups due"
            detail="Review visits scheduled in the next two weeks."
            count={actionCentre.followUpsDue}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <ActionRow
            href={`${base}/cases`}
            label="Surgery readiness alerts"
            detail="Upcoming procedures without a linked case."
            count={actionCentre.surgeryReadinessAlerts}
            icon={<Scissors className="h-4 w-4" />}
            tone="alert"
          />
        </div>
      )}
    </DashboardCard>
  );
}
