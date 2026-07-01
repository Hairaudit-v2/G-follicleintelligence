/**
 * SurgeryOS Sprint 2 — Extraction Velocity Engine (pure).
 * Measures extraction efficiency from graft session data and procedure events.
 */

import type { SurgeryOsProcedureEventKind } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export type ExtractionVelocityHourlyBucket = {
  hourIndex: number;
  label: string;
  graftsExtracted: number;
  ratePerHour: number;
};

export type ExtractionVelocityTrendDirection = "up" | "down" | "stable";

export type ExtractionVelocityInputEvent = {
  eventKind: SurgeryOsProcedureEventKind;
  occurredAt: string;
};

export type ExtractionVelocityGraftEvent = {
  occurredAt: string;
  deltaExtracted: number;
};

export type ExtractionVelocityInput = {
  surgeryId: string;
  patientLabel: string;
  extractedGrafts: number;
  events: ExtractionVelocityInputEvent[];
  graftEvents?: ExtractionVelocityGraftEvent[];
  now?: Date;
};

export type ExtractionVelocitySnapshot = {
  surgeryId: string;
  patientLabel: string;
  graftsExtracted: number;
  extractionRatePerHour: number | null;
  hourlyBreakdown: ExtractionVelocityHourlyBucket[];
  peakEfficiencyWindow: string | null;
  efficiencyDeclinePercent: number | null;
  fatigueSignal: boolean;
  trendDirection: ExtractionVelocityTrendDirection;
  summary: string;
};

export const DEFAULT_EXTRACTION_VELOCITY_THRESHOLDS = {
  fatigueDeclinePercent: 15,
  stableTrendPercent: 5,
} as const;

function safeParseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function clampPercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function roundRate(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function resolveExtractionWindowMs(input: {
  events: ExtractionVelocityInputEvent[];
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

    if (event.eventKind === "extraction_started" || event.eventKind === "extraction_resumed") {
      startMs = ms;
      endMs = null;
    }

    if (
      startMs != null &&
      (event.eventKind === "extraction_paused" ||
        event.eventKind === "break" ||
        event.eventKind === "break_started" ||
        event.eventKind === "site_making_started")
    ) {
      endMs = ms;
    }
  }

  if (startMs == null) return null;
  return { startMs, endMs: endMs ?? input.nowMs };
}

function buildHourlyBreakdown(input: {
  window: { startMs: number; endMs: number };
  graftEvents: ExtractionVelocityGraftEvent[];
  totalExtracted: number;
}): ExtractionVelocityHourlyBucket[] {
  const durationMs = Math.max(0, input.window.endMs - input.window.startMs);
  const hourCount = Math.max(1, Math.ceil(durationMs / 3_600_000));

  const buckets: ExtractionVelocityHourlyBucket[] = [];
  for (let hourIndex = 0; hourIndex < hourCount; hourIndex += 1) {
    const bucketStart = input.window.startMs + hourIndex * 3_600_000;
    const bucketEnd = Math.min(input.window.endMs, bucketStart + 3_600_000);
    const bucketMinutes = Math.max(1, (bucketEnd - bucketStart) / 60_000);

    let graftsInBucket = 0;
    for (const event of input.graftEvents) {
      const ms = safeParseMs(event.occurredAt);
      if (ms == null || ms < bucketStart || ms >= bucketEnd) continue;
      if (event.deltaExtracted > 0) graftsInBucket += event.deltaExtracted;
    }

    buckets.push({
      hourIndex,
      label: `Hour ${hourIndex + 1}`,
      graftsExtracted: graftsInBucket,
      ratePerHour: roundRate((graftsInBucket / bucketMinutes) * 60) ?? 0,
    });
  }

  const trackedTotal = buckets.reduce((sum, bucket) => sum + bucket.graftsExtracted, 0);
  if (trackedTotal <= 0 && input.totalExtracted > 0 && buckets.length > 0) {
    const perHour = Math.floor(input.totalExtracted / buckets.length);
    let remainder = input.totalExtracted - perHour * buckets.length;
    for (const bucket of buckets) {
      bucket.graftsExtracted = perHour + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      bucket.ratePerHour = roundRate(bucket.graftsExtracted) ?? 0;
    }
  }

  return buckets;
}

function derivePeakEfficiencyWindow(buckets: ExtractionVelocityHourlyBucket[]): string | null {
  if (!buckets.length) return null;
  let peak = buckets[0]!;
  for (const bucket of buckets) {
    if (bucket.ratePerHour > peak.ratePerHour) peak = bucket;
  }
  if (peak.ratePerHour <= 0) return null;
  return peak.label;
}

function deriveEfficiencyDecline(buckets: ExtractionVelocityHourlyBucket[]): number | null {
  if (buckets.length < 2) return null;

  const firstHalf = buckets.slice(0, Math.ceil(buckets.length / 2));
  const secondHalf = buckets.slice(Math.ceil(buckets.length / 2));

  const avg = (items: ExtractionVelocityHourlyBucket[]) => {
    const rates = items.map((b) => b.ratePerHour).filter((r) => r > 0);
    if (!rates.length) return null;
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  };

  const firstAvg = avg(firstHalf);
  const secondAvg = avg(secondHalf);
  if (firstAvg == null || secondAvg == null || firstAvg <= 0) return null;

  const decline = ((firstAvg - secondAvg) / firstAvg) * 100;
  if (!Number.isFinite(decline)) return null;
  return clampPercent(Math.max(0, decline));
}

function deriveTrendDirection(
  declinePercent: number | null,
  thresholds: typeof DEFAULT_EXTRACTION_VELOCITY_THRESHOLDS
): ExtractionVelocityTrendDirection {
  if (declinePercent == null) return "stable";
  if (declinePercent >= thresholds.stableTrendPercent) return "down";
  if (declinePercent <= -thresholds.stableTrendPercent) return "up";
  return "stable";
}

function buildSummary(input: {
  patientLabel: string;
  hasData: boolean;
  rate: number | null;
  declinePercent: number | null;
  fatigueSignal: boolean;
}): string {
  if (!input.hasData) {
    return "No extraction velocity data available.";
  }

  const ratePart =
    input.rate != null ? `${input.rate} grafts/hour extraction rate` : "Extraction rate pending";

  if (input.fatigueSignal && input.declinePercent != null) {
    return `${input.patientLabel} — ${ratePart}; efficiency decline ${input.declinePercent}%; possible operator fatigue.`;
  }

  if (input.declinePercent != null && input.declinePercent > 0) {
    return `${input.patientLabel} — ${ratePart}; efficiency decline ${input.declinePercent}%.`;
  }

  return `${input.patientLabel} — ${ratePart}.`;
}

export function buildExtractionVelocity(
  input: ExtractionVelocityInput,
  thresholds: typeof DEFAULT_EXTRACTION_VELOCITY_THRESHOLDS = DEFAULT_EXTRACTION_VELOCITY_THRESHOLDS
): ExtractionVelocitySnapshot {
  const nowMs = (input.now ?? new Date()).getTime();
  const graftsExtracted = Math.max(0, input.extractedGrafts);
  const window = resolveExtractionWindowMs({ events: input.events, nowMs });

  if (!window || graftsExtracted <= 0) {
    return {
      surgeryId: input.surgeryId,
      patientLabel: input.patientLabel,
      graftsExtracted,
      extractionRatePerHour: null,
      hourlyBreakdown: [],
      peakEfficiencyWindow: null,
      efficiencyDeclinePercent: null,
      fatigueSignal: false,
      trendDirection: "stable",
      summary: "No extraction velocity data available.",
    };
  }

  const durationHours = Math.max(1 / 60, (window.endMs - window.startMs) / 3_600_000);
  const extractionRatePerHour = roundRate(graftsExtracted / durationHours);

  const hourlyBreakdown = buildHourlyBreakdown({
    window,
    graftEvents: input.graftEvents ?? [],
    totalExtracted: graftsExtracted,
  });

  const peakEfficiencyWindow = derivePeakEfficiencyWindow(hourlyBreakdown);
  const efficiencyDeclinePercent = deriveEfficiencyDecline(hourlyBreakdown);
  const fatigueSignal =
    efficiencyDeclinePercent != null &&
    efficiencyDeclinePercent >= thresholds.fatigueDeclinePercent;
  const trendDirection = deriveTrendDirection(efficiencyDeclinePercent, thresholds);

  return {
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    graftsExtracted,
    extractionRatePerHour,
    hourlyBreakdown,
    peakEfficiencyWindow,
    efficiencyDeclinePercent,
    fatigueSignal,
    trendDirection,
    summary: buildSummary({
      patientLabel: input.patientLabel,
      hasData: true,
      rate: extractionRatePerHour,
      declinePercent: efficiencyDeclinePercent,
      fatigueSignal,
    }),
  };
}

export function buildExtractionVelocityForSurgeries(
  inputs: ExtractionVelocityInput[]
): ExtractionVelocitySnapshot[] {
  return inputs.map((input) => buildExtractionVelocity(input));
}
