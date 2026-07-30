/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.3 — blocker evaluation entry points (server).
 * Read-only vs clinical/financial/journey SoR. May persist derived fi_pilot_blockers only.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  loadPilotEnrolmentForPatient,
  loadPilotEnrolmentsForTenant,
  loadPilotProgrammeForTenant,
  type PilotEnrolmentRecord,
} from "../pilotCohortQuery.server";
import { EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY } from "../pilotControlContracts";
import { evaluatePilotPatientReadiness } from "../readiness/evaluatePilotPatientReadiness.server";
import { buildPilotBlockerHealthInput, mergeCohortHealthInputs } from "./blockerHealthInput";
import {
  BLOCKER_EVALUATION_VERSION,
  type PaginatedPilotBlockerEvaluation,
  type PilotPatientBlockerEvaluation,
  type PilotPatientBlockerNotEnrolled,
} from "./blockerTypes";
import {
  buildProgrammeContext,
  evaluatePilotPatientBlockersFromReadiness,
  type BlockerStore,
} from "./evaluateFromReadiness";
import {
  loadActivePilotBlockers,
  persistPilotBlockerReconciliation,
} from "./persistPilotBlockers.server";
import { reconcilePilotBlockers } from "./reconcileBlockers";

export class PilotBlockerEvaluationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_enrolled"
      | "ambiguous_enrolment"
      | "programme_mismatch"
      | "tenant_mismatch"
      | "invalid_input"
  ) {
    super(message);
    this.name = "PilotBlockerEvaluationError";
  }
}

export type EvaluatePilotPatientBlockersArgs = {
  tenantId: string;
  programmeId: string;
  patientId: string;
  asOf?: string;
  persistDerivedState?: boolean;
};

export type EvaluatePilotCohortBlockersArgs = {
  tenantId: string;
  programmeId: string;
  filters?: {
    statuses?: PilotEnrolmentRecord["enrolmentStatus"][];
  };
  page?: number;
  pageSize?: number;
  asOf?: string;
  persistDerivedState?: boolean;
};

export type EvaluateBlockersOptions = {
  supabase?: SupabaseClient;
  concurrency?: number;
  store?: BlockerStore;
};

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!, i);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function repeatedFailureCountFromReadiness(
  readiness: PilotPatientBlockerEvaluation["readiness"]
): number {
  const repeated = readiness.technical.mandatorySignals.find(
    (s) => s.key === "technical.repeated_failure"
  );
  if (repeated && (repeated.status === "failed" || repeated.blocking)) return 3;
  const push = readiness.technical.mandatorySignals.find(
    (s) => s.key === "technical.failed_push"
  );
  if (push && (push.status === "failed" || push.blocking)) return 1;
  return 0;
}

/**
 * Evaluate blockers for one enrolled patient.
 * Verifies explicit enrolment, consumes 1A.2 readiness, reconciles derived blockers.
 */
