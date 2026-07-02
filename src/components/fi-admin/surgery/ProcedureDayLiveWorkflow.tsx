"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  advanceProcedureDayStageAction,
  completeProcedureDaySessionAction,
  dischargeProcedureDayPatientAction,
  incrementProcedureDayGraftAction,
  recordProcedureDayMetricAction,
  startProcedureDaySessionAction,
} from "@/lib/actions/fi-procedure-day-actions";
import type { ProcedureDayScheduleCard } from "@/src/lib/surgery/procedureDayBoardLoader.server";
import {
  PROCEDURE_DAY_STAGE_LABELS,
  PROCEDURE_DAY_WORKFLOW_STAGES,
} from "@/src/lib/procedureDay/procedureDayWorkflowCore";
import type {
  ProcedureDayLiveBoardPayload,
  ProcedureDayLiveCardState,
} from "@/src/lib/procedureDay/procedureDayWorkflowTypes";
import { surgeryLinkButtonClass } from "@/src/lib/fiAdmin/surgeryPresentation";

function StageTimeline({ currentStage }: { currentStage: ProcedureDayLiveCardState["currentStage"] }) {
  const idx = PROCEDURE_DAY_WORKFLOW_STAGES.indexOf(currentStage);
  const visible = PROCEDURE_DAY_WORKFLOW_STAGES.filter((s) => s !== "completed" && s !== "discharged");
  return (
    <ol className="flex flex-wrap gap-1.5">
      {visible.map((stage) => {
        const stageIdx = PROCEDURE_DAY_WORKFLOW_STAGES.indexOf(stage);
        const active = stageIdx === idx;
        const done = stageIdx < idx;
        return (
          <li
            key={stage}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[0.62rem] font-medium",
              active && "border-[#22C1FF]/50 bg-[#22C1FF]/15 text-[#22C1FF]",
              done && !active && "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90",
              !active && !done && "border-white/[0.08] bg-black/20 text-[#64748B]"
            )}
          >
            {PROCEDURE_DAY_STAGE_LABELS[stage]}
          </li>
        );
      })}
    </ol>
  );
}

