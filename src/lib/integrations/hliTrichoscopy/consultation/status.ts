/**
 * FI-TRICHOSCOPY-1B — pure consultation status and readiness resolution.
 */

import type { FiosTrichoscopyStatus } from "../types";
import type {
  TrichoscopyConsultationReadinessState,
  TrichoscopyConsultationStatus,
  TrichoscopyFailureKind,
  TrichoscopyIndicationCode,
} from "./types";

const SCARRING_CODES: ReadonlySet<string> = new Set([
  "suspected_scarring_alopecia",
]);

export function isTrichoscopyIndicationCode(value: string): value is TrichoscopyIndicationCode {
  return (
    value === "suspected_androgenetic_alopecia" ||
    value === "diffuse_shedding" ||
    value === "suspected_telogen_effluvium" ||
    value === "suspected_alopecia_areata" ||
    value === "suspected_scarring_alopecia" ||
    value === "inflammatory_scalp_condition" ||
    value === "unexplained_density_reduction" ||
    value === "donor_area_assessment" ||
    value === "treatment_response_baseline" ||
    value === "treatment_response_follow_up" ||
    value === "diagnostic_uncertainty" ||
    value === "clinician_concern" ||
    value === "patient_requested_assessment" ||
    value === "other"
  );
}

export function resolveConsultationTrichoscopyStatus(input: {
  markedNotRequired?: boolean;
  deferred?: boolean;
  waitForTreatmentPlanning?: boolean;
  hasIndication?: boolean;
  linkStatus?: FiosTrichoscopyStatus | null;
  hasActiveEvidencePack?: boolean;
  evidenceInsufficient?: boolean;
  evidenceSuperseded?: boolean;
  withdrawn?: boolean;
  integrationFailed?: boolean;
  findingsReviewed?: boolean;
}): TrichoscopyConsultationStatus {
  if (input.withdrawn) return "withdrawn";
  if (input.integrationFailed) return "failed";
  if (input.markedNotRequired) return "not_required";
  if (input.deferred) return "deferred";
  if (input.evidenceSuperseded) return "superseded";
  if (input.evidenceInsufficient) return "insufficient";

  const link = input.linkStatus ?? null;
  if (link === "cancelled") return "withdrawn";
  if (link === "integration_error") return "failed";

  if (
    link === "confirmed" ||
    link === "confirmed_with_limitations" ||
    link === "completed" ||
    link === "review_pending" ||
    link === "medical_review_required"
  ) {
    if (input.findingsReviewed) return "reviewed";
    return "ready_for_review";
  }

  if (
    link === "capture_due" ||
    link === "capture_in_progress" ||
    link === "capture_complete" ||
    link === "analysis_pending" ||
    link === "linked" ||
    link === "repeat_capture_required"
  ) {
    return "in_progress";
  }

  if (link === "requested") return "requested";

  if (input.hasActiveEvidencePack && !link) {
    return input.findingsReviewed ? "reviewed" : "already_available";
  }

  if (input.waitForTreatmentPlanning) return "required_before_treatment";
  if (input.hasIndication) return "recommended";
  return "not_required";
}

export type ConsultationTrichoscopyRulesSnapshot = {
  enabled?: boolean;
  requireBeforeTreatmentCodes?: string[];
  blockOnScarringEscalation?: boolean;
  blockOnUrgentMedicalUnresolved?: boolean;
  blockBeforeSurgicalSuitability?: boolean;
  allowCompleteWhenPending?: boolean;
  allowCompleteWhenHliUnavailable?: boolean;
};

