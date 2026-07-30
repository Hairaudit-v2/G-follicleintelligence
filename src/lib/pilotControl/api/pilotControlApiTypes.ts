/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — stable API response contracts (pure).
 * Serializers consume engines; they do not recalculate readiness/severity/health.
 */

import type {
  OverallReadinessState,
  PilotBlockerCategory,
  PilotBlockerDimension,
  PilotBlockerSeverity,
  PilotControlPermissionScope,
  PilotControlRoleKey,
  PilotEnrolmentStatus,
  PilotHealthVerdict,
  PilotProgrammeStatus,
  PilotSourceModule,
} from "../pilotControlContracts";
import type { PilotBlockerHealthInput } from "../blockers/blockerTypes";
import type { PilotPatientReadiness } from "../readiness/readinessTypes";

export const PILOT_CONTROL_API_ERROR_CODES = [
  "PILOT_CONTROL_UNAUTHENTICATED",
  "PILOT_CONTROL_FORBIDDEN",
  "PILOT_CONTROL_PROGRAMME_NOT_FOUND",
  "PILOT_CONTROL_PATIENT_NOT_ENROLLED",
  "PILOT_CONTROL_IDENTITY_AMBIGUOUS",
  "PILOT_CONTROL_TENANT_MISMATCH",
  "PILOT_CONTROL_INVALID_FILTER",
  "PILOT_CONTROL_INVALID_PAGINATION",
  "PILOT_CONTROL_DATE_RANGE_TOO_WIDE",
  "PILOT_CONTROL_SOURCE_UNAVAILABLE",
  "PILOT_CONTROL_PARTIAL_RESULT",
  "PILOT_CONTROL_EVALUATION_FAILED",
  "PILOT_CONTROL_RATE_LIMITED",
  "PILOT_CONTROL_EXPORT_DENIED",
] as const;

export type PilotControlApiErrorCode = (typeof PILOT_CONTROL_API_ERROR_CODES)[number];

export type PilotControlApiWarning = {
  code: string;
  message: string;
  sourceCategory?: string;
  readinessDowngraded?: boolean;
};

export type PilotEvaluationMetadata = {
  evaluatedAt: string;
  readinessVersion: string;
  blockerVersion: string;
  healthVersion: string;
  oldestSourceUpdatedAt?: string;
  staleSources: string[];
  blockerPersistenceMode: "read_only" | "reconciled";
};

export type PilotControlResponseMetadata = {
  apiVersion: string;
  evaluationVersion: string;
  programmeId: string;
  tenantId: string;
  generatedAt: string;
  sourceFreshnessAt?: string;
  correlationId: string;
  partial: boolean;
  warnings: PilotControlApiWarning[];
  evaluation?: PilotEvaluationMetadata;
};

export type PilotControlApiResponse<T> = {
  data: T;
  meta: PilotControlResponseMetadata;
};

export type PilotControlPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PilotControlPaginatedResponse<T> = {
  data: T[];
  pagination: PilotControlPagination;
  meta: PilotControlResponseMetadata;
};

export type PilotControlApiErrorBody = {
  error: {
    code: PilotControlApiErrorCode | string;
    message: string;
    correlationId: string;
  };
};

export type PilotControlRequestContext = {
  actorId: string;
  actorRole: PilotControlRoleKey;
  fiUserId: string | null;
  tenantId: string;
  clinicId?: string;
  programmeId: string;
  programmeKey: string;
  permissions: readonly PilotControlPermissionScope[];
  correlationId: string;
  requestedAt: string;
  timezone: string;
  /** True when request came from automatic refresh (skip noisy audit). */
  isAutomaticRefresh: boolean;
};

export type PilotSourceLink = {
  module:
    | "patient"
    | "journey"
    | "consultation"
    | "clinical"
    | "finance"
    | "documents"
    | "pathology"
    | "images"
    | "messages"
    | "appointments"
    | "technical";
  label: string;
  href: string;
  permissionRequired: PilotControlPermissionScope | string;
};

export type PilotProgrammeSummary = {
  id: string;
  key: string;
  name: string;
  status: PilotProgrammeStatus | string;
  realPatientInvitesEnabled: boolean;
  enrolmentCounts: Record<PilotEnrolmentStatus, number>;
  lastEvaluatedAt?: string;
};

export type PilotActionSummary = {
  id?: string;
  label: string;
  ownerType?: string;
  dueAt?: string;
  overdue?: boolean;
};

export type PilotBlockerSummary = {
  id?: string;
  category: PilotBlockerCategory;
  title: string;
  severity: PilotBlockerSeverity;
  state?: string;
};

export type PilotUrgentItemSummary = {
  kind: "blocker" | "action" | "health";
  severity: PilotBlockerSeverity | "attention";
  title: string;
  patientId?: string;
  enrolmentId?: string;
  recommendedNextAction?: string;
};

