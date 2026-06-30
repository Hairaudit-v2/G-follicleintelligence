/**
 * OnboardingOS Phase E2 — Deployment Intelligence Command Centre types (safe for core unit tests; no server-only).
 */

import type { GoLiveReadinessSnapshot } from "./goLiveReadinessTypes";
import type { ProvisioningSessionStatus } from "./tenantProvisioningTypes";

export const DEPLOYMENT_INTELLIGENCE_DOMAINS = [
  "infrastructure_readiness",
  "workflow_readiness",
  "staff_readiness",
  "operational_readiness",
  "adoption_confidence",
  "executive_approval",
] as const;

export type DeploymentIntelligenceDomain = (typeof DEPLOYMENT_INTELLIGENCE_DOMAINS)[number];

export const DEPLOYMENT_INTELLIGENCE_DOMAIN_WEIGHTS: Record<DeploymentIntelligenceDomain, number> =
  {
    infrastructure_readiness: 25,
    workflow_readiness: 20,
    staff_readiness: 20,
    operational_readiness: 15,
    adoption_confidence: 10,
    executive_approval: 10,
  };

export const DEPLOYMENT_INTELLIGENCE_STATUSES = [
  "early_setup",
  "infrastructure_in_progress",
  "internal_testing",
  "staff_training_active",
  "pilot_ready",
  "production_ready",
] as const;

export type DeploymentIntelligenceStatus = (typeof DEPLOYMENT_INTELLIGENCE_STATUSES)[number];

export type DeploymentIntelligenceDomainScore = {
  domain: DeploymentIntelligenceDomain;
  label: string;
  weight: number;
  scorePercent: number;
  weightedContribution: number;
  summary: string;
  blockers: readonly string[];
};

export type DeploymentScoreBreakdown = {
  overallScore: number;
  domainScores: readonly DeploymentIntelligenceDomainScore[];
  totalWeight: number;
};

export type DeploymentIntelligenceRecommendation = {
  code: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  message: string;
  domain: DeploymentIntelligenceDomain | null;
};

export type DeploymentIntelligenceSnapshot = {
  sessionId: string;
  tenantId: string | null;
  tenantName: string;
  tenantSlug: string;
  countryLabel: string;
  provisioningStatus: ProvisioningSessionStatus | null;
  provisioningProgressPercent: number;
  deploymentScore: number;
  deploymentStatus: DeploymentIntelligenceStatus;
  scoreBreakdown: DeploymentScoreBreakdown;
  recommendations: readonly DeploymentIntelligenceRecommendation[];
  adoptionConfidenceScore: number;
  executiveApprovalScore: number;
  goLiveReadiness: GoLiveReadinessSnapshot;
  calculatedAt: string;
  snapshotId: string | null;
};

export const DEPLOYMENT_INTELLIGENCE_DOMAIN_LABELS: Record<DeploymentIntelligenceDomain, string> = {
  infrastructure_readiness: "Infrastructure Readiness",
  workflow_readiness: "Workflow Readiness",
  staff_readiness: "Staff Readiness",
  operational_readiness: "Operational Readiness",
  adoption_confidence: "Adoption Confidence",
  executive_approval: "Executive Approval",
};

export const DEPLOYMENT_INTELLIGENCE_STATUS_LABELS: Record<DeploymentIntelligenceStatus, string> = {
  early_setup: "Early Setup",
  infrastructure_in_progress: "Infrastructure In Progress",
  internal_testing: "Internal Testing",
  staff_training_active: "Staff Training Active",
  pilot_ready: "Pilot Ready",
  production_ready: "Production Ready",
};

export const DEPLOYMENT_INTELLIGENCE_STATUS_BADGES: Record<
  DeploymentIntelligenceStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  early_setup: { label: "Early Setup", tone: "neutral" },
  infrastructure_in_progress: { label: "Infrastructure In Progress", tone: "info" },
  internal_testing: { label: "Internal Testing", tone: "info" },
  staff_training_active: { label: "Staff Training Active", tone: "warning" },
  pilot_ready: { label: "Pilot Ready", tone: "success" },
  production_ready: { label: "Production Ready", tone: "success" },
};

export type PlatformDeploymentDashboardRow = {
  sessionId: string;
  tenantId: string | null;
  tenantName: string;
  tenantSlug: string;
  countryLabel: string;
  provisioningStatus: ProvisioningSessionStatus;
  provisioningProgressPercent: number;
  deploymentScore: number;
  deploymentStatus: DeploymentIntelligenceStatus;
  criticalBlockers: readonly string[];
  adoptionConfidenceScore: number;
  goLiveApprovalState: "blocked" | "pending" | "ready" | "approved";
};

export type GuidedAssistAdoptionInput = {
  guidedAssistConfigured: boolean;
  totalEvents: number;
  uniqueUsers: number;
  tipsShown: number;
  tipsDismissed: number;
  nextActionsClicked: number;
  modulesNeedingGuidanceReviewCount: number;
};

export type ConnectorAuthReadinessInput = {
  registeredCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  failedCount: number;
  avgPermissionCoverage: number;
};
