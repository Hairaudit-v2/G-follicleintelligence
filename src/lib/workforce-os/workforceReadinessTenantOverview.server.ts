import "server-only";

import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { pickStaffHrNotificationFromSourceRows } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import {
  calculateWorkforceReadinessScore,
  type WorkforceReadinessScoreResult,
} from "@/src/lib/workforce-os/workforceReadinessEngine";
import type { WorkforceReadinessBandId } from "@/src/lib/workforce-os/workforceReadinessBands";

export type TenantWorkforceReadinessOverview = {
  totalStaff: number;
  activeStaff: number;
  averageReadinessScore: number;
  fullyReadyCount: number;
  operationalWarningCount: number;
  restrictedCount: number;
  blockedCount: number;
  eliteReadyCount: number;
};

function isFullyReadyBand(band: WorkforceReadinessBandId): boolean {
  return band === "fully_ready" || band === "elite_ready";
}

function isOperationalWarningBand(band: WorkforceReadinessBandId): boolean {
  return band === "operational_warning";
}

function isRestrictedBand(band: WorkforceReadinessBandId): boolean {
  return band === "restricted_assignment";
}

function isBlockedStaff(result: WorkforceReadinessScoreResult): boolean {
  return result.blocking_issues.length > 0 || result.band === "not_eligible";
}

/**
 * Aggregates tenant-wide workforce readiness intelligence for HR OS module home.
 */
export async function buildTenantWorkforceReadinessOverview(
  tenantId: string,
  staff?: FiStaffRow[]
): Promise<TenantWorkforceReadinessOverview> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const now = new Date();

  const allStaff = staff ?? [];
  const totalStaff = allStaff.length;
  const activeStaffList = allStaff.filter((s) => s.is_active);
  const activeStaff = activeStaffList.length;

  if (activeStaff === 0) {
    return {
      totalStaff,
      activeStaff: 0,
      averageReadinessScore: 0,
      fullyReadyCount: 0,
      operationalWarningCount: 0,
      restrictedCount: 0,
      blockedCount: 0,
      eliteReadyCount: 0,
    };
  }

  const staffIds = activeStaffList.map((s) => s.id);
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tid)
    .in("staff_id", staffIds);

  if (error) throw new Error(error.message);

  const rowsByStaff = new Map<
    string,
    Array<{ source_system: string; source_staff_id: string; source_url: string | null; metadata: unknown }>
  >();

  for (const raw of data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_staff_id: string;
      source_url: string | null;
      metadata: unknown;
    };
    const sid = String(r.staff_id);
    const list = rowsByStaff.get(sid) ?? [];
    list.push({
      source_system: String(r.source_system),
      source_staff_id: String(r.source_staff_id),
      source_url: r.source_url,
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? r.metadata
          : null,
    });
    rowsByStaff.set(sid, list);
  }

  let scoreSum = 0;
  let fullyReadyCount = 0;
  let operationalWarningCount = 0;
  let restrictedCount = 0;
  let blockedCount = 0;
  let eliteReadyCount = 0;

  for (const s of activeStaffList) {
    const srcRows = rowsByStaff.get(s.id) ?? [];
    const mappedRows = srcRows.map((row) => ({
      source_system: row.source_system,
      source_staff_id: row.source_staff_id,
      metadata: row.metadata as Record<string, unknown> | null,
    }));

    const hr = pickStaffHrNotificationFromSourceRows(
      srcRows.map((row) => ({
        source_system: row.source_system,
        source_url: row.source_url,
        metadata: row.metadata as Record<string, unknown> | null,
      }))
    );

    const compliance = buildStaffComplianceSummaryFromSourceRows(
      srcRows.map((row) => ({
        source_system: row.source_system,
        metadata: row.metadata as Record<string, unknown> | null,
      })),
      { now }
    );

    const result = calculateWorkforceReadinessScore({
      is_active: s.is_active,
      staff_role: s.staff_role,
      working_hours: s.working_hours,
      hr,
      identityRows: mappedRows,
      compliance,
      now,
    });

    scoreSum += result.score;
    if (result.band === "elite_ready") eliteReadyCount += 1;
    if (isFullyReadyBand(result.band)) fullyReadyCount += 1;
    if (isOperationalWarningBand(result.band)) operationalWarningCount += 1;
    if (isRestrictedBand(result.band)) restrictedCount += 1;
    if (isBlockedStaff(result)) blockedCount += 1;
  }

  return {
    totalStaff,
    activeStaff,
    averageReadinessScore: activeStaff > 0 ? Math.round(scoreSum / activeStaff) : 0,
    fullyReadyCount,
    operationalWarningCount,
    restrictedCount,
    blockedCount,
    eliteReadyCount,
  };
}
