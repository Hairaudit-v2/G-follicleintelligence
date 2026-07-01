import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import {
  listRecruitmentCandidates,
  listWorkforceRoleRequirements,
} from "@/src/lib/workforce/recruitmentPipeline.server";
import { RECRUITMENT_PIPELINE_STAGES } from "@/src/lib/workforce/recruitmentPipelineCore";
import { loadShiftCostIntelligence } from "@/src/lib/workforce/shiftCostIntelligence.server";
import type { ShiftCostIntelligenceSnapshot } from "@/src/lib/workforce/shiftCostIntelligenceCore";
import { listActiveStaffForWageProfiles } from "@/src/lib/workforce/wageProfile.server";
import {
  buildAttentionQueue,
  buildCommandCentreKpis,
  buildFinancialIntelligencePanel,
  buildModuleTiles,
  buildProcedureStaffingForecast,
  buildWorkforceHealthRadar,
  type ProcedureStaffingForecastPanel,
  type WorkforceAttentionQueueItem,
  type WorkforceCommandCentreKpis,
  type WorkforceFinancialIntelligencePanel,
  type WorkforceHealthMetric,
  type WorkforceModuleTile,
} from "@/src/lib/workforce/workforceCommandCentreCore";
import { loadWorkforceOperationalMetrics } from "@/src/lib/workforce/workforceOperationalMetrics.server";
import type { WorkforceOperationalMetrics } from "@/src/lib/workforce/workforceOperationalMetrics.server";
import { loadWorkforcePlanningEngine } from "@/src/lib/workforce/workforcePlanningEngine.server";
import type { WorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";
import { loadWorkforceOsDirectoryPage } from "@/src/lib/workforce-os/workforceOsDirectoryLoader.server";

export type WorkforceCommandCentrePageData = {
  canManage: boolean;
  kpis: WorkforceCommandCentreKpis;
  healthRadar: WorkforceHealthMetric[];
  attentionQueue: WorkforceAttentionQueueItem[];
  moduleTiles: WorkforceModuleTile[];
  procedureForecast: ProcedureStaffingForecastPanel;
  financialIntelligence: WorkforceFinancialIntelligencePanel;
  planning: WorkforcePlanningSnapshot | null;
  planningAvailable: boolean;
};

async function safeLoadPlanning(tenantId: string): Promise<WorkforcePlanningSnapshot | null> {
  try {
    return await loadWorkforcePlanningEngine(tenantId);
  } catch {
    return null;
  }
}

async function safeLoadShiftCost(tenantId: string): Promise<ShiftCostIntelligenceSnapshot | null> {
  try {
    return await loadShiftCostIntelligence(tenantId);
  } catch {
    return null;
  }
}

async function safeLoadOperationalMetrics(
  tenantId: string
): Promise<WorkforceOperationalMetrics | null> {
  try {
    return await loadWorkforceOperationalMetrics(tenantId);
  } catch {
    return null;
  }
}

export async function loadWorkforceCommandCentrePage(
  tenantId: string
): Promise<WorkforceCommandCentrePageData | null> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  const [directory, planning, shiftCost, operationalMetrics, candidates, roleRequirements, wageStaff] =
    await Promise.all([
      loadWorkforceOsDirectoryPage(tid).catch(() => null),
      safeLoadPlanning(tid),
      safeLoadShiftCost(tid),
      canManage ? safeLoadOperationalMetrics(tid) : Promise.resolve(null),
      listRecruitmentCandidates(tid).catch(() => []),
      listWorkforceRoleRequirements(tid).catch(() => []),
      listActiveStaffForWageProfiles(tid).catch(() => []),
    ]);

  const totalStaff = directory?.rows.filter((r) => !r.archived_at).length ?? 0;
  const activePipelineStages = new Set<string>(
    RECRUITMENT_PIPELINE_STAGES.filter((s) => s !== "hired" && s !== "withdrawn")
  );
  const activeRecruitmentPipelineCount = candidates.filter(
    (c) => !c.archivedAt && activePipelineStages.has(c.pipelineStage)
  ).length;
  const openRecruitmentCount = roleRequirements.filter((r) => r.isActive).length;
  const missingWageProfileCount = wageStaff.filter((s) => !s.hasWageProfile).length;
  const wageProfileCoveragePercent =
    wageStaff.length > 0
      ? Math.round(
          (wageStaff.filter((s) => s.hasWageProfile).length / wageStaff.length) * 1000
        ) / 10
      : null;

  const composeInput = {
    tenantId: tid,
    totalStaff,
    operationalMetrics,
    planning,
    shiftCost,
    openRecruitmentCount,
    activeRecruitmentPipelineCount,
    missingWageProfileCount,
    wageProfileCoveragePercent,
  };

  return {
    canManage,
    kpis: buildCommandCentreKpis(composeInput),
    healthRadar: buildWorkforceHealthRadar(composeInput),
    attentionQueue: buildAttentionQueue(composeInput),
    moduleTiles: buildModuleTiles(composeInput),
    procedureForecast: buildProcedureStaffingForecast(planning),
    financialIntelligence: buildFinancialIntelligencePanel(planning, shiftCost),
    planning,
    planningAvailable: planning != null,
  };
}