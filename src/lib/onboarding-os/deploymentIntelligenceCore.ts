/**
 * OnboardingOS Phase E2 — Deployment Intelligence engine (pure; no server-only).
 * Go-Live Readiness (Phase E) is embedded as the executive approval / go-live gate.
 */

import type { GoLiveReadinessCheck, GoLiveReadinessSnapshot } from "./goLiveReadinessTypes";
import type {
  DeploymentIntelligenceDomain,
  DeploymentIntelligenceDomainScore,
  DeploymentIntelligenceRecommendation,
  DeploymentIntelligenceSnapshot,
  DeploymentIntelligenceStatus,
  DeploymentScoreBreakdown,
  GuidedAssistAdoptionInput,
} from "./deploymentIntelligenceTypes";
import {
  DEPLOYMENT_INTELLIGENCE_DOMAIN_LABELS,
  DEPLOYMENT_INTELLIGENCE_DOMAIN_WEIGHTS,
  DEPLOYMENT_INTELLIGENCE_STATUS_LABELS,
} from "./deploymentIntelligenceTypes";
import type { ProvisioningSessionStatus } from "./tenantProvisioningTypes";

export type DeploymentIntelligenceInputSignals = {
  sessionId: string;
  tenantId: string | null;
  tenantName: string;
  tenantSlug: string;
  countryLabel: string;
  provisioningStatus: ProvisioningSessionStatus | null;
  provisioningProgressPercent: number;
  sandboxSeedEnabled: boolean;
  sandboxSeedApplied: boolean;
  goLiveReadiness: GoLiveReadinessSnapshot;
  guidedAssistAdoption: GuidedAssistAdoptionInput;
  calculatedAt: string;
};

const INFRASTRUCTURE_CHECKS = [
  "tenant_shell_provisioned",
  "clinic_locations_created",
  "modules_enabled",
  "deployment_template_applied",
] as const;

const WORKFLOW_CHECKS = [
  "service_catalog_deployed",
  "key_workflows_configured",
  "academy_tracks_planned",
  "sandbox_seed_applied",
] as const;

const STAFF_CHECKS = ["staff_invited", "roles_assigned"] as const;

function checkScoreFromCodes(
  checks: readonly GoLiveReadinessCheck[],
  codes: readonly string[],
  opts?: { treatSkippedAsPass?: boolean }
): { percent: number; blockers: string[] } {
  const relevant = checks.filter((c) => (codes as readonly string[]).includes(c.code));
  if (relevant.length === 0) return { percent: 0, blockers: ["No matching readiness checks."] };

  let passed = 0;
  const blockers: string[] = [];
  for (const check of relevant) {
    const ok = check.state === "pass" || (opts?.treatSkippedAsPass && check.state === "skipped");
    if (ok) passed += 1;
    else if (check.state === "fail") blockers.push(check.detail ?? check.label);
  }
  return { percent: Math.round((passed / relevant.length) * 100), blockers };
}

function operationalReadinessScore(signals: DeploymentIntelligenceInputSignals): {
  percent: number;
  blockers: string[];
} {
  const blockers: string[] = [];
  let points = 0;
  const max = 4;

  if (signals.provisioningProgressPercent >= 80) points += 1;
  else blockers.push(`Provisioning ${signals.provisioningProgressPercent}% complete (target 80%+).`);

  const clinicDeployed =
    signals.goLiveReadiness.checks.find((c) => c.code === "service_catalog_deployed")?.state === "pass";
  if (clinicDeployed) points += 1;
  else blockers.push("Clinic configuration not fully deployed.");

  if (!signals.sandboxSeedEnabled || signals.sandboxSeedApplied) points += 1;
  else blockers.push("Sandbox demo data not applied for operational testing.");

  const testingSignals =
    signals.guidedAssistAdoption.totalEvents > 0 || signals.provisioningProgressPercent >= 60;
  if (testingSignals) points += 1;
  else blockers.push("Limited operational testing activity detected.");

  return { percent: Math.round((points / max) * 100), blockers };
}

