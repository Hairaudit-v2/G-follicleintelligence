/**
 * FI-TRICHOSCOPY-1B — acknowledgement transitions and diagnosis acceptance guards.
 */

import {
  TRICHOSCOPY_ACCEPTANCE_ACK_STATES,
  TRICHOSCOPY_DIAGNOSIS_DECISION_KINDS,
  type TrichoscopyAcknowledgementState,
  type TrichoscopyDecisionKind,
} from "./types";

const ALLOWED_TRANSITIONS: Record<
  TrichoscopyAcknowledgementState,
  readonly TrichoscopyAcknowledgementState[]
> = {
  not_reviewed: [
    "acknowledged",
    "accepted_into_assessment",
    "accepted_with_qualification",
    "not_clinically_significant",
    "disagreed",
    "requires_more_evidence",
    "escalated",
    "superseded",
  ],
  acknowledged: [
    "accepted_into_assessment",
    "accepted_with_qualification",
    "not_clinically_significant",
    "disagreed",
    "requires_more_evidence",
    "escalated",
    "superseded",
  ],
  accepted_into_assessment: ["accepted_with_qualification", "superseded", "disagreed"],
  accepted_with_qualification: ["accepted_into_assessment", "superseded", "disagreed"],
  not_clinically_significant: ["acknowledged", "escalated", "superseded"],
  disagreed: ["acknowledged", "requires_more_evidence", "escalated", "superseded"],
  requires_more_evidence: ["acknowledged", "escalated", "superseded"],
  escalated: ["acknowledged", "accepted_into_assessment", "superseded"],
  superseded: [],
};

export function canTransitionAcknowledgement(
  from: TrichoscopyAcknowledgementState,
  to: TrichoscopyAcknowledgementState
): boolean {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isAcceptanceAcknowledgement(
  state: TrichoscopyAcknowledgementState
): boolean {
  return (TRICHOSCOPY_ACCEPTANCE_ACK_STATES as readonly string[]).includes(state);
}

/**
 * Safety rule: no HLI output may automatically create or overwrite a diagnosis.
 * Diagnosis decisions require an explicit clinical acceptance acknowledgement.
 */
export function assertDiagnosisAcceptanceGuard(input: {
  decisionKind: TrichoscopyDecisionKind;
  acknowledgementState: TrichoscopyAcknowledgementState | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  const isDiagnosis = (TRICHOSCOPY_DIAGNOSIS_DECISION_KINDS as readonly string[]).includes(
    input.decisionKind
  );
  if (!isDiagnosis) return { ok: true };

  if (!input.acknowledgementState || !isAcceptanceAcknowledgement(input.acknowledgementState)) {
    return {
      ok: false,
      reason:
        "Diagnosis decisions require explicit clinician acceptance of supporting trichoscopy findings.",
    };
  }
  return { ok: true };
}

export function assertFindingReviewAllowed(input: {
  consultationFinalised: boolean;
  acknowledgementState: TrichoscopyAcknowledgementState;
}): { ok: true } | { ok: false; reason: string } {
  if (input.consultationFinalised && input.acknowledgementState !== "superseded") {
    return {
      ok: false,
      reason:
        "Completed consultations freeze acknowledged evidence. Later HLI updates create a review action instead of rewriting this consultation.",
    };
  }
  return { ok: true };
}

export function assertDecisionLinkAllowed(input: {
  consultationFinalised: boolean;
  decisionKind: TrichoscopyDecisionKind;
  acknowledgementState: TrichoscopyAcknowledgementState | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (input.consultationFinalised) {
    return {
      ok: false,
      reason:
        "Completed consultations freeze decision links. Document new clinical decisions on a new consultation or follow-up assessment.",
    };
  }
  return assertDiagnosisAcceptanceGuard({
    decisionKind: input.decisionKind,
    acknowledgementState: input.acknowledgementState,
  });
}