export async function evaluatePilotPatientBlockers(
  args: EvaluatePilotPatientBlockersArgs,
  options?: EvaluateBlockersOptions
): Promise<PilotPatientBlockerEvaluation | PilotPatientBlockerNotEnrolled> {
  const tenantId = assertNonEmptyUuid(args.tenantId, "tenantId");
  const programmeId = assertNonEmptyUuid(args.programmeId, "programmeId");
  const patientId = assertNonEmptyUuid(args.patientId, "patientId");
  const asOf = args.asOf ?? new Date().toISOString();
  const persist = args.persistDerivedState !== false;

  const enrolmentResult = await loadPilotEnrolmentForPatient(
    { tenantId, patientId, programmeId },
    { supabase: options?.supabase }
  );

  if (!enrolmentResult.ok) {
    return {
      tenantId,
      programmeId,
      patientId,
      enrolled: false,
      activeBlockers: [],
      recentlyResolved: [],
      evaluatedAt: asOf,
      evaluationVersion: BLOCKER_EVALUATION_VERSION,
    };
  }

  const enrolment = enrolmentResult.enrolment;
  if (enrolment.tenantId !== tenantId) {
    throw new PilotBlockerEvaluationError("tenant mismatch", "tenant_mismatch");
  }
  if (enrolment.programmeId !== programmeId) {
    throw new PilotBlockerEvaluationError("programme mismatch", "programme_mismatch");
  }

  const programme = await loadPilotProgrammeForTenant(
    { tenantId, programmeKey: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY },
    { supabase: options?.supabase }
  );
  if (!programme || programme.id !== programmeId) {
    // Allow evaluation when programme id matches enrolment even if key lookup differs
    if (!programme) {
      throw new PilotBlockerEvaluationError("programme mismatch", "programme_mismatch");
    }
  }

  const readiness = await evaluatePilotPatientReadiness(
    { tenantId, programmeId, patientId, asOf },
    { supabase: options?.supabase }
  );

  const programmeCtx = buildProgrammeContext({
    programmeId,
    tenantId,
    escalationThresholds: programme?.escalationThresholds ?? {},
    enrolmentStatus: enrolment.enrolmentStatus,
    procedureAt: null,
    operationalOwnerUserId: enrolment.operationalOwnerUserId,
    operationalOwnerRole: enrolment.operationalOwnerRole,
  });

  if (options?.store) {
    return evaluatePilotPatientBlockersFromReadiness({
      readiness,
      programme: programmeCtx,
      asOf,
      store: options.store,
      persistDerivedState: persist,
      pausedAt: enrolment.pausedAt,
      repeatedFailureCount: repeatedFailureCountFromReadiness(readiness),
    });
  }

  const existing = await loadActivePilotBlockers({
    tenantId,
    programmeId,
    enrolmentId: enrolment.id,
    patientId,
    supabase: options?.supabase,
  });

  const reconciled = reconcilePilotBlockers({
    readiness,
    programme: programmeCtx,
    existingActive: existing,
    asOf,
    pausedAt: enrolment.pausedAt,
    repeatedFailureCount: repeatedFailureCountFromReadiness(readiness),
  });

  if (persist) {
    await persistPilotBlockerReconciliation({
      tenantId,
      programmeId,
      enrolmentId: enrolment.id,
      patientId,
      upserts: reconciled.active,
      resolved: reconciled.recentlyResolved,
      supabase: options?.supabase,
    });
  }

  return {
    programmeId,
    enrolmentId: enrolment.id,
    tenantId,
    patientId,
    readiness,
    activeBlockers: reconciled.active,
    recentlyResolved: reconciled.recentlyResolved,
    healthInput: buildPilotBlockerHealthInput(reconciled.active),
    evaluatedAt: asOf,
    evaluationVersion: BLOCKER_EVALUATION_VERSION,
    enrolled: true,
  };
}

export async function evaluatePilotCohortBlockers(
  args: EvaluatePilotCohortBlockersArgs,
  options?: EvaluateBlockersOptions
): Promise<PaginatedPilotBlockerEvaluation> {
  const tenantId = assertNonEmptyUuid(args.tenantId, "tenantId");
  const programmeId = assertNonEmptyUuid(args.programmeId, "programmeId");
  const asOf = args.asOf ?? new Date().toISOString();
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE));
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;

  const programme = await loadPilotProgrammeForTenant(
    { tenantId, programmeKey: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY },
    { supabase: options?.supabase }
  );
  if (!programme || (programme.id !== programmeId && programme.tenantId !== tenantId)) {
    throw new PilotBlockerEvaluationError("programme mismatch", "programme_mismatch");
  }

  const enrolments = await loadPilotEnrolmentsForTenant(
    { tenantId, programmeId },
    {
      supabase: options?.supabase,
      statuses: args.filters?.statuses,
      includeHistorical: true,
    }
  );

  const sorted = enrolments
    .filter((e) => e.tenantId === tenantId && e.programmeId === programmeId)
    .sort((a, b) => a.patientId.localeCompare(b.patientId));
  const total = sorted.length;
  const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

  const items = await mapPool(slice, concurrency, async (enrolment) => {
    const result = await evaluatePilotPatientBlockers(
      {
        tenantId,
        programmeId,
        patientId: enrolment.patientId,
        asOf,
        persistDerivedState: args.persistDerivedState,
      },
      options
    );
    if (!result.enrolled) {
      throw new PilotBlockerEvaluationError(
        "Enrolment vanished during cohort evaluation",
        "not_enrolled"
      );
    }
    return result;
  });

  return {
    tenantId,
    programmeId,
    page,
    pageSize,
    total,
    items,
    cohortHealthInput: mergeCohortHealthInputs(items.map((i) => i.healthInput)),
    evaluatedAt: asOf,
    evaluationVersion: BLOCKER_EVALUATION_VERSION,
  };
}