/** Map Phase E go-live readiness into executive approval domain score. */
export function mapGoLiveReadinessToExecutiveApproval(
  snapshot: GoLiveReadinessSnapshot
): { scorePercent: number; summary: string; blockers: string[] } {
  const blockers: string[] = [];
  let score = 0;

  if (snapshot.reviews.ownerReviewComplete) score += 25;
  else blockers.push("Tenant owner review pending.");

  if (snapshot.reviews.platformReviewComplete) score += 25;
  else blockers.push("Platform admin review pending.");

  if (snapshot.status === "ready" || snapshot.status === "approved") score += 20;
  else if (snapshot.status === "warning") {
    score += 10;
    blockers.push("Optional go-live checklist items need attention.");
  } else if (snapshot.status === "blocked") {
    blockers.push("Critical go-live blockers remain.");
  }

  if (snapshot.reviews.goLiveApproved) {
    score = 100;
  } else {
    score += Math.round(snapshot.score.percent * 0.3);
    if (snapshot.status === "ready") blockers.push("Awaiting platform go-live approval.");
  }

  score = Math.min(100, score);

  const summary = snapshot.reviews.goLiveApproved
    ? "Production go-live approved by platform admin."
    : snapshot.reviews.platformReviewComplete && snapshot.reviews.ownerReviewComplete
      ? "Reviews complete — ready for go-live approval gate."
      : "Executive sign-off in progress via Go-Live Readiness.";

  return { scorePercent: score, summary, blockers };
}

/** Map Guided Assist usage into adoption confidence domain score. */
export function mapGuidedAssistSummaryToAdoptionConfidence(
  input: GuidedAssistAdoptionInput
): { scorePercent: number; summary: string; blockers: string[] } {
  const blockers: string[] = [];

  if (!input.guidedAssistConfigured) {
    return {
      scorePercent: 10,
      summary: "Guided Assist not configured — low adoption signal.",
      blockers: ["Enable Guided Assist tenant defaults."],
    };
  }

  if (input.totalEvents === 0) {
    return {
      scorePercent: 35,
      summary: "Guided Assist configured but no usage telemetry yet.",
      blockers: ["Staff have not engaged with Guided Assist during setup."],
    };
  }

  let score = 40;
  if (input.uniqueUsers >= 2) score += 20;
  else blockers.push("Fewer than two staff members using Guided Assist.");

  if (input.nextActionsClicked > 0) score += 15;
  else blockers.push("No Guided Assist next-actions clicked.");

  const dismissRate = input.tipsShown > 0 ? input.tipsDismissed / input.tipsShown : 0;
  if (dismissRate < 0.5) score += 15;
  else blockers.push("High Guided Assist dismiss rate — review onboarding paths.");

  if (input.modulesNeedingGuidanceReviewCount === 0) score += 10;
  else blockers.push(`${input.modulesNeedingGuidanceReviewCount} module(s) flagged for guidance review.`);

  return {
    scorePercent: Math.min(100, score),
    summary:
      score >= 75
        ? "Strong staff adoption signals from Guided Assist usage."
        : score >= 50
          ? "Moderate adoption — continue staff onboarding."
          : "Early adoption — increase Guided Assist engagement.",
    blockers,
  };
}

function buildDomainScore(
  domain: DeploymentIntelligenceDomain,
  scorePercent: number,
  summary: string,
  blockers: string[]
): DeploymentIntelligenceDomainScore {
  const weight = DEPLOYMENT_INTELLIGENCE_DOMAIN_WEIGHTS[domain];
  return {
    domain,
    label: DEPLOYMENT_INTELLIGENCE_DOMAIN_LABELS[domain],
    weight,
    scorePercent,
    weightedContribution: Math.round((scorePercent * weight) / 100),
    summary,
    blockers,
  };
}

/** Build all deployment intelligence domain scores. */
export function buildDeploymentIntelligenceDomains(
  signals: DeploymentIntelligenceInputSignals
): DeploymentIntelligenceDomainScore[] {
  const checks = signals.goLiveReadiness.checks;

  const infra = checkScoreFromCodes(checks, INFRASTRUCTURE_CHECKS, { treatSkippedAsPass: false });
  const workflow = checkScoreFromCodes(checks, WORKFLOW_CHECKS, { treatSkippedAsPass: true });
  const staff = checkScoreFromCodes(checks, STAFF_CHECKS);
  const operational = operationalReadinessScore(signals);
  const adoption = mapGuidedAssistSummaryToAdoptionConfidence(signals.guidedAssistAdoption);
  const executive = mapGoLiveReadinessToExecutiveApproval(signals.goLiveReadiness);

  return [
    buildDomainScore(
      "infrastructure_readiness",
      infra.percent,
      infra.percent >= 100 ? "Core infrastructure provisioned." : "Infrastructure provisioning incomplete.",
      infra.blockers
    ),
    buildDomainScore(
      "workflow_readiness",
      workflow.percent,
      workflow.percent >= 80 ? "Workflows and service catalog aligned." : "Workflow deployment needs work.",
      workflow.blockers
    ),
    buildDomainScore(
      "staff_readiness",
      staff.percent,
      staff.percent >= 100 ? "Staff invited and roles assigned." : "Staff onboarding incomplete.",
      staff.blockers
    ),
    buildDomainScore(
      "operational_readiness",
      operational.percent,
      operational.percent >= 75 ? "Operational testing signals are healthy." : "Operational testing in early stages.",
      operational.blockers
    ),
    buildDomainScore(
      "adoption_confidence",
      adoption.scorePercent,
      adoption.summary,
      adoption.blockers
    ),
    buildDomainScore(
      "executive_approval",
      executive.scorePercent,
      executive.summary,
      executive.blockers
    ),
  ];
}