export function resolveConsultationTrichoscopyReadiness(input: {
  consultationStatus: TrichoscopyConsultationStatus;
  rules?: ConsultationTrichoscopyRulesSnapshot | null;
  indicationCodes?: string[];
  escalationUnresolved?: boolean;
  scarringConcern?: boolean;
  surgicalSuitabilityGate?: boolean;
  decisionsDocumented?: boolean;
  failureKind?: TrichoscopyFailureKind | null;
}): {
  state: TrichoscopyConsultationReadinessState;
  blocking: boolean;
  blockingReasonCodes: string[];
} {
  const rules = input.rules ?? {};
  const allowPending = rules.allowCompleteWhenPending !== false;
  const allowUnavailable = rules.allowCompleteWhenHliUnavailable !== false;
  const blockingReasonCodes: string[] = [];

  const status = input.consultationStatus;

  if (status === "not_required") {
    return { state: "no_trichoscopy_requirement", blocking: false, blockingReasonCodes: [] };
  }

  if (status === "deferred") {
    return { state: "requirement_unresolved", blocking: false, blockingReasonCodes: [] };
  }

  if (
    status === "required_before_treatment" ||
    (status === "recommended" &&
      (input.indicationCodes ?? []).some((c) =>
        (rules.requireBeforeTreatmentCodes ?? []).includes(c)
      ))
  ) {
    blockingReasonCodes.push("trichoscopy_required_before_treatment");
  }

  if (input.escalationUnresolved && rules.blockOnUrgentMedicalUnresolved !== false) {
    blockingReasonCodes.push("urgent_medical_concern_unresolved");
  }

  if (
    (input.scarringConcern ||
      (input.indicationCodes ?? []).some((c) => SCARRING_CODES.has(c))) &&
    rules.blockOnScarringEscalation !== false &&
    status !== "reviewed"
  ) {
    blockingReasonCodes.push("possible_scarring_alopecia_review");
  }

  if (input.surgicalSuitabilityGate && rules.blockBeforeSurgicalSuitability) {
    blockingReasonCodes.push("evidence_required_before_surgical_suitability");
  }

  if (status === "failed" || input.failureKind === "hli_unavailable") {
    if (!allowUnavailable && blockingReasonCodes.length) {
      return {
        state: "request_pending",
        blocking: true,
        blockingReasonCodes,
      };
    }
    return {
      state: input.decisionsDocumented ? "decision_documented" : "ready_to_complete",
      blocking: false,
      blockingReasonCodes: [],
      // Technical outage is never a clinical finding.
    };
  }

  if (status === "requested") {
    return {
      state: "request_pending",
      blocking: !allowPending && blockingReasonCodes.length > 0,
      blockingReasonCodes: !allowPending ? blockingReasonCodes : [],
    };
  }

  if (status === "in_progress" || status === "insufficient") {
    return {
      state: "evidence_incomplete",
      blocking: !allowPending && blockingReasonCodes.length > 0,
      blockingReasonCodes: !allowPending ? blockingReasonCodes : [],
    };
  }

  if (status === "ready_for_review" || status === "already_available" || status === "superseded") {
    return {
      state: input.escalationUnresolved ? "escalation_unresolved" : "review_required",
      blocking: blockingReasonCodes.length > 0,
      blockingReasonCodes,
    };
  }

  if (status === "reviewed") {
    if (input.escalationUnresolved) {
      return {
        state: "escalation_unresolved",
        blocking: blockingReasonCodes.length > 0,
        blockingReasonCodes,
      };
    }
    if (input.decisionsDocumented) {
      return { state: "decision_documented", blocking: false, blockingReasonCodes: [] };
    }
    return { state: "ready_to_complete", blocking: false, blockingReasonCodes: [] };
  }

  if (status === "recommended" || status === "required_before_treatment") {
    return {
      state: "requirement_unresolved",
      blocking: blockingReasonCodes.length > 0,
      blockingReasonCodes,
    };
  }

  return {
    state: "ready_to_complete",
    blocking: false,
    blockingReasonCodes: [],
  };
}

export const HLI_OUTAGE_USER_MESSAGE =
  "Trichoscopy information is temporarily unavailable. You may continue documenting the consultation and return to this section later.";
