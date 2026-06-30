"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";
import type { ReceptionOsWidgetKey } from "@/src/lib/receptionOs/receptionOsBoardModel";
import {
  taskStatusesForOperatingMode,
  widgetsForOperatingMode,
  type ReceptionOsOperatingMode,
} from "@/src/lib/receptionOs/receptionOperatingMode";
import { useReceptionOsRefresh } from "@/src/components/fi-admin/reception-os/useReceptionOsRefresh";
import { ReceptionOsOperatingModeTabs } from "@/src/components/fi-admin/reception-os/ReceptionOsOperatingModeTabs";
import { ReceptionOsActionAlertsPanel } from "@/src/components/fi-admin/reception-os/ReceptionOsActionAlertsPanel";
import { ReceptionOsTaskInbox } from "@/src/components/fi-admin/reception-os/ReceptionOsTaskInbox";
import { ReceptionOsTodaysPatientsWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsTodaysPatients";
import { ReceptionOsCommunicationTimelineWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsCommunicationTimeline";
import { ReceptionOsConsultationPipelineWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsConsultationPipeline";
import { ReceptionOsOutstandingDepositsWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsOutstandingDeposits";
import { ReceptionOsUpcomingSurgeryWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsUpcomingSurgery";
import { ReceptionOsDailyBriefWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsDailyBrief";
import {
  ReceptionOsConversionScoreboardWidget,
  ReceptionOsRevenueIntelligenceWidget,
} from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsRevenueIntelligence";
import { ReceptionOsEndOfDayCloseoutWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsEndOfDayCloseout";
import { ReceptionOsPilotBanner } from "@/src/components/fi-admin/reception-os/ReceptionOsPilotBanner";
import { ReceptionOsSystemStatusPanel } from "@/src/components/fi-admin/reception-os/ReceptionOsSystemStatusPanel";
import { ReceptionOsPilotFeedbackControls } from "@/src/components/fi-admin/reception-os/ReceptionOsPilotFeedbackControls";
import { ReceptionOsWidgetTracker } from "@/src/components/fi-admin/reception-os/ReceptionOsWidgetTracker";
import { ReceptionOsPilotManagerWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsPilotManagerWidget";
import { ReceptionOsPilotReviewPanel } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsPilotReviewPanel";
import { ReceptionOsOwnerValueDashboardWidget } from "@/src/components/fi-admin/reception-os/widgets/ReceptionOsOwnerValueDashboard";
import { ReceptionOsDemoBanner } from "@/src/components/fi-admin/reception-os/ReceptionOsDemoBanner";
import { ReceptionOsModuleHealthPanel } from "@/src/components/fi-admin/reception-os/ReceptionOsModuleHealthPanel";
import { useReceptionOsDashboardViewTracking } from "@/src/components/fi-admin/reception-os/useReceptionOsUsageTracking";
import { revenueIntelligenceAccessForRole } from "@/src/lib/receptionOs/receptionOsRevenueModel";

function formatRefreshTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function widgetVisible(
  visible: readonly ReceptionOsWidgetKey[],
  key: ReceptionOsWidgetKey
): boolean {
  return visible.includes(key);
}

export function ReceptionOsDashboard({
  data: initialData,
}: {
  data: ReceptionOsCommandCentrePayload;
}) {
  const [operatingMode, setOperatingMode] = useState<ReceptionOsOperatingMode>(
    initialData.suggestedOperatingMode
  );

  const { data, lastRefreshedAt, isRefreshing, refreshError, refresh } = useReceptionOsRefresh({
    tenantId: initialData.tenantId,
    initialData,
    operatingMode,
    demoModeActive: initialData.demoMode.active,
  });

  const modeWidgets = useMemo(
    () => widgetsForOperatingMode(operatingMode, data.viewer.visibleWidgets),
    [operatingMode, data.viewer.visibleWidgets]
  );

  const taskStatuses = taskStatusesForOperatingMode(operatingMode);
  const base = `/fi-admin/${data.tenantId}`;
  const tz = data.operationalDay.calendarTimezone;
  const dateLine = formatCalendarLongWeekdayDate(data.operationalDay.todayYmd, tz);

  const show = (key: ReceptionOsWidgetKey) => widgetVisible(modeWidgets, key);
  const revenueAccess = revenueIntelligenceAccessForRole(data.viewer.role);

  useReceptionOsDashboardViewTracking({
    tenantId: data.tenantId,
    operatingMode,
  });

  return (
    <div className="mx-auto max-w-[1920px] space-y-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">
            ReceptionOS · Command centre
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            {data.tenantName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Live front desk · auto-refresh · role:{" "}
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
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95 disabled:opacity-60"
            )}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden />
            Refresh
          </button>
          <span className="text-xs text-slate-600">
            Updated {formatRefreshTime(lastRefreshedAt)}
          </span>
          {refreshError ? <span className="text-xs text-rose-400">{refreshError}</span> : null}
          <Link
            href={`${base}/reception`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95"
            )}
          >
            Reception board
          </Link>
          <Link
            href={`${base}/calendar`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95"
            )}
          >
            Calendar
          </Link>
          {data.demoMode.canToggle ? (
            data.demoMode.active ? (
              <Link
                href={`${base}/reception-os`}
                className={cn(
                  fiOsChromeClasses.toolbarControlSurface,
                  "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-amber-100/95"
                )}
              >
                Exit demo
              </Link>
            ) : (
              <Link
                href={`${base}/reception-os?demo=1`}
                className={cn(
                  fiOsChromeClasses.toolbarControlSurface,
                  "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-amber-100/95"
                )}
              >
                Demo mode
              </Link>
            )
          ) : null}
        </div>
      </header>

      {data.moduleHealth ? <ReceptionOsModuleHealthPanel health={data.moduleHealth} /> : null}

      {data.demoMode.active ? <ReceptionOsDemoBanner demoMode={data.demoMode} /> : null}

      {data.systemStatus.pilotBanner && !data.demoMode.active ? (
        <ReceptionOsPilotBanner banner={data.systemStatus.pilotBanner} />
      ) : null}

      <ReceptionOsSystemStatusPanel
        status={data.systemStatus}
        clientLastRefreshedAt={lastRefreshedAt}
      />

      <ReceptionOsOperatingModeTabs
        mode={operatingMode}
        suggestedMode={data.suggestedOperatingMode}
        onChange={setOperatingMode}
      />

      {data.pilotMetrics.visible && data.pilotMetrics.summary && data.pilotMetrics.managerScores ? (
        <ReceptionOsPilotManagerWidget
          summary={data.pilotMetrics.summary}
          scores={data.pilotMetrics.managerScores}
        />
      ) : null}

      {data.ownerValue.visible && data.ownerValue.dashboard ? (
        <ReceptionOsOwnerValueDashboardWidget
          dashboard={data.ownerValue.dashboard}
          periodDays={data.pilotReview.periodDays}
        />
      ) : null}

      {data.pilotReview.visible && data.pilotReview.report ? (
        <ReceptionOsPilotReviewPanel tenantId={data.tenantId} report={data.pilotReview.report} />
      ) : null}

      <ReceptionOsWidgetTracker
        tenantId={data.tenantId}
        widgetKey="daily_brief"
        operatingMode={operatingMode}
      >
        <div>
          <ReceptionOsDailyBriefWidget brief={data.dailyBrief} />
          <ReceptionOsPilotFeedbackControls
            tenantId={data.tenantId}
            operatingMode={operatingMode}
            widgetKey="daily_brief"
            compact
          />
        </div>
      </ReceptionOsWidgetTracker>

      {operatingMode === "end_of_day" ? (
        <ReceptionOsWidgetTracker
          tenantId={data.tenantId}
          widgetKey="end_of_day_closeout"
          operatingMode={operatingMode}
        >
          <ReceptionOsEndOfDayCloseoutWidget
            tenantId={data.tenantId}
            closeout={data.endOfDayCloseout}
            onClosed={() => void refresh()}
          />
        </ReceptionOsWidgetTracker>
      ) : null}

      {revenueAccess !== "none" ? (
        <>
          <ReceptionOsConversionScoreboardWidget
            scoreboard={data.conversionScoreboard}
            readOnly={revenueAccess === "summary"}
          />
          <ReceptionOsRevenueIntelligenceWidget
            tenantId={data.tenantId}
            tenantName={data.tenantName}
            summary={data.revenueSummary}
            revenueRiskAlerts={data.revenueRiskAlerts}
            readOnly={revenueAccess === "summary"}
            onMutated={() => void refresh()}
          />
        </>
      ) : null}

      {data.intelligence.hints.length > 0 ? (
        <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] px-4 py-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/90">
                Intelligence hints
              </p>
              <ul className="mt-2 space-y-1">
                {data.intelligence.hints.slice(0, 3).map((h) => (
                  <li key={h.signalKind} className="text-sm text-slate-300">
                    <span className="font-medium text-slate-100">{h.title}</span>
                    <span className="text-slate-500"> — </span>
                    {h.summary}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ReceptionOsWidgetTracker
          tenantId={data.tenantId}
          widgetKey="reception_tasks"
          operatingMode={operatingMode}
        >
          <ReceptionOsTaskInbox
            tenantId={data.tenantId}
            tenantName={data.tenantName}
            role={data.viewer.role}
            tasks={data.receptionTasks}
            allowedStatuses={taskStatuses}
            onMutated={() => void refresh()}
          />
        </ReceptionOsWidgetTracker>
        {show("action_alerts") ? (
          <ReceptionOsWidgetTracker
            tenantId={data.tenantId}
            widgetKey="action_alerts"
            operatingMode={operatingMode}
          >
            <ReceptionOsActionAlertsPanel
              tenantId={data.tenantId}
              tenantName={data.tenantName}
              role={data.viewer.role}
              alerts={data.actionAlerts}
              tasks={data.receptionTasks}
              operatingMode={operatingMode}
              onMutated={() => void refresh()}
            />
          </ReceptionOsWidgetTracker>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {show("todays_patients") ? (
          <ReceptionOsWidgetTracker
            tenantId={data.tenantId}
            widgetKey="todays_patients"
            operatingMode={operatingMode}
          >
            <ReceptionOsTodaysPatientsWidget patients={data.todaysPatients} />
          </ReceptionOsWidgetTracker>
        ) : null}
        {show("communication_timeline") ? (
          <ReceptionOsWidgetTracker
            tenantId={data.tenantId}
            widgetKey="communication_timeline"
            operatingMode={operatingMode}
          >
            <ReceptionOsCommunicationTimelineWidget events={data.communicationTimeline} />
          </ReceptionOsWidgetTracker>
        ) : null}
      </div>

      {show("consultation_pipeline") ? (
        <ReceptionOsWidgetTracker
          tenantId={data.tenantId}
          widgetKey="consultation_pipeline"
          operatingMode={operatingMode}
        >
          <ReceptionOsConsultationPipelineWidget
            columns={data.consultationPipeline.columns}
            counts={data.consultationPipeline.counts}
          />
        </ReceptionOsWidgetTracker>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {show("outstanding_deposits") ? (
          <ReceptionOsWidgetTracker
            tenantId={data.tenantId}
            widgetKey="outstanding_deposits"
            operatingMode={operatingMode}
          >
            <ReceptionOsOutstandingDepositsWidget
              tenantId={data.tenantId}
              tenantName={data.tenantName}
              deposits={data.outstandingDeposits}
              onMutated={() => void refresh()}
            />
          </ReceptionOsWidgetTracker>
        ) : null}
        {show("upcoming_surgery") ? (
          <ReceptionOsWidgetTracker
            tenantId={data.tenantId}
            widgetKey="upcoming_surgery"
            operatingMode={operatingMode}
          >
            <ReceptionOsUpcomingSurgeryWidget
              tenantId={data.tenantId}
              tenantName={data.tenantName}
              surgeries={data.upcomingSurgeries}
              onMutated={() => void refresh()}
            />
          </ReceptionOsWidgetTracker>
        ) : null}
      </div>
    </div>
  );
}
