/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — readiness fail-closed rules (pure).
 * Full domain engines land in 1A.2; these contracts freeze overall composition.
 */

import type {
  AppointmentReadinessState,
  ClinicalReadinessState,
  ConsentDocumentReadinessState,
  FinancialReadinessState,
  ImageReadinessState,
  OperationalReadinessState,
  OverallReadinessState,
  PathologyReadinessState,
  PatientReadinessState,
  PilotSourceProvenance,
} from "./pilotControlContracts";

export type PilotDomainReadinessSnapshot = {
  clinical: ClinicalReadinessState;
  financial: FinancialReadinessState;
  operational: OperationalReadinessState;
  patient: PatientReadinessState;
  consent: ConsentDocumentReadinessState;
  documents: ConsentDocumentReadinessState;
  pathology: PathologyReadinessState;
  images: ImageReadinessState;
  appointment: AppointmentReadinessState;
  /** Identity / tenant integrity — true means fail-closed block. */
  identityIntegrityBlocked: boolean;
  /** Technical delivery failures (notifications, jobs) — attention, not silent pass. */
  technicalAttention: boolean;
  /** Optional actions must never set these flags. */
  mandatoryConsentGap: boolean;
  mandatoryFinancialGateUnmet: boolean;
  clinicalBlockerPresent: boolean;
  enrolmentCompleted: boolean;
  provenance: PilotSourceProvenance[];
};

export type OverallReadinessResult = {
  overall: OverallReadinessState;
  reasons: string[];
  failClosed: boolean;
};

const CLINICAL_BLOCKING = new Set<ClinicalReadinessState>(["blocked"]);
const FINANCIAL_BLOCKING = new Set<FinancialReadinessState>([
  "blocked",
  "reconciliation_required",
]);
const CONSENT_BLOCKING = new Set<ConsentDocumentReadinessState>(["blocked", "unknown"]);
const PATHOLOGY_BLOCKING = new Set<PathologyReadinessState>(["blocked", "unknown"]);
const UNKNOWNISH = new Set(["unknown"]);

function anyUnknownMandatory(snapshot: PilotDomainReadinessSnapshot): boolean {
  return (
    snapshot.consent === "unknown" ||
    snapshot.documents === "unknown" ||
    snapshot.pathology === "unknown" ||
    snapshot.provenance.some((p) => p.unknown)
  );
}

/**
 * Overall readiness is fail-closed and is NOT an average of domain states.
 *
 * Rules (non-negotiable):
 * - Any clinical blocker → blocked
 * - Identity / tenant integrity issue → blocked
 * - Mandatory consent gap → blocked
 * - Required financial gate unmet → blocked
 * - Unknown mandatory state → blocked (never ready)
 * - Technical delivery failures → attention_required (unless already blocked)
 * - Optional actions must not appear in mandatory flags
 */
export function deriveOverallReadiness(
  snapshot: PilotDomainReadinessSnapshot
): OverallReadinessResult {
  const reasons: string[] = [];

  if (snapshot.enrolmentCompleted) {
    return { overall: "completed", reasons: ["enrolment_completed"], failClosed: false };
  }

  if (snapshot.identityIntegrityBlocked) {
    reasons.push("identity_or_tenant_integrity");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (snapshot.clinicalBlockerPresent || CLINICAL_BLOCKING.has(snapshot.clinical)) {
    reasons.push("clinical_blocker");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (snapshot.mandatoryConsentGap || CONSENT_BLOCKING.has(snapshot.consent)) {
    reasons.push("mandatory_consent_gap");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (CONSENT_BLOCKING.has(snapshot.documents) && snapshot.documents === "blocked") {
    reasons.push("mandatory_document_gap");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (
    snapshot.mandatoryFinancialGateUnmet ||
    FINANCIAL_BLOCKING.has(snapshot.financial)
  ) {
    reasons.push("mandatory_financial_gate");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (PATHOLOGY_BLOCKING.has(snapshot.pathology)) {
    reasons.push("pathology_blocker_or_unknown");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (anyUnknownMandatory(snapshot)) {
    reasons.push("unknown_mandatory_state");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (
    snapshot.operational === "blocked" ||
    snapshot.patient === "blocked" ||
    snapshot.images === "blocked" ||
    snapshot.appointment === "blocked"
  ) {
    reasons.push("domain_blocked");
    return { overall: "blocked", reasons, failClosed: true };
  }

  if (snapshot.technicalAttention) {
    reasons.push("technical_attention");
  }

  const allReady =
    (snapshot.clinical === "ready" || snapshot.clinical === "not_applicable") &&
    (snapshot.financial === "cleared" || snapshot.financial === "not_applicable") &&
    (snapshot.operational === "ready" || snapshot.operational === "not_applicable") &&
    (snapshot.patient === "ready" || snapshot.patient === "not_applicable") &&
    (snapshot.consent === "ready" || snapshot.consent === "not_applicable") &&
    (snapshot.documents === "ready" || snapshot.documents === "not_applicable") &&
    (snapshot.pathology === "cleared" || snapshot.pathology === "not_applicable") &&
    (snapshot.images === "ready" || snapshot.images === "not_applicable") &&
    (snapshot.appointment === "ready" ||
      snapshot.appointment === "confirmed" ||
      snapshot.appointment === "not_applicable");

  if (allReady && !snapshot.technicalAttention) {
    return { overall: "ready", reasons: ["all_mandatory_domains_ready"], failClosed: false };
  }

  if (
    snapshot.technicalAttention ||
    snapshot.operational === "attention_required" ||
    snapshot.patient === "attention_required" ||
    snapshot.financial === "payment_plan_active"
  ) {
    reasons.push(reasons.length ? reasons[0]! : "attention_required");
    return { overall: "attention_required", reasons, failClosed: false };
  }

  const anyStarted =
    snapshot.clinical !== "not_started" ||
    snapshot.financial !== "not_started" ||
    snapshot.operational !== "not_started" ||
    snapshot.patient !== "not_started" ||
    snapshot.consent !== "not_started";

  if (!anyStarted) {
    return { overall: "not_started", reasons: ["no_domain_progress"], failClosed: false };
  }

  // Unknownish optional imaging without mandatory flag stays in progress, not ready.
  if (UNKNOWNISH.has(snapshot.images) || UNKNOWNISH.has(snapshot.appointment)) {
    reasons.push("optional_or_partial_unknown_kept_in_progress");
  }

  return { overall: "in_progress", reasons: reasons.length ? reasons : ["in_progress"], failClosed: false };
}

/** Optional document missing must not flip overall to blocked by itself. */
export function optionalDocumentDoesNotBlock(args: {
  optionalDocumentMissing: boolean;
  mandatoryConsentGap: boolean;
}): boolean {
  return args.optionalDocumentMissing && !args.mandatoryConsentGap;
}
