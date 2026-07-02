import type { CaseComparisonSignalInput, CarePlanSignalInput } from "./workflowSnapshot";
import type { ClinicalInsights } from "../insights/clinicalInsights";
import {
  LONGEVITY_SIGNAL_CONTRACT_VERSION,
  LONGEVITY_SIGNAL_KEY,
  LONGEVITY_INTEGRATION_SOURCE_SYSTEM,
  buildLongevityEntityRefs,
  type LongevityEntityRefs,
  type LongevityEventType,
  type LongevitySignalKey,
} from "./integrationContracts";
import { REVIEW_OUTCOME } from "../constants/reviewOutcomes";
import type { TriageFlags } from "../types/triage";

export type NormalizedLongevitySignalStatus =
  | "active"
  | "pending"
  | "recommended"
  | "improving";

export type NormalizedLongevitySignalSeverity =
  | "info"
  | "attention"
  | "action";

export type NormalizedLongevitySignal = {
  signal_key: LongevitySignalKey;
  source_system: typeof LONGEVITY_INTEGRATION_SOURCE_SYSTEM;
  source_version: typeof LONGEVITY_SIGNAL_CONTRACT_VERSION;
  generated_at: string;
  source_event_type?: LongevityEventType;
  status: NormalizedLongevitySignalStatus;
  severity: NormalizedLongevitySignalSeverity;
  entity_refs: LongevityEntityRefs;
  payload: Record<string, unknown>;
};

export type LongevitySignalBuilderInput = {
  profileId?: string | null;
  intakeId: string;
  derivedFlags?: Partial<TriageFlags> | null;
  clinicalInsights?: ClinicalInsights | null;
  carePlan?: CarePlanSignalInput | null;
  caseComparison?: CaseComparisonSignalInput | null;
  bloodRequest?: {
    id?: string | null;
    status?: string | null;
    recommended_by?: string | null;
  } | null;
  reviewOutcome?: string | null;
  hasBloodResultUploadDocument?: boolean;
  hasStructuredMarkers?: boolean;
  generatedAt?: string;
  sourceEventType?: LongevityEventType;
  /** Phase U: treatment adherence items (FI-ready; state or status) */
  treatmentContinuity?: { key: string; label: string; state?: string; status?: string }[] | null;
  /** Phase U: outcome correlation result (FI-ready) */
  outcomeCorrelation?: {
    correlation_state: string;
    clinicianSummary?: string[];
    caveats?: string[];
    summary_lines?: string[];
    patient_safe_summary: string | null;
    outcome_domains_used: string[];
  } | null;
};

function hasDriver(
  insights: ClinicalInsights | null | undefined,
  expected: string
): boolean {
  return (insights?.activeDrivers ?? []).includes(expected);
}

function includesInsensitive(values: string[], fragment: string): boolean {
  const lower = fragment.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(lower));
}

function pushSignal(
  target: NormalizedLongevitySignal[],
  params: {
    signal_key: LongevitySignalKey;
    status: NormalizedLongevitySignalStatus;
    severity: NormalizedLongevitySignalSeverity;
    entity_refs: LongevityEntityRefs;
    generated_at: string;
    source_event_type?: LongevityEventType;
    payload: Record<string, unknown>;
  }
) {
  target.push({
    signal_key: params.signal_key,
    source_system: LONGEVITY_INTEGRATION_SOURCE_SYSTEM,
    source_version: LONGEVITY_SIGNAL_CONTRACT_VERSION,
    generated_at: params.generated_at,
    source_event_type: params.source_event_type,
    status: params.status,
    severity: params.severity,
    entity_refs: params.entity_refs,
    payload: params.payload,
  });
}

