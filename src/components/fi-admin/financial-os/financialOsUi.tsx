import type { HTMLAttributes, ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui/InfoNotice";
import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui/SectionHeader";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

/** Shared FinancialOS command-centre styling — aligned with ReceptionOS / FI OS chrome. */
export const financialOsClasses = {
  pageShell: "mx-auto w-full max-w-[1920px] space-y-6 pb-10 xl:space-y-7 2xl:max-w-[2200px] 2xl:space-y-8",
  pageSection: "space-y-6 xl:space-y-7 2xl:space-y-8",
  dashboardGrid: "2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-x-8",
  dashboardGridWide: "2xl:col-span-2",
  link: "text-cyan-400/95 underline-offset-2 hover:text-cyan-300 hover:underline",
  inlineLink: "font-medium text-cyan-400/95 hover:text-cyan-300",
  code: "rounded bg-white/[0.06] px-1 font-mono text-[0.85em] text-cyan-200/90",
  bodyText: "text-sm text-slate-400",
  bodyTextXs: "text-xs text-slate-400",
  mutedMeta: "text-xs text-slate-500",
  metricGrid: "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4 2xl:gap-5",
  metricTile: "rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5",
  metricLabel: "text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500",
  metricValue: "text-sm font-semibold tabular-nums text-slate-50 sm:text-base",
  metricFoot: "mt-0.5 text-[11px] leading-snug text-slate-500",
  metricList: "mt-1 space-y-0.5 text-[11px] text-slate-300",
  formPanel: "rounded-xl border border-white/[0.07] bg-[#0c1426]/80 p-4 backdrop-blur-md",
  formTitle: "text-sm font-semibold text-slate-50",
  formLabel: "block text-xs text-slate-400",
  formHint: "mt-1 text-xs text-slate-500",
  input:
    "mt-1 w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-2 py-1.5 text-sm text-slate-100 shadow-sm shadow-black/30 backdrop-blur-md transition placeholder:text-slate-600 focus-visible:border-cyan-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30",
  select:
    "mt-1 w-full rounded-xl border border-white/[0.1] bg-[#0a101f] px-2 py-1.5 text-sm text-slate-100 shadow-sm shadow-black/30 backdrop-blur-md transition [color-scheme:dark] focus-visible:border-cyan-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30",
  inlineSelect:
    "rounded-xl border border-white/[0.1] bg-[#0a101f] px-2 py-1.5 text-sm text-slate-100 shadow-sm shadow-black/30 backdrop-blur-md transition [color-scheme:dark] focus-visible:border-cyan-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30",
  selectOption: "bg-[#0a101f] text-slate-100",
  checkboxLabel: "flex items-center gap-2 text-xs text-slate-300",
  primaryButton: cn(
    fiOsChromeClasses.toolbarControlSurface,
    "inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-cyan-100/95 disabled:opacity-50",
  ),
  secondaryButton: cn(
    fiOsChromeClasses.toolbarControlSurface,
    "inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 disabled:opacity-50",
  ),
  textButton: "text-xs font-medium text-cyan-400/95 hover:text-cyan-300",
  tableShell: "overflow-x-auto rounded-xl border border-white/[0.07] bg-[#0c1426]/80 backdrop-blur-md",
  table: "min-w-full text-xs text-slate-300",
  tableHead: "sticky top-0 z-10 border-b border-white/[0.06] bg-[#0c1426]/95 text-left backdrop-blur-sm",
  tableHeadCell:
    "px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-slate-500",
  tableRow: "border-b border-white/[0.04] transition hover:bg-white/[0.02]",
  tableCell: "px-3 py-2",
  tableCellStrong: "px-3 py-2 font-medium text-slate-100",
  tableCellMono: "px-3 py-2 font-mono text-slate-300",
  emptyState: "px-4 py-10 text-center text-sm text-slate-400",
  emptyStatePanel: "flex flex-col items-center justify-center px-4 py-10 text-center",
  errorText: "text-xs text-rose-300",
  successText: "text-xs text-emerald-300",
  warningText: "text-xs text-amber-300",
  infoText: "text-xs text-slate-400",
  drawerOverlay: "fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm",
  drawerPanel: "flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0a101f] shadow-2xl shadow-black/60",
  drawerHeader: "flex items-center justify-between border-b border-white/[0.06] px-4 py-3",
  drawerBody: "flex-1 space-y-4 overflow-y-auto p-4 text-sm text-slate-300",
  subPanel: "rounded-lg border border-white/[0.06] bg-white/[0.02] p-3",
} as const;

export type FinancialOsFeedbackTone = "success" | "error" | "warning" | "info";

export type FinancialOsFeedback = {
  message: string;
  tone: FinancialOsFeedbackTone;
};

export function financialOsActionFeedback(
  res: { ok: true } | { ok: false; error: string },
  successMessage: string,
): FinancialOsFeedback {
  if (res.ok) return { message: successMessage, tone: "success" };
  return { message: res.error, tone: "error" };
}

export function financialOsFilteredEmptyMessage(
  hasSourceRows: boolean,
  zeroMessage: string,
  filteredMessage: string,
): string {
  return hasSourceRows ? filteredMessage : zeroMessage;
}

function isFinancialOsSuccessFeedback(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("created") ||
    m.includes("updated") ||
    m.includes("saved") ||
    m.includes("recorded") ||
    m.includes("granted") ||
    m.includes("added") ||
    m.includes("marked as settled")
  );
}