/** Calculate weighted deployment score from domain scores. */
export function calculateDeploymentScore(
  domainScores: readonly DeploymentIntelligenceDomainScore[]
): DeploymentScoreBreakdown {
  const totalWeight = domainScores.reduce((sum, d) => sum + d.weight, 0);
  const overallScore =
    totalWeight === 0
      ? 0
      : Math.round(domainScores.reduce((sum, d) => sum + d.weightedContribution, 0));

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    domainScores,
    totalWeight,
  };
}

/** Resolve deployment status band from overall score. */
export function resolveDeploymentStatus(overallScore: number): DeploymentIntelligenceStatus {
  if (overallScore <= 30) return "early_setup";
  if (overallScore <= 50) return "infrastructure_in_progress";
  if (overallScore <= 70) return "internal_testing";
  if (overallScore <= 85) return "staff_training_active";
  if (overallScore <= 95) return "pilot_ready";
  return "production_ready";
}

/** Production-ready threshold helper (96+). */
export function isProductionReadyScore(overallScore: number): boolean {
  return overallScore >= 96;
}

/** Build full deployment intelligence snapshot. */
export function buildDeploymentIntelligenceSnapshot(
  signals: DeploymentIntelligenceInputSignals
): DeploymentIntelligenceSnapshot {
  const domainScores = buildDeploymentIntelligenceDomains(signals);
  const scoreBreakdown = calculateDeploymentScore(domainScores);
  const deploymentStatus = resolveDeploymentStatus(scoreBreakdown.overallScore);
  const recommendations = generateDeploymentIntelligenceRecommendations(domainScores, signals.goLiveReadiness);

  const adoptionDomain = domainScores.find((d) => d.domain === "adoption_confidence");
  const executiveDomain = domainScores.find((d) => d.domain === "executive_approval");

  return {
    sessionId: signals.sessionId,
    tenantId: signals.tenantId,
    tenantName: signals.tenantName,
    tenantSlug: signals.tenantSlug,
    countryLabel: signals.countryLabel,
    provisioningStatus: signals.provisioningStatus,
    provisioningProgressPercent: signals.provisioningProgressPercent,
    deploymentScore: scoreBreakdown.overallScore,
    deploymentStatus,
    scoreBreakdown,
    recommendations,
    adoptionConfidenceScore: adoptionDomain?.scorePercent ?? 0,
    executiveApprovalScore: executiveDomain?.scorePercent ?? 0,
    goLiveReadiness: signals.goLiveReadiness,
    calculatedAt: signals.calculatedAt,
    snapshotId: null,
  };
}

/** Generate cross-domain recommendations. */
export function generateDeploymentIntelligenceRecommendations(
  domainScores: readonly DeploymentIntelligenceDomainScore[],
  goLive: GoLiveReadinessSnapshot
): DeploymentIntelligenceRecommendation[] {
  const recs: DeploymentIntelligenceRecommendation[] = [];

  for (const domain of domainScores) {
    if (domain.scorePercent >= 80) continue;
    for (const blocker of domain.blockers.slice(0, 2)) {
      recs.push({
        code: `domain_${domain.domain}_${recs.length}`,
        severity: domain.scorePercent < 50 ? "blocker" : "warning",
        title: domain.label,
        message: blocker,
        domain: domain.domain,
      });
    }
  }

  for (const rec of goLive.recommendations) {
    if (rec.severity === "info") continue;
    recs.push({
      code: `go_live_${rec.code}`,
      severity: rec.severity,
      title: rec.title,
      message: rec.message,
      domain: "executive_approval",
    });
  }

  if (isProductionReadyScore(calculateDeploymentScore(domainScores).overallScore) && !goLive.reviews.goLiveApproved) {
    recs.push({
      code: "production_ready_pending_approval",
      severity: "info",
      title: "Production Ready",
      message: `Deployment score meets production threshold (${DEPLOYMENT_INTELLIGENCE_STATUS_LABELS.production_ready}). Platform admin must explicitly approve go-live.`,
      domain: "executive_approval",
    });
  }

  return recs;
}

/** Infer display country/region label from IANA timezone. */
export function inferCountryLabelFromTimezone(timezone: string | null | undefined): string {
  if (!timezone?.trim()) return "—";
  const segment = timezone.trim().split("/")[0];
  return segment ? segment.replace(/_/g, " ") : timezone.trim();
}
