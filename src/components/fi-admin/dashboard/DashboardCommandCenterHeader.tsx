import Link from "next/link";
import { Calendar, LayoutGrid, Plus, Scissors, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { TenantHomeQuickCallIn } from "@/src/components/fi-admin/TenantHomeQuickCallIn";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import type { TenantOperationalDay } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const primaryActionClass = cn(
  fiOsChromeClasses.toolbarControlSurface,
  "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-50",
);

const primaryAccentClass = cn(primaryActionClass, fiOsChromeClasses.toolbarPrimaryAccent);

type CommandCenterAction = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  accent?: boolean;
};

export function DashboardCommandCenterHeader(props: {
  tenantId: string;
  tenantName: string;
  base: string;
  operationalDay: TenantOperationalDay;
  canQuickCallIn: boolean;
  showCalendarShortcut: boolean;
  bookingQuickAction?: ResolvedDashboardQuickAction | null;
  workspaceBadge?: string | null;
}) {
  const {
    tenantId,
    tenantName,
    base,
    operationalDay,
    canQuickCallIn,
    showCalendarShortcut,
    bookingQuickAction,
    workspaceBadge,
  } = props;

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: operationalDay.calendarTimezone.trim() || undefined,
  }).format(now);

  const actions: CommandCenterAction[] = [
    ...(showCalendarShortcut
      ? [{ key: "calendar", label: "Open Calendar", href: `${base}/calendar`, icon: <Calendar className="h-4 w-4 text-cyan-400" /> }]
      : []),
    { key: "operations", label: "Open Operations Centre", href: `${base}/operations`, icon: <LayoutGrid className="h-4 w-4 text-cyan-400" /> },
    { key: "reception", label: "Open Reception Board", href: `${base}/reception`, icon: <Users className="h-4 w-4 text-cyan-400" /> },
    { key: "surgery-os", label: "Open SurgeryOS", href: `${base}/surgery-os`, icon: <Scissors className="h-4 w-4 text-cyan-400" /> },
  ];

  const bookingHref = bookingQuickAction?.enabled ? bookingQuickAction.href : `${base}/calendar`;
  const bookingDisabled = bookingQuickAction != null && !bookingQuickAction.enabled;

  return (
    <header className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#0c1426]/95 via-[#0a1020]/90 to-[#060d18]/95 p-4 shadow-lg shadow-black/40 backdrop-blur-md sm:p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(34,193,255,0.08), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(124,58,237,0.06), transparent 50%)",
        }}
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">Clinic command centre</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Clinic Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Live operational overview of your clinic, patients, team activity, consultations, and procedures.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tenantName}
            <span className="mx-2 text-slate-700" aria-hidden>
              ·
            </span>
            {dateLine}
          </p>
          {workspaceBadge ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace: <span className="text-cyan-400/90">{workspaceBadge}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {canQuickCallIn ? (
              <TenantHomeQuickCallIn tenantId={tenantId} calendarTimezone={operationalDay.calendarTimezone} />
            ) : null}
            {actions.map((action) => (
              <Link key={action.key} href={action.href} className={primaryActionClass}>
                {action.icon}
                {action.label}
              </Link>
            ))}
            {bookingDisabled ? (
              <span
                className={cn(primaryAccentClass, "cursor-not-allowed opacity-50")}
                title={bookingQuickAction?.disabledReason}
                aria-disabled="true"
              >
                <Plus className="h-4 w-4 text-cyan-400" aria-hidden />
                Quick Create Booking
              </span>
            ) : (
              <Link href={bookingHref} className={primaryAccentClass}>
                <Plus className="h-4 w-4 text-cyan-400" aria-hidden />
                Quick Create Booking
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
