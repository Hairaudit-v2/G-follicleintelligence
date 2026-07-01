/**
 * SurgeryOS Sprint 2 — Transection Monitoring Engine (pure).
 * Tracks graft damage quality from tray review and reconciliation data.
 */

import type { SurgeryOsGraftCountEventType } from "@/src/lib/surgeryOs/surgeryOsGraftModel";

export type TransectionMonitoringStatus = "excellent" | "acceptable" | "watch" | "critical";

export type TransectionMonitoringWarning = {
  kind: "no_data" | "unclassified_damage" | "pending_tray_review" | "elevated_rate";
  message: string;
  severity: "info" | "warning" | "critical";
};

export type TransectionMonitoringTrayEvent = {
  eventType: SurgeryOsGraftCountEventType;
  reviewStatus?: "pending" | "confirmed" | "rejected" | null;
  singles: number | null;
  doubles: number | null;
  triples: number | null;
  multiples: number | null;
  deltaDiscarded: number;
  note: string | null;
};

export type TransectionMonitoringInput = {
  surgeryId: string;
  patientLabel: string;
  trayEvents: TransectionMonitoringTrayEvent[];
  pendingTrayCount?: number;
};

export type TransectionMonitoringSnapshot = {
  surgeryId: string;
  patientLabel: string;
  totalGraftsReviewed: number;
  partialTransections: number;
  fullTransections: number;
  transectionRate: number | null;
  qualityScore: number;
  status: TransectionMonitoringStatus;
  warnings: TransectionMonitoringWarning[];
  summary: string;
};

export const DEFAULT_TRANSECTION_MONITORING_THRESHOLDS = {
  excellentRatePercent: 2,
  acceptableRatePercent: 5,
  watchRatePercent: 10,
} as const;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function roundRatePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0 || numerator < 0 || !Number.isFinite(numerator)) return null;
  const rate = (numerator / denominator) * 100;
  if (!Number.isFinite(rate)) return null;
  return Math.round(rate * 10) / 10;
}

function trayGraftTotal(event: TransectionMonitoringTrayEvent): number {
  return (
    Math.max(0, event.singles ?? 0) +
    Math.max(0, event.doubles ?? 0) +
    Math.max(0, event.triples ?? 0) +
    Math.max(0, event.multiples ?? 0)
  );
}

function classifyDamagedUnits(note: string | null, damaged: number): {
  partial: number;
  full: number;
  unclassified: number;
} {
  if (damaged <= 0) return { partial: 0, full: 0, unclassified: 0 };

  const normalized = (note ?? "").trim().toLowerCase();
  const isFull =
    /\bfull\b/.test(normalized) ||
    /\bcomplete transection\b/.test(normalized) ||
    /\bfully transected\b/.test(normalized);
  const isPartial =
    /\bpartial\b/.test(normalized) ||
    /\bpartial transection\b/.test(normalized);

  if (isFull && !isPartial) return { partial: 0, full: damaged, unclassified: 0 };
  if (isPartial && !isFull) return { partial: damaged, full: 0, unclassified: 0 };
  if (isFull && isPartial) {
    const half = Math.floor(damaged / 2);
    return { partial: half, full: damaged - half, unclassified: 0 };
  }

  return { partial: 0, full: 0, unclassified: damaged };
}

function resolveStatus(
  ratePercent: number | null,
  thresholds: typeof DEFAULT_TRANSECTION_MONITORING_THRESHOLDS
): TransectionMonitoringStatus {
  if (ratePercent == null) return "excellent";
  if (ratePercent >= thresholds.watchRatePercent) return "critical";
  if (ratePercent >= thresholds.acceptableRatePercent) return "watch";
  if (ratePercent >= thresholds.excellentRatePercent) return "acceptable";
  return "excellent";
}

function computeQualityScore(ratePercent: number | null): number {
  if (ratePercent == null) return 100;
  return clampPercent(100 - ratePercent * 8);
}

