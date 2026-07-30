/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — enrolment membership rules (pure).
 * Cohort membership is never inferred from unrelated patient activity.
 */

import {
  PILOT_APPROVED_PIPELINE_STATUSES,
  PILOT_ENROLMENT_STATUSES,
  PILOT_OPERATIONAL_ENROLMENT_STATUSES,
  type PilotEnrolmentStatus,
  type PilotOperationalEnrolmentStatus,
} from "./pilotControlContracts";

export type PilotEnrolmentRowLike = {
  tenantId: string;
  patientId: string;
  programmeId: string;
  enrolmentStatus: PilotEnrolmentStatus;
  exclusionReason?: string | null;
  withdrawalReason?: string | null;
};

const OPERATIONAL_SET = new Set<string>(PILOT_OPERATIONAL_ENROLMENT_STATUSES);
const APPROVED_PIPELINE_SET = new Set<string>(PILOT_APPROVED_PIPELINE_STATUSES);
const STATUS_SET = new Set<string>(PILOT_ENROLMENT_STATUSES);

export function isPilotEnrolmentStatus(value: unknown): value is PilotEnrolmentStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

export function isOperationalPilotEnrolmentStatus(
  status: PilotEnrolmentStatus
): status is PilotOperationalEnrolmentStatus {
  return OPERATIONAL_SET.has(status);
}

/** Active operational cohort — excludes candidate, completed, withdrawn, excluded. */
export function isActiveOperationalPilotMember(status: PilotEnrolmentStatus): boolean {
  return isOperationalPilotEnrolmentStatus(status);
}

/** Included in approved-pipeline executive counts (includes completed for historical reporting). */
export function isApprovedPipelinePilotMember(status: PilotEnrolmentStatus): boolean {
  return APPROVED_PIPELINE_SET.has(status);
}

/** Withdrawn + excluded are never in active operational metrics. Completed is historical-only. */
export function includeInActiveOperationalMetrics(status: PilotEnrolmentStatus): boolean {
  return isActiveOperationalPilotMember(status);
}

export function includeInHistoricalPilotReporting(status: PilotEnrolmentStatus): boolean {
  return status === "completed" || isActiveOperationalPilotMember(status) || status === "approved";
}

/**
 * Allowed enrolment status transitions.
 * Fail-closed: unknown from→to returns false.
 */
const ALLOWED_TRANSITIONS: Record<PilotEnrolmentStatus, readonly PilotEnrolmentStatus[]> = {
  candidate: ["approved", "excluded", "withdrawn"],
  approved: ["invited", "paused", "withdrawn", "excluded"],
  invited: ["activated", "active", "paused", "withdrawn", "excluded"],
  activated: ["active", "paused", "completed", "withdrawn"],
  active: ["paused", "completed", "withdrawn"],
  paused: ["active", "invited", "withdrawn", "excluded", "completed"],
  completed: [],
  withdrawn: [],
  excluded: [],
};

export function canTransitionPilotEnrolment(
  from: PilotEnrolmentStatus,
  to: PilotEnrolmentStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type EnrolmentMutationIntent =
  | { type: "approve" }
  | { type: "invite" }
  | { type: "activate" }
  | { type: "mark_active" }
  | { type: "pause" }
  | { type: "complete" }
  | { type: "withdraw"; reason?: string | null }
  | { type: "exclude"; reason: string };

export type EnrolmentMutationResult =
  | {
      ok: true;
      nextStatus: PilotEnrolmentStatus;
      timestampField:
        | "enrolled_at"
        | "invited_at"
        | "activated_at"
        | "paused_at"
        | "completed_at"
        | "withdrawn_at"
        | "excluded_at"
        | null;
      requiresReason: boolean;
    }
  | { ok: false; code: string; message: string };

export function planPilotEnrolmentMutation(
  current: PilotEnrolmentStatus,
  intent: EnrolmentMutationIntent
): EnrolmentMutationResult {
  const map: Record<EnrolmentMutationIntent["type"], PilotEnrolmentStatus> = {
    approve: "approved",
    invite: "invited",
    activate: "activated",
    mark_active: "active",
    pause: "paused",
    complete: "completed",
    withdraw: "withdrawn",
    exclude: "excluded",
  };
  const next = map[intent.type];
  if (!canTransitionPilotEnrolment(current, next)) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Cannot transition pilot enrolment from ${current} to ${next}.`,
    };
  }
  if (intent.type === "exclude") {
    const reason = intent.reason?.trim() ?? "";
    if (!reason) {
      return {
        ok: false,
        code: "exclusion_reason_required",
        message: "Exclusion requires a non-empty exclusion reason.",
      };
    }
  }

  const timestampField =
    intent.type === "approve"
      ? "enrolled_at"
      : intent.type === "invite"
        ? "invited_at"
        : intent.type === "activate"
          ? "activated_at"
          : intent.type === "pause"
            ? "paused_at"
            : intent.type === "complete"
              ? "completed_at"
              : intent.type === "withdraw"
                ? "withdrawn_at"
                : intent.type === "exclude"
                  ? "excluded_at"
                  : null;

  return {
    ok: true,
    nextStatus: next,
    timestampField,
    requiresReason: intent.type === "exclude",
  };
}

/**
 * Tenant-safe membership filter: enrolment must match the requested tenant.
 * Fail-closed on blank/mismatched tenant — never return cross-tenant rows.
 */
export function filterEnrolmentsForTenant<T extends PilotEnrolmentRowLike>(
  rows: readonly T[],
  tenantId: string
): T[] {
  const tid = tenantId.trim();
  if (!tid) return [];
  return rows.filter((r) => r.tenantId === tid);
}

/**
 * Fail-closed: a patient is a pilot member only when an enrolment row exists
 * for the tenant+programme with a recognised status. Activity alone never qualifies.
 */
export function resolvePilotMembership(args: {
  tenantId: string;
  patientId: string;
  programmeId: string;
  enrolments: readonly PilotEnrolmentRowLike[];
}): PilotEnrolmentRowLike | null {
  const tid = args.tenantId.trim();
  const pid = args.patientId.trim();
  const prog = args.programmeId.trim();
  if (!tid || !pid || !prog) return null;

  const matches = args.enrolments.filter(
    (e) => e.tenantId === tid && e.patientId === pid && e.programmeId === prog
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    // Ambiguous membership — fail closed (do not pick first row).
    return null;
  }
  return matches[0] ?? null;
}

export function countEnrolmentsByStatus(
  rows: readonly { enrolmentStatus: PilotEnrolmentStatus }[]
): Record<PilotEnrolmentStatus, number> {
  const counts = Object.fromEntries(PILOT_ENROLMENT_STATUSES.map((s) => [s, 0])) as Record<
    PilotEnrolmentStatus,
    number
  >;
  for (const row of rows) {
    if (isPilotEnrolmentStatus(row.enrolmentStatus)) {
      counts[row.enrolmentStatus] += 1;
    }
  }
  return counts;
}

export function computeActivationRate(args: {
  invited: number;
  activated: number;
  active: number;
}): number | null {
  const invitedPool = args.invited + args.activated + args.active;
  if (invitedPool <= 0) return null;
  return (args.activated + args.active) / invitedPool;
}