export type PilotControlOverview = {
  programme: PilotProgrammeSummary;
  cohort: {
    totalApproved: number;
    invited: number;
    activated: number;
    active: number;
    paused: number;
    completed: number;
    withdrawn: number;
  };
  readiness: {
    notStarted: number;
    inProgress: number;
    attentionRequired: number;
    blocked: number;
    ready: number;
    completed: number;
  };
  blockers: PilotBlockerHealthInput;
  actions: {
    patientOwnedOpen: number;
    clinicOwnedOpen: number;
    unassignedOpen: number;
    overduePatient: number;
    overdueClinic: number;
  };
  app: {
    invited: number;
    activated: number;
    activationRate: number | null;
    inactivePatients: number;
    pushAvailable: number;
    pushUnavailable: number;
  };
  health: {
    verdict: PilotHealthVerdict;
    score: number;
    reasons: string[];
    criticalFailClosed: boolean;
    expansionRecommendation:
      | "continue_current_scope"
      | "hold_expansion"
      | "pause_pilot"
      | "insufficient_evidence";
    ruleVersion: string;
  };
  urgentItems: PilotUrgentItemSummary[];
  /** Pause recommendation — omitted when role lacks overview_full. */
  pauseRecommendation?: {
    requiresPilotPause: boolean;
    blockersRequiringPilotPause: number;
  };
  generatedAt: string;
};

export type PilotPatientRegisterRow = {
  enrolmentId: string;
  patientId: string;
  patient: { displayName: string; reference?: string };
  clinic: { id?: string; name?: string };
  pilotStatus: PilotEnrolmentStatus;
  journey: {
    milestone: string;
    milestoneLabel: string;
    timeInMilestoneSeconds?: number;
  };
  readiness: {
    clinical: string;
    financial: string;
    patient: string;
    operational: string;
    technical: string;
    overall: OverallReadinessState;
  };
  nextActions: {
    patient?: PilotActionSummary;
    clinic?: PilotActionSummary;
  };
  blockerSummary: {
    totalOpen: number;
    highestSeverity?: PilotBlockerSeverity;
    primaryBlocker?: PilotBlockerSummary;
  };
  app: {
    invitationState: string;
    activationState: string;
    lastActivityAt?: string;
  };
  ownership: {
    operationalOwnerType?: string;
    operationalOwnerName?: string;
  };
  activity: {
    lastPatientActivityAt?: string;
    lastStaffActivityAt?: string;
    lastSystemEventAt?: string;
  };
  evaluatedAt: string;
};

export type PilotPatientControlDetail = {
  identity: {
    patientId: string;
    displayName: string;
    reference?: string;
    identityIntegrityOk?: boolean;
  };
  enrolment: {
    enrolmentId: string;
    status: PilotEnrolmentStatus;
    enrolledAt?: string | null;
    invitedAt?: string | null;
    activatedAt?: string | null;
  };
  journey: {
    milestone: string;
    milestoneLabel: string;
  };
  readiness: PilotPatientReadiness;
  blockers: unknown[];
  actions: {
    patient: PilotActionSummary[];
    clinic: PilotActionSummary[];
  };
  clinical?: unknown;
  financial?: unknown;
  documents?: unknown;
  consent?: unknown;
  pathology?: unknown;
  images?: unknown;
  communication?: unknown;
  app?: unknown;
  technical?: unknown;
  sourceLinks: PilotSourceLink[];
  evaluatedAt: string;
};

export type PilotBlockerListItem = {
  id: string;
  patientId: string;
  enrolmentId: string;
  category: PilotBlockerCategory;
  dimension: PilotBlockerDimension;
  title: string;
  summary: string;
  recommendedNextAction: string;
  severity: PilotBlockerSeverity;
  state: string;
  ownership: {
    ownerType: string;
    ownerRole?: string;
    assignmentSource?: string;
  };
  escalation: {
    level: string;
    escalated: boolean;
    requiresPilotPause?: boolean;
  };
  firstDetectedAt: string;
  lastConfirmedAt: string;
  ageSeconds: number;
  sourceModule: PilotSourceModule | string;
  sourceLink?: PilotSourceLink;
  patientSafeSummary?: string;
  evaluatedAt: string;
};

export type PilotControlActivityItem = {
  eventId: string;
  eventType: string;
  patientId?: string;
  enrolmentId?: string;
  actorType: string;
  actorId?: string;
  sourceModule: string;
  occurredAt: string;
  correlationId?: string;
  safeSummary: string;
};

export type PilotControlHealthResponse = {
  verdict: PilotHealthVerdict;
  score?: number;
  dimensions: {
    activation: { status: string; evidence: string };
    journeyProgression: { status: string; evidence: string };
    actionCompletion: { status: string; evidence: string };
    clinicalSafety: { status: string; evidence: string };
    financialReadiness: { status: string; evidence: string };
    communication: { status: string; evidence: string };
    technicalReliability: { status: string; evidence: string };
    dataIntegrity: { status: string; evidence: string };
    staffAdoption: { status: string; evidence: string };
    blockerBacklog: { status: string; evidence: string };
  };
  blockerInputs: PilotBlockerHealthInput;
  stopConditions: Array<{ code: string; message: string; severity: "critical" | "high" }>;
  expansionRecommendation:
    | "continue_current_scope"
    | "hold_expansion"
    | "pause_pilot"
    | "insufficient_evidence";
  evaluatedAt: string;
  ruleVersion: string;
};

export type PilotControlExportType =
  | "patient_register"
  | "active_blockers"
  | "programme_summary"
  | "activity_summary";

export type PilotControlExportFormat = "csv" | "json";
