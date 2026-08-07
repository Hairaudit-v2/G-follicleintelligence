/**
 * FI-DEMO-DAY-2A.4 — Outcomes composition with strict fixture vs observed labelling.
 *
 * Future fixture rows MUST surface as demonstration projections / future milestones —
 * never as completed patient follow-ups.
 */

import { evidenceKindBadge } from "./patientTwinOverviewCopy";
import type {
  OverviewAvailability,
  OverviewOutcomeMilestone,
  OverviewOutcomesSection,
  OutcomeEvidenceKind,
} from "./patientTwinOverviewTypes";

export type OutcomeMeasurementComposeRow = {
  id: string;
  checkpoint_key: string;
  measurement_date: string | null;
  metric_values: Record<string, unknown>;
  /** Optional metadata from fi_patient_outcome_measurements.metadata */
  metadata?: Record<string, unknown> | null;
};

export type ProjectedOutcomeInput = {
  status?: string | null;
  graftTarget?: number | null;
  generatedAt?: string | null;
};

const MILESTONE_LABELS: Record<string, string> = {
  month_3: "3-month milestone",
  month_6: "6-month milestone",
  month_12: "12-month milestone",
  day_7: "Day-7 checkpoint",
  day_1: "Day-1 checkpoint",
  baseline: "Baseline checkpoint",
};

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function metaBool(meta: Record<string, unknown> | null | undefined, key: string): boolean {
  if (!meta) return false;
  const v = meta[key];
  return v === true || v === "true" || v === 1 || v === "1";
}

/**
 * Resolve evidence kind from metric_values + metadata.
 * Prefer explicit observation_status / future_dated_fixture over guessing from dates.
 */
export function resolveOutcomeEvidenceKind(row: OutcomeMeasurementComposeRow): OutcomeEvidenceKind {
  const metrics = row.metric_values ?? {};
  const meta = row.metadata ?? {};
  const statusRaw = metrics.observation_status ?? meta.observation_status;
  const status = typeof statusRaw === "string" ? statusRaw.trim().toLowerCase() : "";

  const futureDated = metaBool(meta, "future_dated_fixture");

  if (status === "projected_fixture" || status === "future_dated_fixture") {
    return futureDated || status === "future_dated_fixture"
      ? "future_dated_fixture"
      : "projected_fixture";
  }
  if (futureDated) return "future_dated_fixture";
  if (status === "projected" || status === "projected_outcome") return "projected_outcome";
  if (status === "observed" || status === "observed_clinical") return "observed_clinical";

  // Without explicit markers, do not invent observed clinical evidence.
  return "projected_fixture";
}

function availabilityForEvidence(kind: OutcomeEvidenceKind): OverviewAvailability {
  if (kind === "observed_clinical" || kind === "projected_outcome") return "recorded";
  return "planned_future";
}

export function composeOverviewOutcomeMilestone(
  row: OutcomeMeasurementComposeRow
): OverviewOutcomeMilestone {
  const kind = resolveOutcomeEvidenceKind(row);
  const metrics = row.metric_values ?? {};
  const key = String(row.checkpoint_key || "checkpoint");
  return {
    checkpointKey: key,
    label: MILESTONE_LABELS[key] ?? key.replace(/_/g, " "),
    measurementDate: row.measurement_date,
    evidenceKind: kind,
    evidenceBadge: evidenceKindBadge(kind),
    densityPercentOfTarget: numOrNull(metrics.density_percent_of_target),
    satisfactionOutOf10: numOrNull(metrics.patient_satisfaction_10),
    availability: availabilityForEvidence(kind),
  };
}

export function composeOverviewOutcomes(input: {
  measurements: ReadonlyArray<OutcomeMeasurementComposeRow>;
  projected?: ProjectedOutcomeInput | null;
}): OverviewOutcomesSection {
  const milestones = input.measurements.map(composeOverviewOutcomeMilestone);
  const projected = input.projected;
  const hasProjected =
    projected &&
    (Boolean(projected.status) ||
      projected.graftTarget != null ||
      Boolean(projected.generatedAt));

  const projectedAvailability: OverviewAvailability = hasProjected
    ? "recorded"
    : "not_recorded";

  const any = milestones.length > 0 || hasProjected;
  return {
    availability: any ? "recorded" : "not_recorded",
    projectedOutcome: {
      availability: projectedAvailability,
      status: projected?.status ?? null,
      graftTarget: projected?.graftTarget ?? null,
      label: hasProjected
        ? "Projected surgical outcome (plan window)"
        : "Projected outcome not recorded",
    },
    milestones,
  };
}

/** True when a milestone must not be narrated as a completed follow-up. */
export function isDemonstrationOrFutureMilestone(
  milestone: Pick<OverviewOutcomeMilestone, "evidenceKind">
): boolean {
  return (
    milestone.evidenceKind === "projected_fixture" ||
    milestone.evidenceKind === "future_dated_fixture"
  );
}
