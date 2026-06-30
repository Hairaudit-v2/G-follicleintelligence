import "server-only";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { buildTenantWorkforceReadinessOverview } from "@/src/lib/workforce-os/workforceReadinessTenantOverview.server";

import {
  getAnalyticsEvents,
  type AnalyticsEventCoreOptions,
  type FiAnalyticsEventRow,
} from "./analyticsEventCore";
import {
  buildAnalyticsExecutiveSnapshot,
  defaultExecutivePeriod,
  type BuildAnalyticsExecutiveSnapshotInput,
} from "./analyticsExecutiveEngine";
import type {
  AnalyticsExecutiveDashboardPayload,
  AnalyticsExecutiveSnapshot,
  AnalyticsModuleCoverageRow,
} from "./analyticsExecutiveTypes";
import type { AnalyticsModuleName } from "./analyticsEventTypes";

export type LoadAnalyticsExecutiveSnapshotInput = {
  tenantId: string;
  clinicId?: string | null;
  periodStart?: string;
  periodEnd?: string;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
};

export type LoadAnalyticsExecutiveDashboardFilters = {
  clinicId?: string | null;
  periodStart?: string;
  periodEnd?: string;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
};

function publicExecutiveLoadNote(key: string, err: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return `${key}: data could not be loaded.`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `${key}: ${msg || "unknown error"}`;
}

async function loadEventsForPeriod(
  tenantId: string,
  clinicId: string | null | undefined,
  occurredAfter: string,
  occurredBefore: string,
  options?: AnalyticsEventCoreOptions
): Promise<FiAnalyticsEventRow[]> {
  return getAnalyticsEvents(
    {
      tenantId,
      clinicId,
      occurredAfter,
      occurredBefore,
      limit: 500,
    },
    options
  );
}

async function loadWorkforceReadinessContext(tenantId: string) {
  try {
    const staff = await loadAllStaffForTenant(tenantId);
    const overview = await buildTenantWorkforceReadinessOverview(tenantId, staff);
    return {
      averageReadinessScore: overview.averageReadinessScore,
      activeStaff: overview.activeStaff,
      blockedCount: overview.blockedCount,
      operationalWarningCount: overview.operationalWarningCount,
      restrictedCount: overview.restrictedCount,
    };
  } catch {
    return null;
  }
}

/**
 * Builds an executive intelligence snapshot from fi_analytics_events and optional module context.
 */
export async function loadAnalyticsExecutiveSnapshot(
  input: LoadAnalyticsExecutiveSnapshotInput,
  options?: AnalyticsEventCoreOptions
): Promise<AnalyticsExecutiveSnapshot> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const defaults = defaultExecutivePeriod();

  const periodStart = input.periodStart?.trim() || defaults.periodStart;
  const periodEnd = input.periodEnd?.trim() || defaults.periodEnd;
  const comparisonPeriodStart =
    input.comparisonPeriodStart?.trim() || defaults.comparisonPeriodStart;
  const comparisonPeriodEnd = input.comparisonPeriodEnd?.trim() || defaults.comparisonPeriodEnd;

  const [currentEvents, comparisonEvents, workforceReadiness] = await Promise.all([
    loadEventsForPeriod(tid, input.clinicId, periodStart, periodEnd, options),
    loadEventsForPeriod(tid, input.clinicId, comparisonPeriodStart, comparisonPeriodEnd, options),
    loadWorkforceReadinessContext(tid),
  ]);

  const buildInput: BuildAnalyticsExecutiveSnapshotInput = {
    tenantId: tid,
    clinicId: input.clinicId,
    periodStart,
    periodEnd,
    comparisonPeriodStart,
    comparisonPeriodEnd,
    currentEvents,
    comparisonEvents,
    workforceReadiness,
  };

  return buildAnalyticsExecutiveSnapshot(buildInput);
}

/**
 * Executive dashboard payload for AnalyticsOS admin UI — aggregate scores only, no raw metadata.
 */
export async function loadAnalyticsExecutiveDashboard(
  tenantId: string,
  filters?: LoadAnalyticsExecutiveDashboardFilters,
  options?: AnalyticsEventCoreOptions
): Promise<AnalyticsExecutiveDashboardPayload> {
  const loadNotes: string[] = [];

  try {
    const snapshot = await loadAnalyticsExecutiveSnapshot(
      {
        tenantId,
        clinicId: filters?.clinicId,
        periodStart: filters?.periodStart,
        periodEnd: filters?.periodEnd,
        comparisonPeriodStart: filters?.comparisonPeriodStart,
        comparisonPeriodEnd: filters?.comparisonPeriodEnd,
      },
      options
    );

    if (snapshot.dataCompletenessScore.limitedSignal) {
      loadNotes.push(
        "Executive scores use limited module coverage — expand AnalyticsOS event publishers for higher confidence."
      );
    }

    return { snapshot, loadNotes };
  } catch (err) {
    loadNotes.push(publicExecutiveLoadNote("executive_snapshot", err));
    const defaults = defaultExecutivePeriod();
    const emptySnapshot = buildAnalyticsExecutiveSnapshot({
      tenantId: tenantId.trim(),
      clinicId: filters?.clinicId,
      periodStart: filters?.periodStart ?? defaults.periodStart,
      periodEnd: filters?.periodEnd ?? defaults.periodEnd,
      comparisonPeriodStart: filters?.comparisonPeriodStart ?? defaults.comparisonPeriodStart,
      comparisonPeriodEnd: filters?.comparisonPeriodEnd ?? defaults.comparisonPeriodEnd,
      currentEvents: [],
      comparisonEvents: [],
      workforceReadiness: null,
    });
    return { snapshot: emptySnapshot, loadNotes };
  }
}

/**
 * Module event coverage for AnalyticsOS pipeline visibility.
 */
export async function loadAnalyticsModuleCoverage(
  tenantId: string,
  period?: { periodStart?: string; periodEnd?: string },
  options?: AnalyticsEventCoreOptions
): Promise<AnalyticsModuleCoverageRow[]> {
  const tid = assertNonEmptyUuid(tenantId.trim(), "tenantId");
  const defaults = defaultExecutivePeriod();
  const periodStart = period?.periodStart?.trim() || defaults.periodStart;
  const periodEnd = period?.periodEnd?.trim() || defaults.periodEnd;

  try {
    const events = await loadEventsForPeriod(tid, null, periodStart, periodEnd, options);
    const snapshot = buildAnalyticsExecutiveSnapshot({
      tenantId: tid,
      clinicId: null,
      periodStart,
      periodEnd,
      currentEvents: events,
      comparisonEvents: [],
    });
    return snapshot.moduleCoverage;
  } catch {
    return buildAnalyticsExecutiveSnapshot({
      tenantId: tid,
      clinicId: null,
      periodStart,
      periodEnd,
      currentEvents: [],
      comparisonEvents: [],
    }).moduleCoverage;
  }
}

export type { AnalyticsModuleName };