export function financialOsFeedbackClassForTone(tone: FinancialOsFeedbackTone): string {
  switch (tone) {
    case "success":
      return financialOsClasses.successText;
    case "error":
      return financialOsClasses.errorText;
    case "warning":
      return financialOsClasses.warningText;
    case "info":
      return financialOsClasses.infoText;
  }
}

/** @deprecated Prefer `tone` prop on `FinancialOsFeedbackText`. */
export function financialOsFeedbackClassName(message: string, explicitSuccess?: boolean): string {
  if (explicitSuccess === true) return financialOsClasses.successText;
  if (explicitSuccess === false) return financialOsClasses.errorText;
  return isFinancialOsSuccessFeedback(message) ? financialOsClasses.successText : financialOsClasses.errorText;
}

export function FinancialOsFeedbackText(props: {
  message: string | null;
  tone?: FinancialOsFeedbackTone;
  /** @deprecated Prefer `tone="success"` / `tone="error"`. */
  success?: boolean;
  className?: string;
}) {
  if (!props.message) return null;
  const className =
    props.tone != null
      ? financialOsFeedbackClassForTone(props.tone)
      : financialOsFeedbackClassName(props.message, props.success);
  return <p className={cn(className, props.className)}>{props.message}</p>;
}

export function FinancialOsEmptyState(props: {
  message: string;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(financialOsClasses.emptyStatePanel, props.className)}>
      {props.icon ?? <Inbox className="mb-2 h-8 w-8 text-slate-600" aria-hidden />}
      <p className="text-sm text-slate-300">{props.message}</p>
      {props.hint ? <p className="mt-1 max-w-sm text-xs text-slate-500">{props.hint}</p> : null}
    </div>
  );
}

export function FinancialOsMetricTile(props: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(financialOsClasses.metricTile, props.className)}>
      <dt className={financialOsClasses.metricLabel}>{props.label}</dt>
      <dd className={financialOsClasses.metricValue}>{props.value}</dd>
      {props.foot ? <dd className={financialOsClasses.metricFoot}>{props.foot}</dd> : null}
    </div>
  );
}

export function FinancialOsSectionCard(props: {
  title: string;
  description?: ReactNode;
  kicker?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}) {
  return (
    <DashboardCard className={cn("flex flex-col", props.className)}>
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title={props.title} description={typeof props.description === "string" ? props.description : undefined} kicker={props.kicker} />
        {props.description && typeof props.description !== "string" ? (
          <div className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-400 sm:text-xs">{props.description}</div>
        ) : null}
      </div>
      <div className={cn("px-4 py-4", props.bodyClassName)}>{props.children}</div>
      {props.footer ? <div className="border-t border-white/[0.06] px-4 py-3">{props.footer}</div> : null}
    </DashboardCard>
  );
}

export function FinancialOsSubPageHeader(props: { title: string; description?: ReactNode; kicker?: string }) {
  return (
    <header className="space-y-1 border-b border-white/[0.07] pb-4">
      {props.kicker ? (
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/85">{props.kicker}</p>
      ) : null}
      <h2 className="text-xs font-semibold tracking-tight text-slate-50 sm:text-sm">{props.title}</h2>
      {props.description ? (
        typeof props.description === "string" ? (
          <p className="max-w-3xl text-[11px] leading-relaxed text-slate-400 sm:text-xs">{props.description}</p>
        ) : (
          <div className="max-w-3xl text-[11px] leading-relaxed text-slate-400 sm:text-xs">{props.description}</div>
        )
      ) : null}
    </header>
  );
}

export function FinancialOsTableShell(props: HTMLAttributes<HTMLDivElement>) {
  const { className, children, ...rest } = props;
  return (
    <div className={cn(financialOsClasses.tableShell, className)} {...rest}>
      {children}
    </div>
  );
}

export function FinancialOsFormPanel(props: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn(financialOsClasses.formPanel, props.className)}>
      <h3 className={financialOsClasses.formTitle}>{props.title}</h3>
      {props.description ? <p className={financialOsClasses.formHint}>{props.description}</p> : null}
      <div className="mt-3">{props.children}</div>
    </div>
  );
}

export function FinancialOsAutomationNotice(props: { children: ReactNode }) {
  return (
    <InfoNotice variant="info" title="Automation cron">
      <div className="space-y-2 text-xs leading-relaxed text-slate-300">{props.children}</div>
    </InfoNotice>
  );
}

export function FinancialOsTable(props: {
  head: ReactNode;
  children: ReactNode;
  emptyMessage?: string;
  emptyHint?: string;
  isEmpty?: boolean;
}) {
  return (
    <FinancialOsTableShell>
      {props.isEmpty && props.emptyMessage ? (
        <FinancialOsEmptyState message={props.emptyMessage} hint={props.emptyHint} />
      ) : (
        <>
          <table className={financialOsClasses.table}>
            <thead className={financialOsClasses.tableHead}>
              <tr>{props.head}</tr>
            </thead>
            <tbody>{props.children}</tbody>
          </table>
        </>
      )}
    </FinancialOsTableShell>
  );
}

export function FinancialOsTh(props: { children?: ReactNode; className?: string }) {
  return <th className={cn(financialOsClasses.tableHeadCell, props.className)}>{props.children}</th>;
}
