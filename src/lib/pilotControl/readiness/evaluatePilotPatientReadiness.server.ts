/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — readiness evaluation entry points (server).
 * Read-only. Verifies explicit enrolment first. No invitations, writes, or journey mutations.
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
import { evaluatePilotPatientReadinessFromSources } from "./evaluateFromSources";
import { loadPilotReadinessSourceBag } from "./loadPilotReadinessSources.server";
import type {
  PaginatedPilotReadinessResult,
  PilotPatientReadiness,
} from "./readinessTypes";
import { READINESS_EVALUATION_VERSION } from "./readinessTypes";

export type EvaluatePilotPatientReadinessArgs = {
  tenantId: string;
  programmeId: string;
  patientId: string;
  asOf?: string;
};

export type EvaluatePilotCohortReadinessArgs = {
  tenantId: string;
  programmeId: string;
  filters?: {
    statuses?: PilotEnrolmentRecord["enrolmentStatus"][];
  };
  page?: number;
  pageSize?: number;
};

export type EvaluateReadinessOptions = {
  supabase?: SupabaseClient;
  /** Max parallel patient evaluations for cohort. */
  concurrency?: number;
  realPatientInvitesEnabled?: boolean;
};

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export class PilotReadinessEvaluationError extends Error {
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
    this.name = "PilotReadinessEvaluationError";
  }
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Evaluate readiness for one explicitly enrolled pilot patient.
 * Identity integrity is resolved inside the pure engine before dimension composition.
 */
export async function evaluatePilotPatientReadiness(
  args: EvaluatePilotPatientReadinessArgs,
  options?: EvaluateReadinessOptions
): Promise<PilotPatientReadiness> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const programmeId = assertNonEmptyUuid(args.programmeId, "programmeId");
  const patientId = assertNonEmptyUuid(args.patientId, "patientId");

  const enrolmentResult = await loadPilotEnrolmentForPatient(
    { tenantId: tid, patientId, programmeId },
    { supabase: options?.supabase }
  );

  if (!enrolmentResult.ok) {
    throw new PilotReadinessEvaluationError(
      `Patient is not an explicit pilot member (${enrolmentResult.code})`,
      enrolmentResult.code === "ambiguous_enrolment"
        ? "ambiguous_enrolment"
        : "not_enrolled"
    );
  }

  const enrolment = enrolmentResult.enrolment;
  if (enrolment.tenantId !== tid) {
    throw new PilotReadinessEvaluationError(
      "Enrolment tenant mismatch",
      "tenant_mismatch"
    );
  }
  if (enrolment.programmeId !== programmeId) {
    throw new PilotReadinessEvaluationError(
      "Enrolment programme mismatch",
      "programme_mismatch"
    );
  }

  const bag = await loadPilotReadinessSourceBag(
    { tenantId: tid, enrolment },
    {
      supabase: options?.supabase,
      evaluatedAt: args.asOf,
      realPatientInvitesEnabled: options?.realPatientInvitesEnabled,
    }
  );

  return evaluatePilotPatientReadinessFromSources(bag, {
    realPatientInvitesEnabled: options?.realPatientInvitesEnabled ?? false,
  });
}

/**
 * Paginated cohort readiness. Uses bounded concurrency. Stable sort by patientId.
 * Never returns foreign-tenant enrolments.
 */
export async function evaluatePilotCohortReadiness(
  args: EvaluatePilotCohortReadinessArgs,
  options?: EvaluateReadinessOptions
): Promise<PaginatedPilotReadinessResult> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const programmeId = assertNonEmptyUuid(args.programmeId, "programmeId");
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE));
  const concurrency = Math.max(1, Math.min(8, options?.concurrency ?? DEFAULT_CONCURRENCY));
  const evaluatedAt = new Date().toISOString();

  const enrolments = await loadPilotEnrolmentsForTenant(
    { tenantId: tid, programmeId },
    {
      supabase: options?.supabase,
      statuses: args.filters?.statuses,
      includeHistorical: true,
    }
  );

  const scoped = enrolments
    .filter((e) => e.tenantId === tid && e.programmeId === programmeId)
    .sort((a, b) => a.patientId.localeCompare(b.patientId));

  const total = scoped.length;
  const start = (page - 1) * pageSize;
  const pageRows = scoped.slice(start, start + pageSize);

  const items = await mapPool(pageRows, concurrency, async (enrolment) => {
    const bag = await loadPilotReadinessSourceBag(
      { tenantId: tid, enrolment },
      {
        supabase: options?.supabase,
        evaluatedAt,
        realPatientInvitesEnabled: options?.realPatientInvitesEnabled,
      }
    );
    return evaluatePilotPatientReadinessFromSources(bag, {
      realPatientInvitesEnabled: options?.realPatientInvitesEnabled ?? false,
    });
  });

  return {
    tenantId: tid,
    programmeId,
    page,
    pageSize,
    total,
    items,
    evaluatedAt,
    evaluationVersion: READINESS_EVALUATION_VERSION,
  };
}

/** Resolve programme id for tenant + key (helper for callers). */
export async function resolveProgrammeIdForTenant(
  args: { tenantId: string; programmeKey?: string },
  options?: { supabase?: SupabaseClient }
): Promise<string | null> {
  const programme = await loadPilotProgrammeForTenant(
    {
      tenantId: args.tenantId,
      programmeKey: args.programmeKey ?? EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
    },
    { supabase: options?.supabase }
  );
  return programme?.id ?? null;
}
