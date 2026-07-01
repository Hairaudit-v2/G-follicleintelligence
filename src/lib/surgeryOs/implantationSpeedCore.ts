/**
 * SurgeryOS Sprint 2 — Implantation Speed Engine (pure).
 * Measures implantation efficiency from procedure events and graft counts.
 */

import type { SurgeryOsProcedureEventKind } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export type ImplantationSpeedTrendDirection = "up" | "down" | "stable";

export type ImplantationSpeedInputEvent = {
  eventKind: SurgeryOsProcedureEventKind;
  occurredAt: string;
};

export type ImplantationSpeedGraftEvent = {
  occurredAt: string;
  deltaImplanted: number;
};

export type ImplantationSpeedInput = {
  surgeryId: string;
  patientLabel: string;
  implantedGrafts: number;
  events: ImplantationSpeedInputEvent[];
  graftEvents?: ImplantationSpeedGraftEvent[];
  now?: Date;
};

export type ImplantationSpeedSnapshot = {
  surgeryId: string;
  patientLabel: string;
  implantedGrafts: number;
  implantationRatePerHour: number | null;
  implantationDurationMinutes: number | null;
  efficiencyScore: number;
  trendDirection: ImplantationSpeedTrendDirection;
  summary: string;
};

export const DEFAULT_IMPLANTATION_SPEED_THRESHOLDS = {
  optimalRatePerHour: 600,
  stableTrendPercent: 5,
} as const;

function safeParseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function roundRate(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function resolveImplantationWindowMs(input: {
  events: ImplantationSpeedInputEvent[];
  nowMs: number;
}): { startMs: number; endMs: number } | null {
  const sorted = [...input.events].sort(
    (a, b) => (safeParseMs(a.occurredAt) ?? 0) - (safeParseMs(b.occurredAt) ?? 0)
  );

  let startMs: number | null = null;
  let endMs: number | null = null;

  for (const event of sorted) {
    const ms = safeParseMs(event.occurredAt);
    if (ms == null) continue;

    if (event.eventKind === "implantation_started") {
      startMs = ms;
      endMs = null;
    }

    if (
      startMs != null &&
      (event.eventKind === "procedure_completed" || event.eventKind === "break_started")
    ) {
      endMs = ms;
    }
  }

  if (startMs == null) return null;
  return { startMs, endMs: endMs ?? input.nowMs };
}

function deriveTrendFromGraftEvents(events: ImplantationSpeedGraftEvent[]): ImplantationSpeedTrendDirection {
  if (events.length < 4) return "stable";

  const sorted = [...events]
    .filter((e) => e.deltaImplanted > 0)
    .sort((a, b) => (safeParseMs(a.occurredAt) ?? 0) - (safeParseMs(b.occurredAt) ?? 0));

  if (sorted.length < 4) return "stable";

  const midpoint = Math.ceil(sorted.length / 2);
  const first = sorted.slice(0, midpoint).reduce((sum, e) => sum + e.deltaImplanted, 0);
  const second = sorted.slice(midpoint).reduce((sum, e) => sum + e.deltaImplanted, 0);

  if (first <= 0) return "stable";
  const deltaPercent = ((second - first) / first) * 100;
  if (deltaPercent >= DEFAULT_IMPLANTATION_SPEED_THRESHOLDS.stableTrendPercent) return "up";
  if (deltaPercent <= -DEFAULT_IMPLANTATION_SPEED_THRESHOLDS.stableTrendPercent) return "down";
  return "stable";
}

function computeEfficiencyScore(ratePerHour: number | null): number {
  if (ratePerHour == null || ratePerHour <= 0) return 0;
  const optimal = DEFAULT_IMPLANTATION_SPEED_THRESHOLDS.optimalRatePerHour;
  const ratio = ratePerHour / optimal;
  if (ratio >= 1) return 100;
  return clampPercent(ratio * 100);
}

function efficiencyLabel(score: number): string {
  if (score >= 95) return "Optimal";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Moderate";
  return "Below target";
}

function buildSummary(input: {
  patientLabel: string;
  hasData: boolean;
  rate: number | null;
  efficiencyScore: number;
}): string {
  if (!input.hasData) {
    return "No implantation speed data available.";
  }

  const ratePart =
    input.rate != null ? `${input.rate} grafts/hour` : "Implantation rate pending";

  return `${input.patientLabel} — ${ratePart}; ${efficiencyLabel(input.efficiencyScore)}.`;
}

export function buildImplantationSpeed(
  input: ImplantationSpeedInput
): ImplantationSpeedSnapshot {
  const nowMs = (input.now ?? new Date()).getTime();
  const implantedGrafts = Math.max(0, input.implantedGrafts);
  const window = resolveImplantationWindowMs({ events: input.events, nowMs });

  if (!window || implantedGrafts <= 0) {
    return {
      surgeryId: input.surgeryId,
      patientLabel: input.patientLabel,
      implantedGrafts,
      implantationRatePerHour: null,
      implantationDurationMinutes: null,
      efficiencyScore: 0,
      trendDirection: "stable",
      summary: "No implantation speed data available.",
    };
  }

  const durationMinutes = clampMinutes((window.endMs - window.startMs) / 60_000);
  const durationHours = Math.max(1 / 60, durationMinutes / 60);
  const implantationRatePerHour = roundRate(implantedGrafts / durationHours);
  const efficiencyScore = computeEfficiencyScore(implantationRatePerHour);
  const trendDirection = deriveTrendFromGraftEvents(input.graftEvents ?? []);

  return {
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    implantedGrafts,
    implantationRatePerHour,
    implantationDurationMinutes: durationMinutes > 0 ? durationMinutes : null,
    efficiencyScore,
    trendDirection,
    summary: buildSummary({
      patientLabel: input.patientLabel,
      hasData: true,
      rate: implantationRatePerHour,
      efficiencyScore,
    }),
  };
}

export function buildImplantationSpeedForSurgeries(
  inputs: ImplantationSpeedInput[]
): ImplantationSpeedSnapshot[] {
  return inputs.map((input) => buildImplantationSpeed(input));
}
