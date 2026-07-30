/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — bounded cohort readiness summary (server).
 * Uses the 1A.2 engine only. Ephemeral aggregation — no competing SoR snapshot table.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  loadPilotEnrolmentsForTenant,
  type PilotEnrolmentRecord,
} from "../pilotCohortQuery.server";
import { PILOT_OPERATIONAL_ENROLMENT_STATUSES } from "../pilotControlContracts";
import { evaluatePilotPatientReadinessFromSources } from "./evaluateFromSources";
import { loadPilotReadinessSourceBag } from "./loadPilotReadinessSources.server";
import {
  classifyPilotEvidenceSource,
  DEFAULT_COHORT_EVALUATION_CONCURRENCY,
  emptyPilotCohortReadinessSummary,
  isLivePilotEvidence,
  isPartialPatientReadiness,
  MAX_COHORT_EVALUATION_CONCURRENCY,
  MAX_COHORT_EVALUATION_SIZE,
  summarizePilotCohortReadiness,
  type CohortPatientEvaluationOutcome,
  type PilotCohortReadinessSummary,
  type PilotEvidenceSourceClass,
} from "./cohortReadinessSummary";

export type EvaluatePilotCohortReadinessSummaryArgs = {
  tenantId: string;
  programmeId: string;
  clinicId?: string;
  asOf?: string;
  filters?: {
    statuses?: PilotEnrolmentRecord["enrolmentStatus"][];
    /** When true, evaluate live evidence class only (default true for operational reporting). */
    liveOnly?: boolean;
  };
};

export type EvaluateCohortSummaryOptions = {
  supabase?: SupabaseClient;
  concurrency?: number;
  maxCohortSize?: number;
  realPatientInvitesEnabled?: boolean;
  /** Injected clock for deterministic tests. */
  nowIso?: string;
};

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

function enrolmentEvidenceClass(e: PilotEnrolmentRecord): PilotEvidenceSourceClass {
  return classifyPilotEvidenceSource({
    pilotCohort: e.pilotCohort,
    notes: e.notes,
  });
}

/**
 * Canonical batch cohort readiness summary.
 * Explicit active programme enrolments only (default operational statuses).
 * Tenant + programme scoped. Bounded concurrency and max cohort size.
 */
export async function evaluatePilotCohortReadinessSummary(
  args: EvaluatePilotCohortReadinessSummaryArgs,
  options?: EvaluateCohortSummaryOptions
): Promise<PilotCohortReadinessSummary> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const programmeId = assertNonEmptyUuid(args.programmeId, "programmeId");
  const evaluatedAt = options?.nowIso ?? args.asOf ?? new Date().toISOString();
  const concurrency = Math.max(
    1,
    Math.min(
      MAX_COHORT_EVALUATION_CONCURRENCY,
      options?.concurrency ?? DEFAULT_COHORT_EVALUATION_CONCURRENCY
    )
  );
  const maxSize = Math.max(
    1,
    Math.min(MAX_COHORT_EVALUATION_SIZE, options?.maxCohortSize ?? MAX_COHORT_EVALUATION_SIZE)
  );

  const statuses =
    args.filters?.statuses ??
    ([...PILOT_OPERATIONAL_ENROLMENT_STATUSES, "completed"] as PilotEnrolmentRecord["enrolmentStatus"][]);

  const enrolments = await loadPilotEnrolmentsForTenant(
    { tenantId: tid, programmeId },
    {
      supabase: options?.supabase,
      statuses,
      includeHistorical: true,
    }
  );

  const scoped = enrolments
    .filter((e) => e.tenantId === tid && e.programmeId === programmeId)
    .sort((a, b) => a.patientId.localeCompare(b.patientId));

  const liveOnly = args.filters?.liveOnly !== false;
  const classified = scoped.map((e) => ({
    enrolment: e,
    evidenceClass: enrolmentEvidenceClass(e),
  }));

  const liveEnrolled = classified.filter((c) => isLivePilotEvidence(c.evidenceClass)).length;
  const syntheticEnrolled = classified.length - liveEnrolled;

  const toEvaluate = liveOnly
    ? classified.filter((c) => isLivePilotEvidence(c.evidenceClass))
    : classified;

  if (toEvaluate.length === 0) {
    const empty = emptyPilotCohortReadinessSummary({
      programmeId,
      tenantId: tid,
      evaluatedAt,
    });
    empty.cohort.totalEnrolled = scoped.length;
    empty.cohort.liveEnrolled = liveEnrolled;
    empty.cohort.syntheticEnrolled = syntheticEnrolled;
    return empty;
  }

  const truncated = toEvaluate.length > maxSize;
  const slice = toEvaluate.slice(0, maxSize);

  const outcomes = await mapPool(slice, concurrency, async (row): Promise<CohortPatientEvaluationOutcome> => {
    try {
      const bag = await loadPilotReadinessSourceBag(
        { tenantId: tid, enrolment: row.enrolment },
        {
          supabase: options?.supabase,
          evaluatedAt,
          realPatientInvitesEnabled: options?.realPatientInvitesEnabled,
        }
      );
      const readiness = evaluatePilotPatientReadinessFromSources(bag, {
        realPatientInvitesEnabled: options?.realPatientInvitesEnabled ?? false,
      });
      return {
        kind: "ok",
        readiness,
        partial: isPartialPatientReadiness(readiness),
        evidenceClass: row.evidenceClass,
      };
    } catch (err) {
      return {
        kind: "failed",
        patientId: row.enrolment.patientId,
        enrolmentId: row.enrolment.id,
        evidenceClass: row.evidenceClass,
        reason: err instanceof Error ? err.message : "evaluation_failed",
      };
    }
  });

  return summarizePilotCohortReadiness({
    programmeId,
    tenantId: tid,
    totalEnrolled: scoped.length,
    liveEnrolled,
    syntheticEnrolled,
    outcomes,
    evaluatedAt,
    truncated,
  });
}

