/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — role-sensitive serializers (pure).
 * Never mutate canonical engine results — project copies only.
 */

import type { PilotControlRoleKey } from "../pilotControlContracts";
import { pilotControlRoleHasScope } from "../pilotControlContracts";
import type { PilotBlockerRecord } from "../blockers/blockerTypes";
import {
  projectBlockerForRole,
  type ProjectedPilotBlocker,
} from "../blockers/roleSensitiveBlockerProjection";
import { projectReadinessForRole } from "../readiness/roleSensitiveProjection";
import type { PilotPatientReadiness } from "../readiness/readinessTypes";
import { compareBlockersBySeverityThenAge } from "./pilotControlPagination";
import { canSeePilotPauseRecommendation } from "./pilotControlPermissions";
import { buildPilotSourceLinksWithAliases } from "./pilotControlSourceLinks";
import type {
  PilotBlockerListItem,
  PilotControlActivityItem,
  PilotPatientControlDetail,
  PilotPatientRegisterRow,
  PilotProgrammeSummary,
} from "./pilotControlApiTypes";
import { countEnrolmentsByStatus } from "../pilotEnrolmentCore";
import type { PilotEnrolmentStatus, PilotProgrammeStatus } from "../pilotControlContracts";

export function serializeProgrammeSummary(args: {
  id: string;
  key: string;
  name: string;
  status: string;
  enrolments: readonly { enrolmentStatus: PilotEnrolmentStatus }[];
  lastEvaluatedAt?: string;
}): PilotProgrammeSummary {
  // Evolved controlled pilot: real invites remain disabled until a later authorised phase.
  const realPatientInvitesEnabled =
    args.key === "evolved_controlled_pilot_1a" ? false : false;

  return {
    id: args.id,
    key: args.key,
    name: args.name,
    status: args.status as PilotProgrammeStatus,
    realPatientInvitesEnabled,
    enrolmentCounts: countEnrolmentsByStatus(args.enrolments),
    lastEvaluatedAt: args.lastEvaluatedAt,
  };
}

export function serializeBlockerListItem(
  blocker: PilotBlockerRecord,
  role: PilotControlRoleKey,
  options?: { tenantId?: string }
): PilotBlockerListItem {
  const projected = projectBlockerForRole(blocker, role);
  const canPause = canSeePilotPauseRecommendation(role);

  const item: PilotBlockerListItem = {
    id: projected.fingerprint,
    patientId: projected.patientId,
    enrolmentId: projected.enrolmentId,
    category: projected.category,
    dimension: projected.dimension,
    title: projected.title,
    summary: projected.summary,
    recommendedNextAction: projected.recommendedNextAction,
    severity: projected.severity,
    state: projected.state,
    ownership: {
      ownerType: projected.ownership.ownerType,
      ownerRole: projected.ownership.ownerRole,
      assignmentSource: projected.ownership.assignmentSource,
    },
    escalation: {
      level: projected.escalation.level,
      escalated: projected.escalation.escalated,
      ...(canPause
        ? { requiresPilotPause: projected.escalation.requiresPilotPause }
        : {}),
    },
    firstDetectedAt: projected.firstDetectedAt,
    lastConfirmedAt: projected.lastConfirmedAt,
    ageSeconds: projected.ageSeconds,
    sourceModule: projected.sourceModule,
    patientSafeSummary:
      projected.category === "identity" || projected.criticalIntegrity
        ? undefined
        : projected.patientSafeSummary,
    evaluatedAt: projected.evaluatedAt,
  };

  if (options?.tenantId && pilotControlRoleHasScope(role, "detail_journey")) {
    const links = buildPilotSourceLinksWithAliases({
      tenantId: options.tenantId,
      patientId: projected.patientId,
      role,
    });
    const preferred =
      links.find((l) => l.module === "journey") ??
      links.find((l) => l.module === "patient") ??
      links[0];
    if (preferred) item.sourceLink = preferred;
  }

  return item;
}

export function sortAndSerializeBlockers(
  blockers: readonly PilotBlockerRecord[],
  role: PilotControlRoleKey,
  options?: { tenantId?: string }
): PilotBlockerListItem[] {
  const sorted = [...blockers].sort(compareBlockersBySeverityThenAge);
  return sorted.map((b) => serializeBlockerListItem(b, role, options));
}

/**
 * Activity redaction — no clinical content, message bodies, payment instruments, image URLs.
 */
export function serializeActivityItem(
  raw: {
    id: string;
    eventKind: string;
    patientId?: string | null;
    enrolmentId?: string | null;
    actorType: string;
    actorId?: string | null;
    sourceModule: string;
    createdAt: string;
    correlationId?: string | null;
    payload?: Record<string, unknown> | null;
  },
  role: PilotControlRoleKey
): PilotControlActivityItem {
  const safeSummary = buildSafeActivitySummary(raw.eventKind, raw.sourceModule, role);
  return {
    eventId: raw.id,
    eventType: raw.eventKind,
    patientId: raw.patientId ?? undefined,
    enrolmentId: raw.enrolmentId ?? undefined,
    actorType: raw.actorType,
    actorId: raw.actorId ?? undefined,
    sourceModule: raw.sourceModule,
    occurredAt: raw.createdAt,
    correlationId: raw.correlationId ?? undefined,
    safeSummary,
  };
}

