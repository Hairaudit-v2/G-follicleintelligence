/**
 * FI-DEMO-DAY-2A.4 — Compose Patient Intelligence Overview from twin + SoR slices.
 * Pure — safe for unit tests without Supabase.
 */

import {
  SHOWCASE_JAMES_CHEN_AGE_YEARS,
  SHOWCASE_JAMES_CHEN_STAGING_LABEL,
} from "@/src/lib/demo-day/showcaseJamesChenConstants";
import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";
import type { PatientTwinV1 } from "./patientTwinTypes";
import { detectShowcasePatient } from "./patientTwinShowcaseDetection";
import { buildOverviewDeepLinks } from "./patientTwinOverviewDeepLinks";
import { composeOverviewEconomics } from "./patientTwinEconomicsCore";
import { composeOverviewWorkforce, type WorkforceAssignmentRow } from "./patientTwinWorkforceCore";
import {
  composeOverviewProcedure,
  composeOverviewSurgicalPlan,
} from "./patientTwinSurgicalStoryCore";
import {
  composeOverviewOutcomes,
  type OutcomeMeasurementComposeRow,
  type ProjectedOutcomeInput,
} from "./patientTwinOutcomesCore";
import type {
  OverviewAllowedSourceSystem,
  OverviewBaselineSection,
  OverviewGovernanceSection,
  PatientIntelligenceOverviewModel,
} from "./patientTwinOverviewTypes";
import { OVERVIEW_ALLOWED_SOURCE_SYSTEMS } from "./patientTwinOverviewTypes";

