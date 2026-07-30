/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 / 1A.6 — metric card definitions (pure).
 */

import type { PilotControlOverview } from "../api/pilotControlApiTypes";
import { formatAgeSeconds, formatCountOrDash, formatRateOrDash } from "./pilotControlFormatters";

export type PilotMetricCardDef = {
  key: string;
  label: string;
  value: string;
  tooltip: string;
  approximate?: boolean;
  sensitive?: boolean;
};

export function buildOverviewMetricCards(overview: PilotControlOverview | null): PilotMetricCardDef[] {
  if (!overview) return [];
  const b = overview.blockers;
  const overall = overview.readiness.overall;
  const oldest =
    typeof b.oldestOpenAgeSeconds === "number"
      ? formatAgeSeconds(b.oldestOpenAgeSeconds)
      : "—";

  return [
    {
      key: "approved",
      label: "Approved cohort",
      value: formatCountOrDash(overview.cohort.totalApproved),
      tooltip: "Explicit pilot enrolments in approved/active lifecycle states (API overview).",
    },
    {
      key: "invited",
      label: "Invited",
      value: formatCountOrDash(overview.cohort.invited),
      tooltip: "Enrolments with invited status from programme membership SoR.",
    },
    {
      key: "activated",
      label: "Activated",
      value: formatCountOrDash(overview.cohort.activated),
      tooltip: "Enrolments marked activated in the pilot membership register.",
    },
    {
      key: "active",
      label: "Active patients",
      value: formatCountOrDash(overview.cohort.active),
      tooltip: "Active enrolments in the controlled pilot cohort.",
    },
    {
      key: "blockedPatients",
      label: "Patients blocked",
      value: formatCountOrDash(overall.blocked),
      tooltip: "Patients with overall readiness blocked from canonical batch evaluation.",
    },
    {
      key: "attentionPatients",
      label: "Patients requiring attention",
      value: formatCountOrDash(overall.attentionRequired),
      tooltip: "Patients with overall readiness attention_required from canonical batch evaluation.",
    },
    {
      key: "criticalBlockers",
      label: "Critical blockers",
      value: formatCountOrDash(b.openBySeverity.critical),
      tooltip: "Open critical blockers from the persisted pilot blocker register.",
    },
    {
      key: "highBlockers",
      label: "High blockers",
      value: formatCountOrDash(b.openBySeverity.high),
      tooltip: "Open high-severity blockers from the persisted pilot blocker register.",
    },
    {
      key: "patientOwned",
      label: "Patient-owned actions",
      value: formatCountOrDash(overview.actions.patientOwnedOpen),
      tooltip: "Open patient-owned actions counted by the overview assembler.",
    },
    {
      key: "clinicOwned",
      label: "Clinic-owned actions",
      value: formatCountOrDash(overview.actions.clinicOwnedOpen),
      tooltip: "Open clinic-owned actions counted by the overview assembler.",
    },
    {
      key: "oldestBlocker",
      label: "Oldest unresolved blocker",
      value: oldest,
      tooltip: "Age of the oldest open blocker in the register.",
    },
    {
      key: "activationRate",
      label: "App activation rate",
      value: formatRateOrDash(overview.app.activationRate),
      tooltip: "Activated ÷ invited. Zero denominators return — (not 0%).",
    },
    {
      key: "completed",
      label: "Completed journeys",
      value: formatCountOrDash(overview.cohort.completed),
      tooltip: "Enrolments with completed pilot status.",
    },
  ];
}

/** Metric cards must never include sensitive financial amounts or clinical free text. */
export function metricCardsContainSensitiveValues(cards: PilotMetricCardDef[]): boolean {
  return cards.some((c) => c.sensitive === true);
}