function buildSafeActivitySummary(
  eventKind: string,
  sourceModule: string,
  role: PilotControlRoleKey
): string {
  // Never echo payload content.
  const technical = pilotControlRoleHasScope(role, "detail_technical");
  if (!technical && (eventKind.includes("technical") || sourceModule.includes("notify"))) {
    return "A system event was recorded.";
  }
  return `Pilot control event: ${eventKind.replace(/_/g, " ")}.`;
}

export function projectReadinessCopy(
  readiness: PilotPatientReadiness,
  role: PilotControlRoleKey
): PilotPatientReadiness {
  // Engine projection returns a new object; do not mutate input.
  return projectReadinessForRole(readiness, role);
}

export function projectBlockersCopy(
  blockers: readonly PilotBlockerRecord[],
  role: PilotControlRoleKey
): ProjectedPilotBlocker[] {
  return blockers.map((b) => projectBlockerForRole(b, role));
}

export function serializePatientDetail(args: {
  role: PilotControlRoleKey;
  tenantId: string;
  patientId: string;
  displayName: string;
  reference?: string;
  enrolment: {
    enrolmentId: string;
    status: PilotEnrolmentStatus;
    enrolledAt?: string | null;
    invitedAt?: string | null;
    activatedAt?: string | null;
  };
  readiness: PilotPatientReadiness;
  blockers: readonly PilotBlockerRecord[];
  evaluatedAt: string;
}): PilotPatientControlDetail {
  const role = args.role;
  const readiness = projectReadinessCopy(args.readiness, role);
  const blockers = sortAndSerializeBlockers(args.blockers, role, {
    tenantId: args.tenantId,
  });

  const detail: PilotPatientControlDetail = {
    identity: {
      patientId: args.patientId,
      displayName: args.displayName,
      reference: args.reference,
      // Critical identity issues: internal / technical roles only
      identityIntegrityOk: pilotControlRoleHasScope(role, "detail_technical")
        ? !readiness.identityIntegrityBlocked
        : undefined,
    },
    enrolment: args.enrolment,
    journey: {
      milestone: readiness.journeyStage,
      milestoneLabel: String(readiness.journeyStage).replace(/_/g, " "),
    },
    readiness,
    blockers,
    actions: { patient: [], clinic: [] },
    sourceLinks: buildPilotSourceLinksWithAliases({
      tenantId: args.tenantId,
      patientId: args.patientId,
      role,
    }),
    evaluatedAt: args.evaluatedAt,
  };

  // Role-gated sections — never attach unauthorized clinical/financial detail.
  if (
    pilotControlRoleHasScope(role, "detail_clinical_summary") ||
    pilotControlRoleHasScope(role, "detail_clinical_full")
  ) {
    detail.clinical = {
      state: readiness.clinical.state,
      ...(pilotControlRoleHasScope(role, "detail_clinical_full")
        ? {
            signals: readiness.clinical.mandatorySignals.map((s) => ({
              key: s.key,
              status: s.status,
              label: s.label,
            })),
          }
        : {}),
    };
    if (pilotControlRoleHasScope(role, "detail_clinical_full")) {
      detail.pathology = {
        state:
          readiness.clinical.mandatorySignals.find((s) => s.key.includes("pathology"))?.status ??
          "unknown",
      };
      detail.consent = {
        state:
          readiness.clinical.mandatorySignals.find((s) => s.key.includes("consent"))?.status ??
          "unknown",
      };
    }
  }

  if (
    pilotControlRoleHasScope(role, "detail_financial_summary") ||
    pilotControlRoleHasScope(role, "detail_financial_full")
  ) {
    detail.financial = {
      state: readiness.financial.state,
    };
  }

  if (pilotControlRoleHasScope(role, "detail_documents")) {
    detail.documents = {
      state:
        readiness.operational.mandatorySignals.find((s) => s.key.includes("document"))?.status ??
        "unknown",
    };
  }
  if (pilotControlRoleHasScope(role, "detail_imaging")) {
    detail.images = {
      state:
        readiness.clinical.mandatorySignals.find((s) => s.key.includes("image"))?.status ??
        "unknown",
    };
  }
  if (pilotControlRoleHasScope(role, "detail_communication")) {
    detail.communication = { state: "summary_only" };
  }
  if (pilotControlRoleHasScope(role, "detail_app_activity")) {
    detail.app = {
      invitationState: args.enrolment.invitedAt ? "invited" : "not_invited",
      activationState: args.enrolment.activatedAt ? "activated" : "not_activated",
    };
  }
  if (pilotControlRoleHasScope(role, "detail_technical")) {
    detail.technical = {
      state: readiness.technical.state,
      provenance: readiness.technical.provenance,
    };
  }

  // Reception must not receive pathology / clinical free-text provenance in detail sections
  if (role === "reception") {
    delete detail.pathology;
    delete detail.clinical;
  }
  if (role === "finance") {
    delete detail.pathology;
    delete detail.clinical;
    delete detail.consent;
  }
  if (role === "technical") {
    delete detail.clinical;
    delete detail.financial;
    delete detail.pathology;
    delete detail.consent;
  }

  return detail;
}

/** Register rows never include pathology, amounts, image URLs, message content, or free text. */
export function assertRegisterRowPrivacy(row: PilotPatientRegisterRow): void {
  const json = JSON.stringify(row);
  if (/pathology|message_body|image_url|card_number|payment_token/i.test(json)) {
    throw new Error("register_row_privacy_violation");
  }
}
