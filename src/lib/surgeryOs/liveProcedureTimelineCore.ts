/**
 * SurgeryOS Sprint 1 — Live Procedure Timeline Engine (pure).
 * Composes fi_surgeries + fi_surgery_procedure_events into operational intelligence.
 */

import {
  SURGERY_OS_PROCEDURE_EVENT_LABELS,
  type SurgeryOsProcedureEventKind,
  type SurgeryOsProcedurePhase,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export const LIVE_PROCEDURE_TIMELINE_STAGES = [
  "patient_checked_in",
  "anaesthetic_started",
  "anaesthetic_completed",
  "extraction_started",
  "extraction_completed",
  "implantation_started",
  "implantation_completed",
  "break_started",
  "break_completed",
  "procedure_completed",
  "graft_count_reconciled",
] as const;

export type LiveProcedureTimelineStage = (typeof LIVE_PROCEDURE_TIMELINE_STAGES)[number];

export const LIVE_PROCEDURE_TIMELINE_STAGE_LABELS: Record<LiveProcedureTimelineStage, string> = {
  patient_checked_in: "Patient checked in",
  anaesthetic_started: "Anaesthetic started",
  anaesthetic_completed: "Anaesthetic completed",
  extraction_started: "Extraction started",
  extraction_completed: "Extraction completed",
  implantation_started: "Implantation started",
  implantation_completed: "Implantation completed",
  break_started: "Break started",
  break_completed: "Break completed",
  procedure_completed: "Procedure completed",
  graft_count_reconciled: "Graft count reconciled",
};

export type LiveProcedureTimelineStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type LiveProcedureTimelineItem = {
  stage: LiveProcedureTimelineStage;
  stageLabel: string;
  eventLabel: string;
  occurredAt: string;
};

export type LiveProcedureStageDuration = {
  stage: LiveProcedureTimelineStage;
  stageLabel: string;
  durationMinutes: number;
};

export type LiveProcedureDelaySignal = {
  kind: "stage_overrun" | "behind_schedule" | "long_break";
  stage: LiveProcedureTimelineStage | null;
  stageLabel: string | null;
  message: string;
  severity: "info" | "warning" | "critical";
  elapsedMinutes: number;
  thresholdMinutes: number;
};

export type LiveProcedureTimelineThresholds = {
  stageWarningMinutes: Partial<Record<LiveProcedureTimelineStage, number>>;
  overallDelayMinutes: number;
  longBreakMinutes: number;
};

export const DEFAULT_LIVE_PROCEDURE_TIMELINE_THRESHOLDS: LiveProcedureTimelineThresholds = {
  stageWarningMinutes: {
    extraction_started: 180,
    implantation_started: 240,
    break_started: 45,
  },
  overallDelayMinutes: 30,
  longBreakMinutes: 45,
};

export type LiveProcedureTimelineInputEvent = {
  eventKind: SurgeryOsProcedureEventKind;
  occurredAt: string;
};

export type LiveProcedureTimelineSurgeryContext = {
  surgeryId: string;
  patientLabel: string;
  status: string;
  procedurePhase: SurgeryOsProcedurePhase;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
};

export type LiveProcedureTimelineSnapshot = {
  surgeryId: string;
  patientLabel: string;
  currentStage: LiveProcedureTimelineStage | null;
  currentStageLabel: string | null;
  status: LiveProcedureTimelineStatus;
  elapsedMinutes: number | null;
  expectedCompletionTime: string | null;
  timelineItems: LiveProcedureTimelineItem[];
  stageDurations: LiveProcedureStageDuration[];
  delaySignals: LiveProcedureDelaySignal[];
  summary: string;
};

const EVENT_KIND_TO_STAGE: Partial<
  Record<SurgeryOsProcedureEventKind, LiveProcedureTimelineStage>
> = {
  patient_arrived: "patient_checked_in",
  anaesthetic_complete: "anaesthetic_completed",
  extraction_started: "extraction_started",
  extraction_paused: "extraction_started",
  extraction_resumed: "extraction_started",
  break: "break_started",
  break_started: "break_started",
  break_ended: "break_completed",
  site_making_started: "extraction_completed",
  implantation_started: "implantation_started",
  procedure_completed: "procedure_completed",
  graft_reconciliation_completed: "graft_count_reconciled",
};

const STAGE_RANK: Record<LiveProcedureTimelineStage, number> = LIVE_PROCEDURE_TIMELINE_STAGES.reduce(
  (acc, stage, index) => {
    acc[stage] = index;
    return acc;
  },
  {} as Record<LiveProcedureTimelineStage, number>
);

function safeParseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function minutesBetween(startMs: number | null, endMs: number | null): number | null {
  if (startMs == null || endMs == null) return null;
  const diff = (endMs - startMs) / 60_000;
  if (!Number.isFinite(diff)) return null;
  return clampMinutes(diff);
}

function resolveTimelineStatus(input: LiveProcedureTimelineSurgeryContext): LiveProcedureTimelineStatus {
  const status = input.status.trim().toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (status === "completed" || input.procedurePhase === "completed") return "completed";
  if (status === "paused" || input.procedurePhase === "extraction_paused") return "paused";
  if (
    input.procedurePhase === "pre_op" &&
    status === "scheduled" &&
    !input.actualStartAt
  ) {
    return "not_started";
  }
  return "in_progress";
}

function resolveEventLabel(kind: SurgeryOsProcedureEventKind): string {
  return SURGERY_OS_PROCEDURE_EVENT_LABELS[kind] ?? kind.replaceAll("_", " ");
}

function buildTimelineItems(
  events: LiveProcedureTimelineInputEvent[]
): LiveProcedureTimelineItem[] {
  const sorted = [...events].sort(
    (a, b) => (safeParseMs(a.occurredAt) ?? 0) - (safeParseMs(b.occurredAt) ?? 0)
  );

  const items: LiveProcedureTimelineItem[] = [];
  const seenStages = new Set<LiveProcedureTimelineStage>();

  for (const event of sorted) {
    const stage = EVENT_KIND_TO_STAGE[event.eventKind];
    if (!stage) continue;

    // Keep the latest occurrence per stage while preserving chronological order in output.
    if (seenStages.has(stage)) {
      const existingIndex = items.findIndex((item) => item.stage === stage);
      if (existingIndex >= 0) {
        items[existingIndex] = {
          stage,
          stageLabel: LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[stage],
          eventLabel: resolveEventLabel(event.eventKind),
          occurredAt: event.occurredAt,
        };
      }
      continue;
    }

    seenStages.add(stage);
    items.push({
      stage,
      stageLabel: LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[stage],
      eventLabel: resolveEventLabel(event.eventKind),
      occurredAt: event.occurredAt,
    });
  }

  return items.sort(
    (a, b) => (safeParseMs(a.occurredAt) ?? 0) - (safeParseMs(b.occurredAt) ?? 0)
  );
}

function deriveCurrentStage(
  items: LiveProcedureTimelineItem[]
): LiveProcedureTimelineStage | null {
  if (!items.length) return null;

  let latest: LiveProcedureTimelineItem | null = null;
  for (const item of items) {
    if (!latest) {
      latest = item;
      continue;
    }
    const itemRank = STAGE_RANK[item.stage];
    const latestRank = STAGE_RANK[latest.stage];
    const itemMs = safeParseMs(item.occurredAt) ?? 0;
    const latestMs = safeParseMs(latest.occurredAt) ?? 0;
    if (itemRank > latestRank || (itemRank === latestRank && itemMs >= latestMs)) {
      latest = item;
    }
  }
  return latest?.stage ?? null;
}

function computeStageDurations(items: LiveProcedureTimelineItem[]): LiveProcedureStageDuration[] {
  const durations: LiveProcedureStageDuration[] = [];
  for (let i = 0; i < items.length - 1; i += 1) {
    const current = items[i];
    const next = items[i + 1];
    const minutes = minutesBetween(safeParseMs(current.occurredAt), safeParseMs(next.occurredAt));
    if (minutes == null) continue;
    durations.push({
      stage: current.stage,
      stageLabel: current.stageLabel,
      durationMinutes: minutes,
    });
  }
  return durations;
}

function computeElapsedMinutes(input: {
  surgery: LiveProcedureTimelineSurgeryContext;
  items: LiveProcedureTimelineItem[];
  nowMs: number;
}): number | null {
  const endMs =
    safeParseMs(input.surgery.actualEndAt) ??
    (resolveTimelineStatus(input.surgery) === "completed" && input.items.length
      ? safeParseMs(input.items[input.items.length - 1]?.occurredAt)
      : null);

  const startMs =
    safeParseMs(input.surgery.actualStartAt) ??
    (input.items.length ? safeParseMs(input.items[0]?.occurredAt) : null) ??
    safeParseMs(input.surgery.scheduledStartAt);

  if (startMs == null) return null;
  const end = endMs ?? input.nowMs;
  return minutesBetween(startMs, end);
}

function computeExpectedCompletionTime(input: {
  surgery: LiveProcedureTimelineSurgeryContext;
  elapsedMinutes: number | null;
  status: LiveProcedureTimelineStatus;
}): string | null {
  if (input.status === "completed") {
    const completedAt =
      safeParseMs(input.surgery.actualEndAt) != null ? input.surgery.actualEndAt : null;
    if (completedAt) return completedAt;
    return safeParseMs(input.surgery.scheduledEndAt) != null
      ? input.surgery.scheduledEndAt
      : null;
  }
  if (safeParseMs(input.surgery.scheduledEndAt) != null) {
    return input.surgery.scheduledEndAt!.trim();
  }
  if (input.elapsedMinutes != null && input.elapsedMinutes > 0) {
    const startMs =
      safeParseMs(input.surgery.actualStartAt) ?? safeParseMs(input.surgery.scheduledStartAt);
    if (startMs == null) return null;
    const projectedMs = startMs + 8 * 60 * 60_000;
    return new Date(projectedMs).toISOString();
  }
  return null;
}

function deriveDelaySignals(input: {
  surgery: LiveProcedureTimelineSurgeryContext;
  items: LiveProcedureTimelineItem[];
  currentStage: LiveProcedureTimelineStage | null;
  elapsedMinutes: number | null;
  nowMs: number;
  thresholds: LiveProcedureTimelineThresholds;
}): LiveProcedureDelaySignal[] {
  const signals: LiveProcedureDelaySignal[] = [];

  if (input.currentStage) {
    const latestForStage = [...input.items]
      .reverse()
      .find((item) => item.stage === input.currentStage);
    const stageStartMs = safeParseMs(latestForStage?.occurredAt);
    const stageElapsed = minutesBetween(stageStartMs, input.nowMs);
    const threshold = input.thresholds.stageWarningMinutes[input.currentStage];
    if (
      stageElapsed != null &&
      threshold != null &&
      threshold > 0 &&
      stageElapsed >= threshold
    ) {
      signals.push({
        kind: "stage_overrun",
        stage: input.currentStage,
        stageLabel: LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[input.currentStage],
        message: `${LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[input.currentStage]} has run ${stageElapsed} min (threshold ${threshold} min).`,
        severity: stageElapsed >= threshold * 1.25 ? "critical" : "warning",
        elapsedMinutes: stageElapsed,
        thresholdMinutes: threshold,
      });
    }
  }

  const scheduledEndMs = safeParseMs(input.surgery.scheduledEndAt);
  if (
    scheduledEndMs != null &&
    input.nowMs > scheduledEndMs &&
    resolveTimelineStatus(input.surgery) !== "completed"
  ) {
    const behind = minutesBetween(scheduledEndMs, input.nowMs) ?? 0;
    if (behind >= input.thresholds.overallDelayMinutes) {
      signals.push({
        kind: "behind_schedule",
        stage: input.currentStage,
        stageLabel: input.currentStage
          ? LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[input.currentStage]
          : null,
        message: `Procedure is ${behind} min past scheduled completion.`,
        severity: behind >= input.thresholds.overallDelayMinutes * 2 ? "critical" : "warning",
        elapsedMinutes: behind,
        thresholdMinutes: input.thresholds.overallDelayMinutes,
      });
    }
  }

  const breakStart = [...input.items].reverse().find((item) => item.stage === "break_started");
  const breakEnd = [...input.items].reverse().find((item) => item.stage === "break_completed");
  const breakStartMs = safeParseMs(breakStart?.occurredAt);
  const breakEndMs = safeParseMs(breakEnd?.occurredAt);
  if (breakStartMs != null && (breakEndMs == null || breakEndMs < breakStartMs)) {
    const breakMinutes = minutesBetween(breakStartMs, input.nowMs) ?? 0;
    if (breakMinutes >= input.thresholds.longBreakMinutes) {
      signals.push({
        kind: "long_break",
        stage: "break_started",
        stageLabel: LIVE_PROCEDURE_TIMELINE_STAGE_LABELS.break_started,
        message: `Break has lasted ${breakMinutes} min.`,
        severity: breakMinutes >= input.thresholds.longBreakMinutes * 1.5 ? "critical" : "warning",
        elapsedMinutes: breakMinutes,
        thresholdMinutes: input.thresholds.longBreakMinutes,
      });
    }
  }

  return signals;
}

function buildSummary(input: {
  patientLabel: string;
  status: LiveProcedureTimelineStatus;
  currentStage: LiveProcedureTimelineStage | null;
  elapsedMinutes: number | null;
  delayCount: number;
  hasEvents: boolean;
}): string {
  if (!input.hasEvents) {
    return "No live theatre events recorded yet.";
  }

  const stagePart = input.currentStage
    ? LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[input.currentStage]
    : "Awaiting next milestone";
  const elapsedPart =
    input.elapsedMinutes != null ? `${input.elapsedMinutes} min elapsed` : "Elapsed time pending";

  if (input.status === "completed") {
    return `${input.patientLabel} — procedure completed (${elapsedPart}).`;
  }
  if (input.delayCount > 0) {
    return `${input.patientLabel} — ${stagePart}; ${elapsedPart}; ${input.delayCount} delay signal(s).`;
  }
  return `${input.patientLabel} — ${stagePart}; ${elapsedPart}.`;
}

export function buildLiveProcedureTimeline(input: {
  surgery: LiveProcedureTimelineSurgeryContext;
  events: LiveProcedureTimelineInputEvent[];
  now?: Date;
  thresholds?: LiveProcedureTimelineThresholds;
}): LiveProcedureTimelineSnapshot {
  const nowMs = (input.now ?? new Date()).getTime();
  const thresholds = input.thresholds ?? DEFAULT_LIVE_PROCEDURE_TIMELINE_THRESHOLDS;
  const timelineItems = buildTimelineItems(input.events);
  const currentStage = deriveCurrentStage(timelineItems);
  const status = resolveTimelineStatus(input.surgery);
  const elapsedMinutes = computeElapsedMinutes({
    surgery: input.surgery,
    items: timelineItems,
    nowMs,
  });
  const expectedCompletionTime = computeExpectedCompletionTime({
    surgery: input.surgery,
    elapsedMinutes,
    status,
  });
  const stageDurations = computeStageDurations(timelineItems);
  const delaySignals = timelineItems.length
    ? deriveDelaySignals({
        surgery: input.surgery,
        items: timelineItems,
        currentStage,
        elapsedMinutes,
        nowMs,
        thresholds,
      })
    : [];

  return {
    surgeryId: input.surgery.surgeryId,
    patientLabel: input.surgery.patientLabel,
    currentStage,
    currentStageLabel: currentStage ? LIVE_PROCEDURE_TIMELINE_STAGE_LABELS[currentStage] : null,
    status,
    elapsedMinutes,
    expectedCompletionTime,
    timelineItems,
    stageDurations,
    delaySignals,
    summary: buildSummary({
      patientLabel: input.surgery.patientLabel,
      status,
      currentStage,
      elapsedMinutes,
      delayCount: delaySignals.length,
      hasEvents: timelineItems.length > 0,
    }),
  };
}

export function buildLiveProcedureTimelinesForSurgeries(input: {
  surgeries: LiveProcedureTimelineSurgeryContext[];
  eventsBySurgeryId: Map<string, LiveProcedureTimelineInputEvent[]>;
  now?: Date;
  thresholds?: LiveProcedureTimelineThresholds;
}): LiveProcedureTimelineSnapshot[] {
  return input.surgeries.map((surgery) =>
    buildLiveProcedureTimeline({
      surgery,
      events: input.eventsBySurgeryId.get(surgery.surgeryId) ?? [],
      now: input.now,
      thresholds: input.thresholds,
    })
  );
}
