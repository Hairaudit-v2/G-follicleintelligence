import {
  getFiClinicalIntelligenceSignalDefinition,
  type FiClinicalIntelligenceSignalKey,
} from "@/src/config/fiClinicalIntelligenceSignals";

/** Workspace-aware wrapper; still rule-based and non-clinical (no treatment directives). */
export function recommendedNextStepForClinicalSignal(key: FiClinicalIntelligenceSignalKey): string {
  const def = getFiClinicalIntelligenceSignalDefinition(key);
  return def?.recommendedNextStep ?? "Review this item in the relevant workspace when convenient.";
}

/** Heuristic guard: recommendations must not read like prescribing or dosing instructions. */
export function clinicalRecommendationLooksTreatmentLike(text: string): boolean {
  const t = text.toLowerCase();
  const banned = [
    "take ",
    "stop taking",
    "start taking",
    "increase the dose",
    "decrease the dose",
    "double the dose",
    "milligrams",
    " mg",
    "prescribe",
    "prescription",
    "taper ",
    "wean off",
  ];
  return banned.some((b) => t.includes(b));
}

export function assertSafeClinicalRecommendationCopy(text: string): void {
  if (clinicalRecommendationLooksTreatmentLike(text)) {
    throw new Error("Clinical intelligence recommendation copy must not resemble treatment or dosing advice.");
  }
}
