/**
 * FI-DEMO-DAY-2A.4 — Pure surgical plan + procedure story composition.
 */

import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";
import type {
  OverviewAvailability,
  OverviewProcedureSection,
  OverviewSurgicalPlanSection,
} from "./patientTwinOverviewTypes";
import { formatGraftCount } from "./patientTwinOverviewCopy";

export type SurgicalStoryPlanInput = {
  caseId: string | null;
  planningStatus: string | null;
  plannedProcedureType: string | null;
  surgicalPlanSummary: string | null;
  planningNotes: string | null;
  plannedZones: PlannedZoneRow[] | null;
  estimatedGraftsMin: number | null;
  estimatedGraftsMax: number | null;
  hairlineStatus: string | null;
  surgeryPlanningHref: string | null;
  treatmentContext?: string | null;
};

export type SurgicalStoryProcedureInput = {
  surgeryDate: string | null;
  surgeryStatus: string | null;
  technique: string | null;
  plannedGrafts: number | null;
  implantedGrafts: number | null;
  extractedGrafts: number | null;
  discardedGrafts: number | null;
  transectionRatePercent: number | null;
  teamRoleCount: number;
  surgeryDayHref: string | null;
};

function zoneSummaries(zones: PlannedZoneRow[] | null | undefined) {
  if (!zones?.length) return [];
  return zones.map((z) => ({
    key: String(z.key ?? z.label ?? "zone"),
    label: String(z.label ?? z.key ?? "Zone"),
    grafts: typeof z.grafts === "number" ? z.grafts : null,
    targetDensityPerCm2:
      typeof z.targetDensityPerCm2 === "number" ? z.targetDensityPerCm2 : null,
  }));
}

function sumZoneGrafts(zones: PlannedZoneRow[] | null | undefined): number | null {
  if (!zones?.length) return null;
  let sum = 0;
  let any = false;
  for (const z of zones) {
    if (typeof z.grafts === "number") {
      sum += z.grafts;
      any = true;
    }
  }
  return any ? sum : null;
}

export function composeOverviewSurgicalPlan(
  input: SurgicalStoryPlanInput
): OverviewSurgicalPlanSection {
  const zones = zoneSummaries(input.plannedZones);
  const fromZones = sumZoneGrafts(input.plannedZones);
  const plannedGrafts =
    fromZones ??
    (typeof input.estimatedGraftsMax === "number"
      ? input.estimatedGraftsMax
      : typeof input.estimatedGraftsMin === "number"
        ? input.estimatedGraftsMin
        : null);

  const hasPlan =
    Boolean(input.caseId) ||
    zones.length > 0 ||
    plannedGrafts != null ||
    Boolean(input.surgicalPlanSummary) ||
    Boolean(input.hairlineStatus);

  if (!hasPlan) {
    return {
      availability: "not_recorded",
      recommendationSummary: null,
      treatmentContext: input.treatmentContext ?? null,
      hairlineStatus: "not_recorded",
      hairlineLabel: null,
      plannedZones: [],
      plannedGrafts: null,
      caseId: input.caseId,
      surgeryPlanningHref: input.surgeryPlanningHref,
    };
  }

  const hl = (input.hairlineStatus ?? "").toLowerCase();
  let hairlineStatus: OverviewAvailability = "not_recorded";
  let hairlineLabel: string | null = null;
  if (hl === "approved") {
    hairlineStatus = "recorded";
    hairlineLabel = "Approved hairline";
  } else if (hl) {
    hairlineStatus = "recorded";
    hairlineLabel = `Hairline · ${input.hairlineStatus}`;
  }

  return {
    availability: "recorded",
    recommendationSummary: input.surgicalPlanSummary ?? input.planningNotes,
    treatmentContext:
      input.treatmentContext ??
      (input.plannedProcedureType
        ? `${input.plannedProcedureType.toUpperCase()} plan${
            input.planningStatus ? ` · ${input.planningStatus}` : ""
          }`
        : null),
    hairlineStatus,
    hairlineLabel,
    plannedZones: zones,
    plannedGrafts,
    caseId: input.caseId,
    surgeryPlanningHref: input.surgeryPlanningHref,
  };
}

export function composeOverviewProcedure(
  input: SurgicalStoryProcedureInput
): OverviewProcedureSection {
  const hasProcedure =
    Boolean(input.surgeryDate) ||
    input.implantedGrafts != null ||
    Boolean(input.surgeryStatus);

  if (!hasProcedure) {
    return {
      availability: "not_recorded",
      surgeryDate: null,
      surgeryStatus: null,
      technique: null,
      actualImplantedGrafts: null,
      actualExtractedGrafts: null,
      plannedGrafts: input.plannedGrafts,
      graftReconciliationLabel: null,
      graftsReconciledToPlan: null,
      transectionRatePercent: null,
      teamRoleCount: 0,
      surgeryDayHref: input.surgeryDayHref,
    };
  }

  let graftsReconciledToPlan: boolean | null = null;
  let graftReconciliationLabel: string | null = null;
  if (input.plannedGrafts != null && input.implantedGrafts != null) {
    graftsReconciledToPlan = input.implantedGrafts === input.plannedGrafts;
    graftReconciliationLabel = graftsReconciledToPlan
      ? `Implanted ${formatGraftCount(input.implantedGrafts)} grafts match the approved plan.`
      : `Implanted ${formatGraftCount(input.implantedGrafts)} vs planned ${formatGraftCount(input.plannedGrafts)}.`;
  }

  return {
    availability: "recorded",
    surgeryDate: input.surgeryDate,
    surgeryStatus: input.surgeryStatus,
    technique: input.technique,
    actualImplantedGrafts: input.implantedGrafts,
    actualExtractedGrafts: input.extractedGrafts,
    plannedGrafts: input.plannedGrafts,
    graftReconciliationLabel,
    graftsReconciledToPlan,
    transectionRatePercent: input.transectionRatePercent,
    teamRoleCount: input.teamRoleCount,
    surgeryDayHref: input.surgeryDayHref,
  };
}
