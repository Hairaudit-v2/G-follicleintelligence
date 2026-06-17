import Link from "next/link";
import { AlertTriangle, Banknote, ClipboardList, Phone, Scissors } from "lucide-react";
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
    row: "border-red-400/35 bg-red-950/35 hover:border-red-300/50 hover:bg-red-950/45",
    icon: "border-red-400/40 bg-red-950/50 text-red-100",
    badge: "bg-red-950/55 text-red-50 ring-1 ring-red-400/25",
  },
  warning: {
    row: "border-orange-400/35 bg-orange-950/25 hover:border-orange-300/45 hover:bg-orange-950/35",
    icon: "border-orange-400/40 bg-orange-950/40 text-orange-100",
    badge: "bg-orange-950/45 text-orange-50 ring-1 ring-orange-400/25",
  },
  normal: {
    row: "border-sky-500/20 bg-sky-950/20 hover:border-cyan-400/35 hover:bg-cyan-950/25",
    icon: "border-sky-400/30 bg-sky-950/35 text-sky-200",
    badge: "bg-sky-950/40 text-cyan-50 ring-1 ring-sky-400/20",
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
        !hasItems && severity === "normal" && "border-sky-500/10 bg-sky-950/15",
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
    actionCentre.surgeryReadinessAlerts +
    actionCentre.surgeryFinancialPaymentAttention +
    actionCentre.financialPathwayTasksAttention +
    actionCentre.financeApplicationsAttention;
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
          className="mt-4 max-w-xl py-5 sm:px-6 sm:py-6"
          title="You're caught up"
          description="No leads, consultations, follow-ups, surgery prep, or surgery revenue follow-up items need attention right now."
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
          <ActionRow
            href={`${base}/financial/invoices`}
            label="Surgery payment follow-up"
            detail="FinancialOS + issued invoices in the next 14-day surgery window — deposits, balances, installments, or failed payments."
            count={actionCentre.surgeryFinancialPaymentAttention}
            icon={<Banknote className="h-4 w-4" />}
            severity={actionCentre.surgeryFinancialPaymentAttention > 0 ? "warning" : "normal"}
          />
          <ActionRow
            href={`${base}/financial/pathway-inbox`}
            label="Financial pathway tasks"
            detail="Open operational inbox tasks for non-standard payment pathways."
            count={actionCentre.financialPathwayTasksAttention}
            icon={<ClipboardList className="h-4 w-4" />}
            severity={actionCentre.financialPathwayTasksAttention > 0 ? "warning" : "normal"}
          />
          <ActionRow
            href={`${base}/financial/finance-applications`}
            label="Finance applications requiring attention"
            detail="Financing applications breaching document, approval, or settlement SLAs."
            count={actionCentre.financeApplicationsAttention}
            icon={<Banknote className="h-4 w-4" />}
            severity={actionCentre.financeApplicationsAttention > 0 ? "warning" : "normal"}
          />
        </div>
      )}
    </DashboardCard>
  );
}
