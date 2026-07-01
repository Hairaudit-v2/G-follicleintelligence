"use client";

import Link from "next/link";
import { RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
import type { SurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import type { SurgeryOsWidgetKey } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  buildSurgeryOsAttentionItems,
  surgeryLinkButtonClass,
  surgeryOsAttentionComplete,
  surgicalAttentionSeverityClass,
} from "@/src/lib/fiAdmin/surgeryPresentation";
import { useSurgeryOsRefresh } from "@/src/components/fi-admin/surgery-os/useSurgeryOsRefresh";
import { SurgeryOsLiveSurgeryBoardWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsLiveSurgeryBoard";
import { SurgeryOsReadinessEngineWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsReadinessEngine";
import { SurgeryOsProcedureTimelineWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsProcedureTimeline";
import { SurgeryOsTeamAssignmentBoardWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsTeamAssignmentBoard";
import { SurgeryOsAlertsWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsAlerts";
import { SurgeryOsNotesEventsWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsNotesEvents";
import { SurgeryOsGraftIntelligenceWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsGraftIntelligence";
import { SurgeryOsProceduralPerformanceWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsProceduralPerformance";
import { SurgeryOsSurgeonPerformanceWidget } from "@/src/components/fi-admin/surgery-os/widgets/SurgeryOsSurgeonPerformance";
import { SurgeryOsLiveActions } from "@/src/components/fi-admin/surgery-os/SurgeryOsLiveActions";
import { SurgeryOsGraftActions } from "@/src/components/fi-admin/surgery-os/SurgeryOsGraftActions";
import { SurgeryOsVieCapturePanel } from "@/src/components/fi-admin/surgery-os/SurgeryOsVieCapturePanel";

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
  const attentionItems = buildSurgeryOsAttentionItems(data, base, 5);
  const recordComplete = surgeryOsAttentionComplete(data, base);

  return (
    <div className="mx-auto max-w-[1920px] space-y-8 pb-10">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">
              FI OS · SurgeryOS
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
              {data.tenantName}
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              Detailed surgical execution and graft intelligence — live theatre operations for
              today&apos;s procedures.
            </p>
            <p className="mt-2 text-sm text-[#64748B]">
              {dateLine} · Auto-refresh · {formatRefreshTime(lastRefreshedAt)}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={isRefreshing}
                className={cn(surgeryLinkButtonClass, "disabled:opacity-60")}
              >
                <RefreshCw
                  className={cn("mr-1.5 inline h-4 w-4", isRefreshing && "animate-spin")}
                  aria-hidden
                />
                Refresh
              </button>
              <Link href={`${base}/procedure-day`} className={surgeryLinkButtonClass}>
                Procedure Day
              </Link>
              <Link href={`${base}/surgery-readiness`} className={surgeryLinkButtonClass}>
                Readiness Board
              </Link>
              <Link href={`${base}/surgery-os/graft-counting`} className={surgeryLinkButtonClass}>
                Graft counting
              </Link>
            </div>
            {refreshError ? <p className="mt-2 text-xs text-rose-400">{refreshError}</p> : null}
          </div>
        </div>
      </DashboardCard>

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

      <SurgeryOsVieCapturePanel
        tenantId={data.tenantId}
        surgeries={data.liveSurgeries}
        vieCapture={data.vieCapture}
        onMutated={() => void refresh()}
      />

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="so-attention-heading">
        <SectionHeader
          id="so-attention-heading"
          kicker="Procedure"
          title="What needs surgical attention"
          description="Top procedure-level priorities for graft documentation and surgical record completeness."
          className="mb-4"
        />
        {recordComplete ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Surgical record is currently complete for this phase.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href ?? `${base}/surgery-os`}
                  className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-[#22C1FF]/30 ${surgicalAttentionSeverityClass(item.severity)}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p>
                    ) : null}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#22C1FF]/70" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {show("live_surgery_board") ? (
          <div className="xl:col-span-2">
            <SurgeryOsLiveSurgeryBoardWidget surgeries={data.liveSurgeries} />
          </div>
        ) : null}

        {show("surgical_alerts") ? <SurgeryOsAlertsWidget alerts={data.alerts} /> : null}

        {show("live_graft_intelligence") ? (
          <div className="xl:col-span-2">
            <SurgeryOsGraftIntelligenceWidget
              graftSummary={data.graftSummary}
              graftIntelligence={data.graftIntelligence}
            />
          </div>
        ) : null}

        {show("live_graft_intelligence") ? (
          <SurgeryOsProceduralPerformanceWidget
            extractionVelocity={data.extractionVelocity}
            transectionMonitoring={data.transectionMonitoring}
            implantationSpeed={data.implantationSpeed}
            surgicalRisks={data.surgicalRisks}
          />
        ) : null}

        {show("surgeon_performance_intelligence") ? (
          <SurgeryOsSurgeonPerformanceWidget
            surgeonPerformance={data.surgeonPerformance}
            surgeryBenchmarks={data.surgeryBenchmarks}
            surgeonConsistency={data.surgeonConsistency}
            surgeonRiskPatterns={data.surgeonRiskPatterns}
          />
        ) : null}

        {show("surgical_readiness_engine") ? (
          <div className="xl:col-span-2">
            <SurgeryOsReadinessEngineWidget snapshots={data.readinessSnapshots} />
          </div>
        ) : null}

        {show("live_procedure_timeline") ? (
          <SurgeryOsProcedureTimelineWidget
            events={data.procedureTimeline}
            liveTimeline={data.liveTimeline}
          />
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
