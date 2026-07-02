import "server-only";

export {
  buildFiPathologyMedicalIntelligenceDisplay,
  buildFiMedicalIntelligenceSnapshot,
  buildFiMedicalIntelligenceTwinSummary,
  mergeMedicalIntelligenceSnapshotIntoMetadata,
  readFiMedicalIntelligenceSnapshot,
  resolveMedicalIntelligencePackageVersion,
  type BuildFiPathologyMedicalIntelligenceInput,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceCore";

export type {
  FiMedicalIntelligenceDisplay,
  FiMedicalIntelligenceSnapshotMetadata,
  FiMedicalIntelligenceTwinSummary,
  FiMedicalIntelligenceInterpretedMarkerDisplay,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";