function buildSummary(input: {
  patientLabel: string;
  hasData: boolean;
  ratePercent: number | null;
  status: TransectionMonitoringStatus;
}): string {
  if (!input.hasData) {
    return "No transection monitoring data available.";
  }

  const ratePart =
    input.ratePercent != null ? `${input.ratePercent}% transection rate` : "Transection rate pending";

  return `${input.patientLabel} — ${ratePart}; ${input.status}.`;
}

export function buildTransectionMonitoring(
  input: TransectionMonitoringInput,
  thresholds: typeof DEFAULT_TRANSECTION_MONITORING_THRESHOLDS = DEFAULT_TRANSECTION_MONITORING_THRESHOLDS
): TransectionMonitoringSnapshot {
  let totalGraftsReviewed = 0;
  let partialTransections = 0;
  let fullTransections = 0;
  let unclassifiedDamage = 0;
  const warnings: TransectionMonitoringWarning[] = [];

  for (const event of input.trayEvents) {
    if (event.eventType !== "tray_count") continue;

    const grafts = trayGraftTotal(event);
    const damaged = Math.max(0, event.deltaDiscarded ?? 0);
    const status = event.reviewStatus ?? "pending";

    if (status === "confirmed") {
      totalGraftsReviewed += grafts + damaged;
      const classified = classifyDamagedUnits(event.note, damaged);
      partialTransections += classified.partial;
      fullTransections += classified.full;
      unclassifiedDamage += classified.unclassified;
    } else if (status === "pending" && (grafts > 0 || damaged > 0)) {
      warnings.push({
        kind: "pending_tray_review",
        message: "Tray review pending — transection totals may change after nurse confirmation.",
        severity: "info",
      });
    }
  }

  const pendingTrayCount = input.pendingTrayCount ?? 0;
  if (pendingTrayCount > 0 && !warnings.some((w) => w.kind === "pending_tray_review")) {
    warnings.push({
      kind: "pending_tray_review",
      message: `${pendingTrayCount} tray(s) awaiting review before transection monitoring is complete.`,
      severity: "info",
    });
  }

  if (unclassifiedDamage > 0) {
    partialTransections += unclassifiedDamage;
    warnings.push({
      kind: "unclassified_damage",
      message: `${unclassifiedDamage} damaged unit(s) recorded without partial/full classification — counted as partial for monitoring.`,
      severity: "warning",
    });
  }

  const totalTransections = partialTransections + fullTransections;
  const hasData = totalGraftsReviewed > 0 || totalTransections > 0;

  if (!hasData) {
    return {
      surgeryId: input.surgeryId,
      patientLabel: input.patientLabel,
      totalGraftsReviewed: 0,
      partialTransections: 0,
      fullTransections: 0,
      transectionRate: null,
      qualityScore: 100,
      status: "excellent",
      warnings: [
        {
          kind: "no_data",
          message: "No transection monitoring data available.",
          severity: "info",
        },
      ],
      summary: "No transection monitoring data available.",
    };
  }

  const transectionRate = roundRatePercent(totalTransections, totalGraftsReviewed);
  const status = resolveStatus(transectionRate, thresholds);
  const qualityScore = computeQualityScore(transectionRate);

  if (status === "critical" || status === "watch") {
    warnings.push({
      kind: "elevated_rate",
      message: `Transection rate ${transectionRate ?? "—"}% exceeds safe operating threshold.`,
      severity: status === "critical" ? "critical" : "warning",
    });
  }

  return {
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    totalGraftsReviewed,
    partialTransections,
    fullTransections,
    transectionRate,
    qualityScore,
    status,
    warnings: warnings.filter((w) => w.kind !== "no_data"),
    summary: buildSummary({
      patientLabel: input.patientLabel,
      hasData: true,
      ratePercent: transectionRate,
      status,
    }),
  };
}

export function buildTransectionMonitoringForSurgeries(
  inputs: TransectionMonitoringInput[]
): TransectionMonitoringSnapshot[] {
  return inputs.map((input) => buildTransectionMonitoring(input));
}