export type OverviewComposeExtras = {
  patientMetadata?: Record<string, unknown> | null;
  personMetadata?: Record<string, unknown> | null;
  invoices?: Parameters<typeof composeOverviewEconomics>[0]["invoices"];
  workforceMembers?: ReadonlyArray<WorkforceAssignmentRow>;
  plannedZones?: PlannedZoneRow[] | null;
  surgeryPlan?: {
    planningStatus: string | null;
    plannedProcedureType: string | null;
    surgicalPlanSummary: string | null;
    planningNotes: string | null;
    estimatedGraftsMin: number | null;
    estimatedGraftsMax: number | null;
    hairlineStatus: string | null;
  } | null;
  surgery?: {
    surgeryDate: string | null;
    surgeryStatus: string | null;
    technique: string | null;
    implantedGrafts: number | null;
    extractedGrafts: number | null;
    discardedGrafts: number | null;
    transectionRatePercent: number | null;
  } | null;
  outcomeMeasurements?: ReadonlyArray<OutcomeMeasurementComposeRow>;
  projectedOutcome?: ProjectedOutcomeInput | null;
  presentationMode?: boolean;
};

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob?.trim()) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const v = meta[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function packageContextLabel(
  demoPackage: "A" | "B" | null,
  clinicName: string | null
): string | null {
  if (!demoPackage) return clinicName;
  if (demoPackage === "A") {
    return clinicName
      ? `Enterprise demo · ${clinicName}`
      : "Enterprise demo package";
  }
  return clinicName ? `Clinic demo · ${clinicName}` : "Clinic demo package";
}

function composeBaseline(
  twin: PatientTwinV1,
  meta: Record<string, unknown>
): OverviewBaselineSection {
  const checklist = twin.intelligence.consultation_checklist.latest;
  const recipient = twin.intelligence.recipient_candidacy.latest;
  const donor = twin.intelligence.donor.latest;
  const hairLoss = twin.intelligence.hair_loss.latest;
  const photoCount = twin.imaging.active_image_total;

  const riskSignals: string[] = [];
  if (checklist?.risk_flags?.length) riskSignals.push(...checklist.risk_flags);
  if (recipient?.shock_loss_risk) riskSignals.push(`Shock-loss risk: ${recipient.shock_loss_risk}`);
  if (donor?.overharvesting_risk)
    riskSignals.push(`Overharvesting risk: ${donor.overharvesting_risk}`);

  const historySignals: string[] = [];
  if (twin.clinical.structured_profile?.primary_concern) {
    historySignals.push(twin.clinical.structured_profile.primary_concern);
  }
  if (twin.clinical.structured_profile?.treatment_interest) {
    historySignals.push(`Interest: ${twin.clinical.structured_profile.treatment_interest}`);
  }
  if (hairLoss) {
    historySignals.push(
      `${hairLoss.classification_system} ${hairLoss.pattern_type} · ${hairLoss.classification_grade}`
    );
  }

  const hliPresent = Boolean(hairLoss || donor || recipient || twin.photo_protocol);
  const trichoscopyNote = hliPresent
    ? "HLI classification / candidacy signals present on this record."
    : null;

  const norwood =
    twin.clinical.structured_profile?.norwood_scale ??
    metaString(meta, "showcase_norwood_baseline") ??
    metaString(meta, "showcase_staging_label");

  const hasAnything =
    Boolean(checklist) ||
    historySignals.length > 0 ||
    riskSignals.length > 0 ||
    photoCount > 0 ||
    Boolean(norwood);

  return {
    availability: hasAnything ? "recorded" : "not_recorded",
    consultationSummary: checklist?.consultation_summary ?? null,
    clinicalHistorySignals: historySignals,
    riskSignals,
    photographCount: photoCount,
    photographStatus: photoCount > 0 ? "recorded" : "not_recorded",
    hliTrichoscopyStatus: hliPresent ? "recorded" : "not_recorded",
    hliTrichoscopyNote: trichoscopyNote,
    norwoodLabel: norwood,
  };
}

function composeGovernance(
  twin: PatientTwinV1,
  auditHref: string | null
): OverviewGovernanceSection {
  const consentEvents = twin.timeline.items
    .filter((t) => /consent/i.test(t.event_kind) || /consent/i.test(t.title ?? ""))
    .slice(0, 6)
    .map((t) => ({
      label: t.title?.trim() || t.event_kind,
      occurredAt: t.occurred_at,
      kind: t.event_kind,
    }));

  const approvalEvents = twin.timeline.items
    .filter(
      (t) =>
        /approv/i.test(t.event_kind) ||
        /approv/i.test(t.title ?? "") ||
        /hairline/i.test(t.event_kind)
    )
    .slice(0, 6)
    .map((t) => ({
      label: t.title?.trim() || t.event_kind,
      occurredAt: t.occurred_at,
      kind: t.event_kind,
    }));

  const sourceSystemsPresent: OverviewAllowedSourceSystem[] = [];
  const allowed = new Set<string>(OVERVIEW_ALLOWED_SOURCE_SYSTEMS);
  for (const label of twin.person.source_labels) {
    const t = label.trim();
    if (allowed.has(t)) sourceSystemsPresent.push(t as OverviewAllowedSourceSystem);
  }
  // Capability-based contributions only — never claim every source participated.
  if (twin.intelligence.hair_loss.latest || twin.photo_protocol) {
    if (!sourceSystemsPresent.includes("HLI")) sourceSystemsPresent.push("HLI");
  }
  if (twin.audits.audits_total > 0 || twin.audits.latest_released_report) {
    if (!sourceSystemsPresent.includes("HairAudit")) sourceSystemsPresent.push("HairAudit");
  }
  if (twin.imaging.active_image_total > 0) {
    if (!sourceSystemsPresent.includes("ImagingOS")) sourceSystemsPresent.push("ImagingOS");
  }
  if (!sourceSystemsPresent.includes("FiOS")) sourceSystemsPresent.push("FiOS");

  const hasAudit = twin.audits.audits_total > 0 || Boolean(twin.audits.latest_released_report);
  const hasAnything = consentEvents.length > 0 || approvalEvents.length > 0 || hasAudit;

  return {
    availability: hasAnything ? "recorded" : "not_recorded",
    consentEvents,
    approvalEvents,
    auditSummary: hasAudit
      ? `${twin.audits.audits_total} audits · ${twin.audits.reports_total} reports`
      : null,
    sourceSystemsPresent,
    auditHref,
  };
}

/**
 * Compose a full overview model. Works for showcase and ordinary patients;
 * showcase markers only enrich badges / package context.
 */
export function composePatientIntelligenceOverview(
  twin: PatientTwinV1,
  extras: OverviewComposeExtras = {}
): PatientIntelligenceOverviewModel {
  const patientMeta =
    extras.patientMetadata && typeof extras.patientMetadata === "object"
      ? extras.patientMetadata
      : {};
  const personMeta =
    extras.personMetadata && typeof extras.personMetadata === "object"
      ? extras.personMetadata
      : {};

  const showcase = detectShowcasePatient({
    patientMetadata: patientMeta,
    personMetadata: personMeta,
  });

  const primaryCase = twin.cases[0] ?? null;
  const caseId = primaryCase?.case_id ?? null;
  const deepLinks = buildOverviewDeepLinks({
    tenantId: twin.tenant_id,
    patientId: twin.patient_id,
    caseId,
    latestAuditReportId: twin.audits.latest_released_report?.report_id ?? null,
  });

  const ageFromMeta = metaNumber(
    { ...personMeta, ...patientMeta },
    "showcase_age_years"
  );
  const ageYears =
    ageFromMeta ??
    ageFromDob(twin.person.date_of_birth) ??
    (showcase.isJamesChenShowcase ? SHOWCASE_JAMES_CHEN_AGE_YEARS : null);

  const stagingLabel =
    metaString({ ...personMeta, ...patientMeta }, "showcase_staging_label") ??
    twin.clinical.structured_profile?.norwood_scale ??
    (showcase.isJamesChenShowcase ? SHOWCASE_JAMES_CHEN_STAGING_LABEL : null);

  const clinicDisplayName = twin.crm.primary_clinic_display_name;
  const plannedGraftsFromPlan =
    extras.surgeryPlan?.estimatedGraftsMax ??
    extras.surgeryPlan?.estimatedGraftsMin ??
    null;

  const surgicalPlan = composeOverviewSurgicalPlan({
    caseId,
    planningStatus: extras.surgeryPlan?.planningStatus ?? null,
    plannedProcedureType: extras.surgeryPlan?.plannedProcedureType ?? null,
    surgicalPlanSummary: extras.surgeryPlan?.surgicalPlanSummary ?? null,
    planningNotes: extras.surgeryPlan?.planningNotes ?? null,
    plannedZones: extras.plannedZones ?? null,
    estimatedGraftsMin: extras.surgeryPlan?.estimatedGraftsMin ?? null,
    estimatedGraftsMax: extras.surgeryPlan?.estimatedGraftsMax ?? null,
    hairlineStatus: extras.surgeryPlan?.hairlineStatus ?? null,
    surgeryPlanningHref: deepLinks.surgeryPlanningHref,
    treatmentContext: twin.clinical.structured_profile?.treatment_interest ?? null,
  });

  const procedure = composeOverviewProcedure({
    surgeryDate: extras.surgery?.surgeryDate ?? null,
    surgeryStatus: extras.surgery?.surgeryStatus ?? null,
    technique: extras.surgery?.technique ?? null,
    plannedGrafts: surgicalPlan.plannedGrafts ?? plannedGraftsFromPlan,
    implantedGrafts: extras.surgery?.implantedGrafts ?? null,
    extractedGrafts: extras.surgery?.extractedGrafts ?? null,
    discardedGrafts: extras.surgery?.discardedGrafts ?? null,
    transectionRatePercent: extras.surgery?.transectionRatePercent ?? null,
    teamRoleCount: extras.workforceMembers?.length ?? 0,
    surgeryDayHref: deepLinks.surgeryDayHref,
  });

  const economics = composeOverviewEconomics({
    invoices: extras.invoices ?? [],
    paymentsHref: deepLinks.paymentsHref,
  });

  const workforce = composeOverviewWorkforce({
    members: extras.workforceMembers ?? [],
    procedureDate: extras.surgery?.surgeryDate ?? null,
  });

  const outcomes = composeOverviewOutcomes({
    measurements: extras.outcomeMeasurements ?? [],
    projected: extras.projectedOutcome ?? null,
  });

  const lifecycleStage =
    twin.person.lifecycle_stage ??
    twin.person.stage_of_journey ??
    primaryCase?.status ??
    null;

  const clinicalStatusLabel =
    twin.completeness.band === "excellent"
      ? "Clinical record completeness excellent"
      : twin.completeness.band === "good"
        ? "Clinical record completeness good"
        : twin.completeness.band === "partial"
          ? "Clinical record partial"
          : "Clinical record incomplete";

  const fixtureReadinessLabel = showcase.isShowcase
    ? showcase.isJamesChenShowcase
      ? "Showcase fixture ready for presentation"
      : "Demo showcase marker present"
    : null;

  return {
    tenantId: twin.tenant_id,
    patientId: twin.patient_id,
    presentationMode: Boolean(extras.presentationMode),
    summary: {
      displayName: twin.person.display_name?.trim() || "Patient",
      ageYears,
      stagingLabel,
      lifecycleStage,
      clinicalStatusLabel,
      fixtureReadinessLabel,
      clinicDisplayName,
      packageContextLabel: packageContextLabel(showcase.demoPackage, clinicDisplayName),
      showcase,
      completenessScore: twin.completeness.score,
      completenessBand: twin.completeness.band,
    },
    baseline: composeBaseline(twin, { ...personMeta, ...patientMeta }),
    surgicalPlan,
    procedure,
    outcomes,
    workforce,
    economics,
    governance: composeGovernance(twin, deepLinks.auditHref),
    deepLinks,
    demoPackage: showcase.demoPackage,
  };
}