/**
 * Evaluate readiness for a page of enrolments (register). Same engine, page-bounded.
 */
export async function evaluatePilotEnrolmentPageReadiness(
  args: {
    tenantId: string;
    programmeId: string;
    enrolments: readonly PilotEnrolmentRecord[];
    asOf?: string;
  },
  options?: EvaluateCohortSummaryOptions
): Promise<
  Map<
    string,
    | { ok: true; readiness: import("./readinessTypes").PilotPatientReadiness; partial: boolean }
    | { ok: false; reason: string }
  >
> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const programmeId = assertNonEmptyUuid(args.programmeId, "programmeId");
  const evaluatedAt = options?.nowIso ?? args.asOf ?? new Date().toISOString();
  const concurrency = Math.max(
    1,
    Math.min(
      MAX_COHORT_EVALUATION_CONCURRENCY,
      options?.concurrency ?? DEFAULT_COHORT_EVALUATION_CONCURRENCY
    )
  );

  const scoped = args.enrolments.filter(
    (e) => e.tenantId === tid && e.programmeId === programmeId
  );

  const results = await mapPool(scoped, concurrency, async (enrolment) => {
    try {
      const bag = await loadPilotReadinessSourceBag(
        { tenantId: tid, enrolment },
        {
          supabase: options?.supabase,
          evaluatedAt,
          realPatientInvitesEnabled: options?.realPatientInvitesEnabled,
        }
      );
      const readiness = evaluatePilotPatientReadinessFromSources(bag, {
        realPatientInvitesEnabled: options?.realPatientInvitesEnabled ?? false,
      });
      return {
        enrolmentId: enrolment.id,
        result: {
          ok: true as const,
          readiness,
          partial: isPartialPatientReadiness(readiness),
        },
      };
    } catch (err) {
      return {
        enrolmentId: enrolment.id,
        result: {
          ok: false as const,
          reason: err instanceof Error ? err.message : "evaluation_failed",
        },
      };
    }
  });

  const map = new Map<
    string,
    | { ok: true; readiness: import("./readinessTypes").PilotPatientReadiness; partial: boolean }
    | { ok: false; reason: string }
  >();
  for (const row of results) {
    map.set(row.enrolmentId, row.result);
  }
  return map;
}
