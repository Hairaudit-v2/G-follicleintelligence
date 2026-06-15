/**
 * Policy decision types for cross-system exports and graph builds.
 * Runtime enforcement remains in application code until Stage 10 wiring.
 */

export type IntelligenceExportMode = "disabled" | "dev_only" | "allowed";

export type IntelligenceExportPolicyDecision = {
  canExportCompetencyData: boolean;
  canExportAuditData: boolean;
  canBuildProfessionalGraph: boolean;
  canSendToFiOs: boolean;
  requiresConsent: boolean;
  exportMode: IntelligenceExportMode;
};

/** Safe default: everything off until explicitly configured. */
export function defaultIntelligenceExportPolicy(): IntelligenceExportPolicyDecision {
  return {
    canExportCompetencyData: false,
    canExportAuditData: false,
    canBuildProfessionalGraph: false,
    canSendToFiOs: false,
    requiresConsent: true,
    exportMode: "disabled",
  };
}
