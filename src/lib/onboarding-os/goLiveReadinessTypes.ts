/**
 * OnboardingOS Phase E — Go-Live Readiness Command Centre types (safe for core unit tests; no server-only).
 */

export const GO_LIVE_READINESS_AREAS = [
  "infrastructure",
  "deployment",
  "training",
  "people",
  "governance",
] as const;

export type GoLiveReadinessArea = (typeof GO_LIVE_READINESS_AREAS)[number];

export const GO_LIVE_READINESS_CHECK_CODES = [
  "tenant_shell_provisioned",
  "clinic_locations_created",
  "modules_enabled",
  "deployment_template_applied",
  "service_catalog_deployed",
  "sandbox_seed_applied",
  "guided_assist_enabled",
  "staff_invited",
  "roles_assigned",
  "academy_tracks_planned",
  "key_workflows_configured",
  "owner_review_complete",
  "platform_review_complete",
] as const;

export type GoLiveReadinessCheckCode = (typeof GO_LIVE_READINESS_CHECK_CODES)[number];

export type GoLiveReadinessCheckSeverity = "required" | "optional";

export type GoLiveReadinessCheckState = "pass" | "fail" | "skipped";

export type GoLiveReadinessCheck = {
  code: GoLiveReadinessCheckCode;
  area: GoLiveReadinessArea;
  label: string;
  description: string;
  severity: GoLiveReadinessCheckSeverity;
  state: GoLiveReadinessCheckState;
  detail: string | null;
  reviewed: boolean;
};

export const GO_LIVE_READINESS_STATUSES = ["blocked", "warning", "ready", "approved"] as const;

export type GoLiveReadinessStatus = (typeof GO_LIVE_READINESS_STATUSES)[number];

export type GoLiveReadinessScore = {
  percent: number;
  requiredPassed: number;
  requiredTotal: number;
  optionalPassed: number;
  optionalTotal: number;
};

export type GoLiveReadinessReviewStatus = {
  ownerReviewComplete: boolean;
  ownerReviewedAt: string | null;
  ownerReviewerLabel: string | null;
  platformReviewComplete: boolean;
  platformReviewedAt: string | null;
  platformReviewerLabel: string | null;
  goLiveApproved: boolean;
  goLiveApprovedAt: string | null;
};

export type GoLiveReadinessRecommendation = {
  code: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  message: string;
  relatedCheckCode: GoLiveReadinessCheckCode | null;
};

export type GoLiveReadinessSnapshot = {
  sessionId: string;
  tenantId: string | null;
  tenantSlug: string;
  tenantName: string;
  status: GoLiveReadinessStatus;
  score: GoLiveReadinessScore;
  checks: readonly GoLiveReadinessCheck[];
  recommendations: readonly GoLiveReadinessRecommendation[];
  reviews: GoLiveReadinessReviewStatus;
  generatedAt: string;
  snapshotId: string | null;
};

export const GO_LIVE_READINESS_AREA_LABELS: Record<GoLiveReadinessArea, string> = {
  infrastructure: "Infrastructure",
  deployment: "Deployment",
  training: "Training",
  people: "People",
  governance: "Governance",
};

export const GO_LIVE_READINESS_STATUS_BADGES: Record<
  GoLiveReadinessStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  blocked: { label: "Blocked", tone: "danger" },
  warning: { label: "Warning", tone: "warning" },
  ready: { label: "Ready", tone: "success" },
  approved: { label: "Go-live approved", tone: "info" },
};

export type GoLiveReadinessApprovalEventKind =
  | "owner_review"
  | "platform_review"
  | "checklist_item"
  | "go_live_approved";

export type GoLiveReadinessApprovalEvent = {
  id: string;
  tenantId: string;
  sessionId: string;
  eventKind: GoLiveReadinessApprovalEventKind;
  checkCode: string | null;
  actorAuthUserId: string | null;
  actorLabel: string | null;
  actorRole: "tenant_admin" | "platform_admin" | null;
  detail: Record<string, unknown>;
  occurredAt: string;
};
