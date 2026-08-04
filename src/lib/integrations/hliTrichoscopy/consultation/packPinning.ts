/**
 * FI-TRICHOSCOPY-1B — pack pinning and supersession policy (pure).
 * Completed consultations keep the reviewed pin; new packs must not rewrite history.
 */

export type PackSupersessionDisposition =
  | "sync_findings"
  | "audit_only_leave_pin"
  | "ignore";

/**
 * Decide how an imported (active/superseding) evidence pack should affect a consultation link.
 */
export function resolvePackSupersessionDisposition(input: {
  consultationFinalised: boolean;
  pinnedPackVersion: string | null | undefined;
  incomingPackVersion: string;
  historicalVisible?: boolean;
}): PackSupersessionDisposition {
  if (input.consultationFinalised) {
    // Pin stays; completed consultation is immutable. Operator evidence: audit only.
    return "audit_only_leave_pin";
  }
  // Open consultations sync normalised findings from the new pack.
  return "sync_findings";
}

/**
 * First acceptance pins a pack version; later acceptances on the same consultation must not
 * silently re-pin away from the original reviewed version.
 */
export function resolvePinnedPackVersion(input: {
  existingPinnedVersion: string | null | undefined;
  candidatePackVersion: string;
}): { packVersion: string; newlyPinned: boolean } {
  const existing = String(input.existingPinnedVersion ?? "").trim();
  if (existing) {
    return { packVersion: existing, newlyPinned: false };
  }
  return { packVersion: String(input.candidatePackVersion).trim(), newlyPinned: true };
}

export function assertConsultationMutationAllowed(input: {
  consultationFinalised: boolean;
  mutationKind: "review" | "decision" | "indication" | "request" | "follow_up" | "sync_findings";
}): { ok: true } | { ok: false; reason: string } {
  if (!input.consultationFinalised) return { ok: true };
  if (input.mutationKind === "follow_up") {
    // Follow-ups may still be scheduled against a completed baseline (longitudinal).
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      "Completed consultations freeze trichoscopy evidence and clinician acknowledgements. A superseding HLI pack creates audit/review workflow without rewriting this consultation.",
  };
}

/** Stable finding identity used for uniqueness / idempotent import (mirrors DB expression index). */
export function buildFindingUniquenessKey(input: {
  tenantId: string;
  evidencePackId: string;
  hliFindingId?: string | null;
  findingCode: string;
  observedRegion?: string | null;
}): string {
  const findingKey = String(input.hliFindingId ?? "").trim() || String(input.findingCode).trim();
  const region = String(input.observedRegion ?? "").trim() || "-";
  return [input.tenantId.trim(), input.evidencePackId.trim(), findingKey, region].join(":");
}

export function assertConsentForTrichoscopyRequest(input: {
  patientConsentCapture: boolean;
  patientConsentTransfer: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.patientConsentCapture || !input.patientConsentTransfer) {
    return {
      ok: false,
      reason:
        "Patient consent for capture and transfer is required before requesting trichoscopy.",
    };
  }
  return { ok: true };
}

/** Historical pack visibility: superseded/withdrawn remain readable; only active drives sync. */
export function isEvidencePackHistoricallyVisible(
  localState: "active" | "superseded" | "withdrawn" | string
): boolean {
  return localState === "active" || localState === "superseded" || localState === "withdrawn";
}