export function buildLongevitySignals(
  input: LongevitySignalBuilderInput
): NormalizedLongevitySignal[] {
  const generated_at = input.generatedAt ?? new Date().toISOString();
  const entity_refs = buildLongevityEntityRefs("intake", input.intakeId);
  const signals: NormalizedLongevitySignal[] = [];
  const flags = input.derivedFlags ?? {};
  const insights = input.clinicalInsights ?? null;
  const carePlan = input.carePlan ?? null;
  const comparison = input.caseComparison ?? null;
  const bloodRequest = input.bloodRequest ?? null;
  const hasBloodResultUploadDocument =
    input.hasBloodResultUploadDocument ?? false;
  const hasStructuredMarkers = input.hasStructuredMarkers ?? false;

  const ironRiskActive =
    !!flags.possibleIronRisk ||
    hasDriver(insights, "Iron / oxygen delivery");
  if (ironRiskActive) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.IRON_RISK_ACTIVE,
      status: "active",
      severity: "attention",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        evidence: [
          ...(flags.possibleIronRisk ? ["questionnaire_possible_iron_risk"] : []),
          ...(hasDriver(insights, "Iron / oxygen delivery")
            ? ["clinical_driver_iron_oxygen_delivery"]
            : []),
        ],
      },
    });
  }

  const thyroidDriverActive =
    !!flags.possibleThyroidRisk || hasDriver(insights, "Thyroid");
  if (thyroidDriverActive) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.THYROID_DRIVER_ACTIVE,
      status: "active",
      severity: "attention",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        evidence: [
          ...(flags.possibleThyroidRisk
            ? ["questionnaire_possible_thyroid_risk"]
            : []),
          ...(hasDriver(insights, "Thyroid") ? ["clinical_driver_thyroid"] : []),
        ],
      },
    });
  }

  const inflammatoryPersistent =
    (comparison?.persistentDrivers ?? []).some((driver) =>
      driver === "Inflammation / metabolic stress"
    ) ||
    includesInsensitive(insights?.followUpConsiderations ?? [], "inflammatory") ||
    includesInsensitive(insights?.followUpConsiderations ?? [], "metabolic");
  if (inflammatoryPersistent) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.INFLAMMATORY_BURDEN_PERSISTENT,
      status: "active",
      severity: "attention",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        persistent_drivers: (comparison?.persistentDrivers ?? []).filter((driver) =>
          driver === "Inflammation / metabolic stress"
        ),
        follow_up_considerations: (insights?.followUpConsiderations ?? []).filter(
          (item) =>
            item.toLowerCase().includes("inflammatory") ||
            item.toLowerCase().includes("metabolic")
        ),
      },
    });
  }

  if ((insights?.improvedAreas ?? []).length > 0) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.MARKER_IMPROVING,
      status: "improving",
      severity: "info",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        improved_areas: insights?.improvedAreas ?? [],
      },
    });
  }

  const followUpRecommended =
    !!carePlan?.followUpTimingSuggestion ||
    input.reviewOutcome === REVIEW_OUTCOME.FOLLOW_UP_SCHEDULED;
  if (followUpRecommended) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.FOLLOW_UP_RECOMMENDED,
      status: "recommended",
      severity: "action",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        review_outcome: input.reviewOutcome ?? null,
        follow_up_timing_suggestion: carePlan?.followUpTimingSuggestion ?? null,
      },
    });
  }

  const bloodResultsPending =
    !!bloodRequest?.status &&
    ["pending", "letter_requested", "letter_generated"].includes(
      bloodRequest.status
    ) &&
    !hasBloodResultUploadDocument &&
    !hasStructuredMarkers;
  if (bloodResultsPending) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.BLOOD_RESULTS_PENDING,
      status: "pending",
      severity: "attention",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        blood_request_id: bloodRequest?.id ?? null,
        blood_request_status: bloodRequest?.status ?? null,
      },
    });
  }

  const gpFollowUpSuggested =
    !!carePlan?.gpFollowUpSuggested ||
    input.reviewOutcome === REVIEW_OUTCOME.BLOODS_RECOMMENDED ||
    input.reviewOutcome === REVIEW_OUTCOME.REFERRAL_RECOMMENDED;
  if (gpFollowUpSuggested) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.GP_FOLLOW_UP_SUGGESTED,
      status: "recommended",
      severity: "action",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        review_outcome: input.reviewOutcome ?? null,
        gp_follow_up_suggested: carePlan?.gpFollowUpSuggested ?? false,
      },
    });
  }

  const visualComparison = comparison?.scalpImageComparison ?? null;
  const progressionSignals = visualComparison?.progressionSignals ?? [];
  const visualPersistentDrivers = visualComparison?.visualPersistentDrivers ?? [];
  if (
    visualComparison &&
    visualComparison.canCompareConfirmed &&
    progressionSignals.some((signal) =>
      [
        "visual_improvement_likely",
        "visual_progression_likely",
        "mixed_visual_change",
        "thinning_distribution_expanded",
        "thinning_distribution_reduced",
      ].includes(signal)
    )
  ) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.VISUAL_CHANGE_DETECTED,
      status:
        visualComparison.comparisonStatus === "improved" ? "improving" : "active",
      severity:
        visualComparison.comparisonStatus === "worsened" ? "attention" : "info",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        comparison_status: visualComparison.comparisonStatus,
        comparison_confidence: visualComparison.visualComparisonConfidence,
        progression_signals: progressionSignals,
        visual_progress_summary: visualComparison.visualProgressSummary ?? [],
      },
    });
  }

  if (visualComparison && visualPersistentDrivers.length > 0) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.VISUAL_CONCERN_PERSISTENT,
      status: "active",
      severity: "attention",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        comparison_status: visualComparison.comparisonStatus,
        persistent_visible_drivers: visualPersistentDrivers,
      },
    });
  }

  if (visualComparison?.comparisonLimitedByImageQuality) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.VISUAL_COMPARISON_LIMITED,
      status: "pending",
      severity: "attention",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        comparison_status: visualComparison.comparisonStatus,
        comparison_confidence: visualComparison.visualComparisonConfidence,
        follow_up_considerations: visualComparison.visualFollowUpConsiderations,
      },
    });
  }

  // Phase U: treatment adherence summary (FI-ready)
  const treatmentContinuity = input.treatmentContinuity ?? null;
  if (treatmentContinuity && treatmentContinuity.length > 0) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.TREATMENT_ADHERENCE_SUMMARY,
      status: "active",
      severity: "info",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        items: treatmentContinuity.map((i) => ({
          key: i.key,
          label: i.label,
          state: i.state ?? i.status,
        })),
      },
    });
  }

  // Phase U: outcome correlation (FI-ready)
  const outcomeCorrelation = input.outcomeCorrelation ?? null;
  if (outcomeCorrelation) {
    pushSignal(signals, {
      signal_key: LONGEVITY_SIGNAL_KEY.OUTCOME_CORRELATION,
      status:
        outcomeCorrelation.correlation_state ===
        "improvement_with_treatment_continuity"
          ? "improving"
          : outcomeCorrelation.correlation_state === "possible_partial_response"
            ? "active"
            : "active",
      severity:
        outcomeCorrelation.correlation_state === "worsening_after_stopping"
          ? "attention"
          : "info",
      entity_refs,
      generated_at,
      source_event_type: input.sourceEventType,
      payload: {
        profile_id: input.profileId ?? null,
        intake_id: input.intakeId,
        correlation_state: outcomeCorrelation.correlation_state,
        outcome_domains_used: outcomeCorrelation.outcome_domains_used,
        clinician_summary: outcomeCorrelation.clinicianSummary ?? outcomeCorrelation.summary_lines ?? [],
        caveats: outcomeCorrelation.caveats ?? [],
      },
    });
  }

  return signals;
}
