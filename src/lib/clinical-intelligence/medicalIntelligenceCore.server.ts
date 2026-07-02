import "server-only";

export {
  mapFiPathologyItemsToMarkerInputs,
  interpretFiPathologyMarkers,
  buildFiClinicalInsights,
  buildFiLongevitySignals,
  getFiBloodworkEligibility,
  summarizeFiBloodworkRiskDomains,
  type MedicalIntelligenceMarkerInput,
  type FiPathologyMarkerMappingSkipReason,
  type FiPathologyMarkerMappingResult,
  type FiClinicalInsightsInput,
  type FiLongevitySignalsInput,
  type FiBloodworkEligibilityInput,
} from "@/src/lib/clinical-intelligence/medicalIntelligenceCore";
