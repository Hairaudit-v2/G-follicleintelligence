import "server-only";

export {
  buildFiPathologyMedicalIntelligenceDisplay,
  buildFiMedicalIntelligenceTwinSummary,
  readFiMedicalIntelligenceSnapshot,
  type BuildFiPathologyMedicalIntelligenceInput,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceCore";

export type {
  FiMedicalIntelligenceDisplay,
  FiMedicalIntelligenceTwinSummary,
  FiMedicalIntelligenceInterpretedMarkerDisplay,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";
