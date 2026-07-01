import { Clock, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { SurgeryOsSeverityBadge } from "@/src/components/fi-admin/surgery-os/surgeryOsSeverityStyles";
import type {
  LiveProcedureTimelineSnapshot,
  SurgeryOsProcedureTimelineEvent,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatElapsed(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function statusTone(status: LiveProcedureTimelineSnapshot["status"]): string {
  switch (status) {
    case "completed":
      return "text-emerald-400";
    case "paused":
      return "text-amber-400";
    case "cancelled":
      return "text-rose-400";
    case "not_started":
      return "text-slate-400";
    default:
      return "text-cyan-300";
  }
}

function TimelineIntelligenceCard({ timeline }: { timeline: LiveProcedureTimelineSnapshot }) {
  const latestEvents = [...timeline.timelineItems].slice(-4).reverse();

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{timeline.patientLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">{timeline.summary}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Current stage</p>
          <p className={cn("text-xs font-semibold", statusTone(timeline.status))}>
            {timeline.currentStageLabel ?? "Awaiting events"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Elapsed
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-cyan-300">
            {formatElapsed(timeline.elapsedMinutes)}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Expected completion
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">
            {timeline.expectedCompletionTime
              ? formatTimestamp(timeline.expectedCompletionTime)
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Status
          </p>
          <p className={cn("mt-0.5 text-sm font-semibold capitalize", statusTone(timeline.status))}>
            {timeline.status.replaceAll("_", " ")}
          </p>
        </div>
      </div>

      {timeline.delaySignals.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {timeline.delaySignals.map((signal) => (
            <li
              key={`${signal.kind}:${signal.message}`}
              className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0">
                <SurgeryOsSeverityBadge severity={signal.severity} />
                <p className="mt-1 text-xs text-slate-300">{signal.message}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {latestEvents.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Latest events
          </p>
          <ol className="mt-2 space-y-2">
            {latestEvents.map((ev) => (
              <li
                key={`${ev.stage}:${ev.occurredAt}`}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="text-slate-200">{ev.eventLabel}</span>
                <span className="shrink-0 tabular-nums text-cyan-400/80">
                  {formatTimestamp(ev.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function SurgeryOsProcedureTimelineWidget({
  events,
  liveTimeline = [],
}: {
  events: SurgeryOsProcedureTimelineEvent[];
  liveTimeline?: LiveProcedureTimelineSnapshot[];
}) {
  const sorted = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const hasIntelligence = liveTimeline.length > 0;

  return (
    <DashboardCard className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Live procedure timeline"
          description="Real-time stage intelligence and timestamped surgical events"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {hasIntelligence ? (
          <ul className="mb-4 space-y-3">
            {liveTimeline.map((timeline) => (
              <li key={timeline.surgeryId}>
                <TimelineIntelligenceCard timeline={timeline} />
              </li>
            ))}
          </ul>
        ) : null}

        {sorted.length === 0 && !hasIntelligence ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Clock className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">No live theatre events recorded yet.</p>
          </div>
        ) : sorted.length > 0 ? (
          <div>
            {hasIntelligence ? (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Full event log
              </p>
            ) : null}
            <ol className="relative space-y-0 px-2 py-1">
              {sorted.map((ev, idx) => (
                <li key={ev.id} className="relative flex gap-3 pb-4">
                  {idx < sorted.length - 1 ? (
                    <span
                      className="absolute left-[7px] top-4 h-full w-px bg-white/[0.08]"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-cyan-400/60 bg-[#081020]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium text-slate-100">{ev.eventLabel}</p>
                      <span className="text-xs tabular-nums text-cyan-400/80">
                        {formatTimestamp(ev.occurredAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{ev.patientLabel}</p>
                    {ev.recordedByLabel ? (
                      <p className="text-xs text-slate-400">Recorded by {ev.recordedByLabel}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