function LiveSurgeryCard({
  tenantId,
  card,
  live,
}: {
  tenantId: string;
  card: ProcedureDayScheduleCard;
  live: ProcedureDayLiveCardState;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(live.metrics.notes ?? "");
  const [postOpSummary, setPostOpSummary] = useState(live.postOpSummary ?? "");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
    });
  };

  const metricValue = useMemo(
    () => ({
      extracted: live.metrics.graftsExtracted ?? 0,
      implanted: live.metrics.graftsImplanted ?? 0,
      hairs: live.metrics.hairsCounted ?? 0,
    }),
    [live.metrics]
  );

  return (
    <article className="rounded-xl border border-white/[0.1] bg-[#0c1220]/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[#F8FAFC]">{card.patientLabel}</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            {card.timeLabel} · {card.procedureType ?? card.bookingTypeLabel}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Stage: <span className="font-medium text-[#E2E8F0]">{live.stageLabel}</span>
          </p>
        </div>
        {live.isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <StageTimeline currentStage={live.currentStage} />
      </div>

      {live.safetyWarnings.length ? (
        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-100/90">
            <AlertTriangle className="h-3.5 w-3.5" />
            Safety warnings
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
            {live.safetyWarnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
          <p className="text-xs text-[#64748B]">Grafts extracted</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{metricValue.extracted}</p>
          <button
            type="button"
            disabled={pending}
            className={cn(surgeryLinkButtonClass, "mt-2 w-full text-xs")}
            onClick={() =>
              run(() =>
                incrementProcedureDayGraftAction(tenantId, {
                  booking_id: card.bookingId,
                  field: "grafts_extracted",
                  delta: 10,
                })
              )
            }
          >
            <Plus className="mr-1 inline h-3 w-3" />
            +10
          </button>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
          <p className="text-xs text-[#64748B]">Grafts implanted</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{metricValue.implanted}</p>
          <button
            type="button"
            disabled={pending}
            className={cn(surgeryLinkButtonClass, "mt-2 w-full text-xs")}
            onClick={() =>
              run(() =>
                incrementProcedureDayGraftAction(tenantId, {
                  booking_id: card.bookingId,
                  field: "grafts_implanted",
                  delta: 10,
                })
              )
            }
          >
            <Plus className="mr-1 inline h-3 w-3" />
            +10
          </button>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
          <p className="text-xs text-[#64748B]">Hairs counted</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#F8FAFC]">{metricValue.hairs}</p>
          <button
            type="button"
            disabled={pending}
            className={cn(surgeryLinkButtonClass, "mt-2 w-full text-xs")}
            onClick={() =>
              run(() =>
                incrementProcedureDayGraftAction(tenantId, {
                  booking_id: card.bookingId,
                  field: "hairs_counted",
                  delta: 50,
                })
              )
            }
          >
            <Plus className="mr-1 inline h-3 w-3" />
            +50
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/20 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Checklist</p>
        <ul className="mt-2 space-y-1">
          {live.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm text-[#CBD5E1]">
              <CheckCircle2
                className={cn(
                  "h-4 w-4 shrink-0",
                  item.complete ? "text-emerald-400" : "text-[#475569]"
                )}
              />
              <span className={item.complete ? "text-[#E2E8F0]" : "text-[#94A3B8]"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-2">
        <label className="block text-xs font-medium text-[#94A3B8]">Operative notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-white/[0.1] bg-[#0a0f1a] px-3 py-2 text-sm text-[#E2E8F0]"
        />
        <button
          type="button"
          disabled={pending}
          className={cn(surgeryLinkButtonClass, "text-xs")}
          onClick={() =>
            run(() =>
              recordProcedureDayMetricAction(tenantId, {
                booking_id: card.bookingId,
                metric: "notes",
                value: notes,
              })
            )
          }
        >
          Save notes
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {live.canStart ? (
          <button
            type="button"
            disabled={pending}
            className={surgeryLinkButtonClass}
            onClick={() =>
              run(() => startProcedureDaySessionAction(tenantId, { booking_id: card.bookingId }))
            }
          >
            Start session
          </button>
        ) : null}
        {live.nextStage && live.currentStage !== "completed" ? (
          <button
            type="button"
            disabled={pending}
            className={surgeryLinkButtonClass}
            onClick={() =>
              run(() =>
                advanceProcedureDayStageAction(tenantId, {
                  booking_id: card.bookingId,
                  to_stage: live.nextStage ?? undefined,
                })
              )
            }
          >
            Advance to {live.nextStage ? PROCEDURE_DAY_STAGE_LABELS[live.nextStage] : "next"}
          </button>
        ) : null}
        {live.currentStage === "post_op" || live.currentStage === "quality_check" ? (
          <>
            <textarea
              value={postOpSummary}
              onChange={(e) => setPostOpSummary(e.target.value)}
              placeholder="Post-op handoff summary"
              rows={2}
              className="min-w-[220px] flex-1 rounded-lg border border-white/[0.1] bg-[#0a0f1a] px-3 py-2 text-sm text-[#E2E8F0]"
            />
            <button
              type="button"
              disabled={pending}
              className={surgeryLinkButtonClass}
              onClick={() =>
                run(() =>
                  completeProcedureDaySessionAction(tenantId, {
                    booking_id: card.bookingId,
                    post_op_summary: postOpSummary,
                    create_follow_up_task: true,
                  })
                )
              }
            >
              Complete procedure
            </button>
          </>
        ) : null}
        {live.currentStage === "post_op" || live.currentStage === "completed" ? (
          <button
            type="button"
            disabled={pending}
            className={surgeryLinkButtonClass}
            onClick={() =>
              run(() =>
                dischargeProcedureDayPatientAction(tenantId, {
                  booking_id: card.bookingId,
                })
              )
            }
          >
            Discharge patient
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </article>
  );
}

export function ProcedureDayLiveWorkflow({ data }: { data: ProcedureDayLiveBoardPayload }) {
  if (!data.liveWorkflowEnabled) return null;

  const cards = data.scheduleGroups.flatMap((g) => g.cards);
  const liveCards = cards.filter((c) => {
    const live = data.liveByBooking[c.bookingId];
    return live && (live.isLive || live.canStart || live.currentStage !== "scheduled");
  });

  if (!liveCards.length) return null;

  return (
    <DashboardCard elevated className="p-4 sm:p-6">
      <SectionHeader
        title="Live surgical cockpit"
        description={`${data.liveSummary.activeSessions} active · ${data.liveSummary.completedToday} completed · ${data.liveSummary.dischargedToday} discharged`}
      />
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {liveCards.map((card) => {
          const live = data.liveByBooking[card.bookingId];
          if (!live) return null;
          return (
            <LiveSurgeryCard key={card.bookingId} tenantId={data.tenantId} card={card} live={live} />
          );
        })}
      </div>
    </DashboardCard>
  );
}