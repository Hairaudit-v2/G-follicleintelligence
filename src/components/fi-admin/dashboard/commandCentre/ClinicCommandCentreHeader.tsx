import Link from "next/link";
import { Calendar, ClipboardList, LayoutGrid, Plus, Scissors, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { TenantHomeQuickCallIn } from "@/src/components/fi-admin/TenantHomeQuickCallIn";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";

const headerAction = cn(
  fiOsChromeClasses.toolbarControlSurface,
  "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-50",
);

export function ClinicCommandCentreHeader(props: {
  tenantName: string;
  dateLine: string;
  base: string;
  canQuickCallIn: boolean;
  calendarTimezone: string;
  tenantId: string;
  showCalendarShortcut: boolean;
  quickActions: readonly ResolvedDashboardQuickAction[];
  workspaceBadge?: string | null;
}) {
  const {
    tenantName,
    dateLine,
    base,
    canQuickCallIn,
    calendarTimezone,
    tenantId,
    showCalendarShortcut,
    quickActions,
    workspaceBadge,
  } = props;

  const bookingAction = quickActions.find((a) => a.key === "booking" && a.enabled);

  return (
    <header className="space-y-5 border-b border-white/[0.07] pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">Clinic Command Center</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{tenantName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Live operational overview of your clinic, patients, team activity, consultations, and procedures.
          </p>
          <p className="mt-1.5 text-sm text-slate-500">{dateLine}</p>
          {workspaceBadge ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace: <span className="text-cyan-400/90">{workspaceBadge}</span>
            </p>
          ) : null}
        </div>
        {canQuickCallIn ? (
          <TenantHomeQuickCallIn tenantId={tenantId} calendarTimezone={calendarTimezone} />
        ) : null}
      </div>

      <nav aria-label="Primary clinic actions" className="flex flex-wrap gap-2">
        {showCalendarShortcut ? (
          <Link href={`${base}/calendar`} className={headerAction}>
            <Calendar className="h-4 w-4 text-cyan-400" aria-hidden />
            Open Calendar
          </Link>
        ) : null}
        <Link href={`${base}/operations`} className={headerAction}>
          <LayoutGrid className="h-4 w-4 text-cyan-400" aria-hidden />
          Open Operations Centre
        </Link>
        <Link href={`${base}/reception`} className={headerAction}>
          <Users className="h-4 w-4 text-cyan-400" aria-hidden />
          Open Reception Board
        </Link>
        <Link href={`${base}/surgery-os`} className={headerAction}>
          <Scissors className="h-4 w-4 text-cyan-400" aria-hidden />
          Open SurgeryOS
        </Link>
        {bookingAction ? (
          <Link href={bookingAction.href} className={cn(headerAction, "border-cyan-500/25 bg-cyan-950/20")}>
            <Plus className="h-4 w-4 text-cyan-400" aria-hidden />
            Quick Create Booking
          </Link>
        ) : (
          <span className={cn(headerAction, "cursor-not-allowed opacity-50")} aria-disabled="true">
            <ClipboardList className="h-4 w-4 text-slate-500" aria-hidden />
            Quick Create Booking
          </span>
        )}
      </nav>
    </header>
  );
}
