"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type { SurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import type { SurgeryOsWidgetKey } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import { useSurgeryOsRefresh } from "@/src/components/fi-admin/surgery-os/useSurgeryOsRefresh";
import { SurgeryOsLiveSurgeryBoardWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsLiveSurgeryBoard";
import { SurgeryOsReadinessEngineWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsReadinessEngine";
import { SurgeryOsProcedureTimelineWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsProcedureTimeline";
import { SurgeryOsTeamAssignmentBoardWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsTeamAssignmentBoard";
import { SurgeryOsAlertsWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsAlerts";
import { SurgeryOsNotesEventsWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsNotesEvents";
import { SurgeryOsGraftIntelligenceWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsGraftIntelligence";
import { SurgeryOsLiveActions } from "@/src/components/fi-admin/surgery-os/SurgeryOsLiveActions";
import { SurgeryOsGraftActions } from "@/src/components/fi-admin/surgery-os/SurgeryOsGraftActions";

function formatRefreshTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function widgetVisible(visible: readonly SurgeryOsWidgetKey[], key: SurgeryOsWidgetKey): boolean {
  return visible.includes(key);
}

export function SurgeryOsDashboard({ data: initialData }: { data: SurgeryOsCommandCentrePayload }) {
  const { data, lastRefreshedAt, isRefreshing, refreshError, refresh } = useSurgeryOsRefresh({
    tenantId: initialData.tenantId,
    initialData,
  });

  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.operationalDay.calendarTimezone;
  const dateLine = formatCalendarLongWeekdayDate(data.operationalDay.todayYmd, tz);
  const show = (key: SurgeryOsWidgetKey) => widgetVisible(data.viewer.visibleWidgets, key);

  return (
    <div className="mx-auto max-w-[1920px] space-y-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">
            SurgeryOS · Surgical command centre
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{data.tenantName}</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Live theatre operations · auto-refresh · role:{" "}
            <span className="capitalize text-slate-400">{data.viewer.role.replace(/_/g, " ")}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95 disabled:opacity-60",
            )}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden />
            Refresh
          </button>
          <span className="text-xs text-slate-600">Updated {formatRefreshTime(lastRefreshedAt)}</span>
          {refreshError ? <span className="text-xs text-rose-400">{refreshError}</span> : null}
          <Link
            href={`${base}/surgery-os/graft-counting`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-violet-100/95",
            )}
          >
            Graft counting
          </Link>
          <Link
            href={`${base}/surgery-readiness`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Readiness board
          </Link>
          <Link
            href={`${base}/procedure-day`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Procedure day
          </Link>
        </div>
      </header>

      <SurgeryOsLiveActions
        tenantId={data.tenantId}
        viewerRole={data.viewer.role}
        staffRole={data.viewer.staffRole}
        surgeries={data.liveSurgeries}
        teamAssignments={data.teamAssignments}
        onMutated={() => void refresh()}
      />

      <SurgeryOsGraftActions
        tenantId={data.tenantId}
        viewerRole={data.viewer.role}
        staffRole={data.viewer.staffRole}
        surgeries={data.liveSurgeries}
        graftSummary={data.graftSummary}
        onMutated={() => void refresh()}
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {show("live_surgery_board") ? (
          <div className="xl:col-span-2">
            <SurgeryOsLiveSurgeryBoardWidget surgeries={data.liveSurgeries} />
          </div>
        ) : null}

        {show("surgical_alerts") ? <SurgeryOsAlertsWidget alerts={data.alerts} /> : null}

        {show("live_graft_intelligence") ? (
          <div className="xl:col-span-2">
            <SurgeryOsGraftIntelligenceWidget graftSummary={data.graftSummary} />
          </div>
        ) : null}

        {show("surgical_readiness_engine") ? (
          <div className="xl:col-span-2">
            <SurgeryOsReadinessEngineWidget snapshots={data.readinessSnapshots} />
          </div>
        ) : null}

        {show("live_procedure_timeline") ? (
          <SurgeryOsProcedureTimelineWidget events={data.procedureTimeline} />
        ) : null}

        {show("team_assignment_board") ? (
          <SurgeryOsTeamAssignmentBoardWidget team={data.teamAssignments} />
        ) : null}

        {show("surgical_notes_events") ? (
          <div className="xl:col-span-2">
            <SurgeryOsNotesEventsWidget notes={data.operationalNotes} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
