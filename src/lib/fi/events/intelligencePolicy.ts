/**
 * FI-side policy gate wrapping `@follicle/intelligence-core` defaults.
 * Defaults remain off unless dev/test explicitly opts in (no ingest behavior change).
 */

import {
  defaultIntelligenceExportPolicy,
  type IntelligenceExportPolicyDecision,
} from "@follicle/intelligence-core";

let cachedOverride: IntelligenceExportPolicyDecision | undefined;

/** Test hook: restore default caching behavior. */
export function __resetIntelligencePolicyCacheForTests(): void {
  cachedOverride = undefined;
}

/**
 * Returns export policy. In `NODE_ENV=test` without override, still returns **disabled** defaults
 * unless `FI_INTELLIGENCE_POLICY_DEV=1` is set (opt-in for policy adapter tests).
 */
export function getIntelligenceExportPolicy(): IntelligenceExportPolicyDecision {
  if (cachedOverride) return cachedOverride;

  const dev = process.env.FI_INTELLIGENCE_POLICY_DEV === "1";
  const env = process.env.NODE_ENV;
  if (dev && (env === "development" || env === "test")) {
    cachedOverride = {
      ...defaultIntelligenceExportPolicy(),
      exportMode: "dev_only",
      canSendToFiOs: true,
      canExportAuditData: true,
      canExportCompetencyData: true,
      canBuildProfessionalGraph: true,
    };
    return cachedOverride;
  }

  return defaultIntelligenceExportPolicy();
}

export function canEmitCrossSystemEvent(): boolean {
  const p = getIntelligenceExportPolicy();
  return p.exportMode !== "disabled" && p.canSendToFiOs;
}

export function canExportClinicalPayload(): boolean {
  const p = getIntelligenceExportPolicy();
  return p.exportMode !== "disabled" && (p.canExportAuditData || p.canExportCompetencyData);
}

export function canBuildGraphPayload(): boolean {
  const p = getIntelligenceExportPolicy();
  return p.exportMode !== "disabled" && p.canBuildProfessionalGraph;
}
