import Link from "next/link";
import { AlertTriangle, ClipboardList, Phone, Scissors } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";
import type { TenantActionCentre } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";

export type AttentionRowKey = "leads" | "consultations" | "followUps" | "surgeryReadiness";

export type AttentionSeverity = "critical" | "warning" | "normal";

/**
 * Threshold-based urgency for attention rows (counts only — no permission logic).
 * Spec: surgery readiness &gt; 0 = critical; leads &gt; 100 critical, &gt; 25 warning;
 * consultations &gt; 5 warning; follow-ups &gt; 3 warning; zero = normal.
 */
export function attentionSeverityForRow(row: AttentionRowKey, count: number): AttentionSeverity {
  if (row === "surgeryReadiness") return count > 0 ? "critical" : "normal";
  if (row === "leads") {
    if (count > 100) return "critical";
    if (count > 25) return "warning";
    return "normal";
  }
  if (row === "consultations") {
    if (count > 5) return "warning";
    return "normal";
  }
  if (row === "followUps") {
    if (count > 3) return "warning";
    return "normal";
  }
  return "normal";
}

const severityRowClasses: Record<AttentionSeverity, { row: string; icon: string; badge: string }> = {
  critical: {
    row: "border-red-500/30 bg-red-500/[0.07] hover:border-red-400/45 hover:bg-red-500/10",
    icon: "border-red-500/35 bg-red-500/15 text-red-200",
    badge: "bg-red-500/20 text-red-50",
  },
  warning: {
    row: "border-orange-500/28 bg-orange-500/[0.06] hover:border-orange-400/40 hover:bg-orange-500/10",
    icon: "border-orange-500/35 bg-orange-500/12 text-orange-200",
    badge: "bg-orange-500/18 text-orange-50",
  },
  normal: {
    row: "border-blue-500/15 bg-blue-500/[0.04] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
    icon: "border-blue-400/25 bg-blue-500/10 text-cyan-300",
    badge: "bg-blue-500/15 text-cyan-50",
  },
};

function ActionRow({
  href,
  label,
  detail,
  count,
  icon,
  severity,
}: {
  href: string;
  label: string;
  detail: string;
  count: number;
  icon: ReactNode;
  severity: AttentionSeverity;
}) {
  const tone = severityRowClasses[severity];
  const hasItems = count > 0;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition sm:px-4",
        hasItems ? tone.row : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]",
        !hasItems && severity === "normal" && "border-blue-500/10 bg-blue-500/[0.02]",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          hasItems ? tone.icon : "border-slate-600/30 bg-slate-800/40 text-slate-500",
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
          hasItems ? tone.badge : "bg-white/[0.04] text-slate-500",
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
  const meta = FI_DASHBOARD_WIDGET_LABELS.attention_centre;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-action-centre-heading">
      <SectionHeader
        id="dash-action-centre-heading"
        kicker="Attention"
        title={meta.title}
        description={meta.description}
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
            severity={attentionSeverityForRow("leads", actionCentre.leadsAwaitingContact)}
          />
          <ActionRow
            href={`${base}/consultations`}
            label="Consultations awaiting completion"
            detail="Draft, in progress, or quoted workspaces."
            count={actionCentre.consultationsAwaitingCompletion}
            icon={<ClipboardList className="h-4 w-4" />}
            severity={attentionSeverityForRow("consultations", actionCentre.consultationsAwaitingCompletion)}
          />
          <ActionRow
            href={`${base}/calendar`}
            label="Follow-ups due"
            detail="Review visits scheduled in the next two weeks."
            count={actionCentre.followUpsDue}
            icon={<AlertTriangle className="h-4 w-4" />}
            severity={attentionSeverityForRow("followUps", actionCentre.followUpsDue)}
          />
          <ActionRow
            href={`${base}/cases`}
            label="Surgery readiness alerts"
            detail="Upcoming procedures without a linked case."
            count={actionCentre.surgeryReadinessAlerts}
            icon={<Scissors className="h-4 w-4" />}
            severity={attentionSeverityForRow("surgeryReadiness", actionCentre.surgeryReadinessAlerts)}
          />
        </div>
      )}
    </DashboardCard>
  );
}
