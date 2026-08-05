/**
 * Adapter: Team Command Centre composition → existing WorkforceCommandCentrePageData.
 * Preserves client contract (KPIs, health, tiles, legacy attention shape).
 */

import {
  buildAttentionQueue,
  buildCommandCentreKpis,
  buildFinancialIntelligencePanel,
  buildModuleTiles,
  buildProcedureStaffingForecast,
  buildWorkforceHealthRadar,
  type WorkforceAttentionQueueItem,
  type WorkforceCommandCentreKpis,
  type WorkforceFinancialIntelligencePanel,
  type WorkforceHealthMetric,
  type WorkforceModuleTile,
  type ProcedureStaffingForecastPanel,
  type WorkforceOperationalMetricsInput,
} from "@/src/lib/workforce/workforceCommandCentreCore";
import type {
  TeamAttentionQueueItem,
  TeamCommandCentreKpis,
  TeamCommandCentreModel,
} from "@/src/lib/team/commandCentre/types";
import type { ShiftCostIntelligenceSnapshot } from "@/src/lib/workforce/shiftCostIntelligenceCore";
import type { WorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";
import type { SurgicalWorkforceIntelligencePanel } from "@/src/lib/workforce/surgicalWorkforceIntelligenceCore";
import type { WorkforceIntelligencePanel } from "@/src/lib/workforce/workforceIntelligenceEngineCore";

/** Page DTO shape consumed by WorkforceCommandCentreClient — kept stable in B1.7. */
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
  intelligence: WorkforceIntelligencePanel;
  surgicalIntelligence: SurgicalWorkforceIntelligencePanel;
  /** Optional composition snapshot for diagnostics — client ignores unknown fields. */
  teamComposition?: TeamCommandCentreModel;
};

const SEVERITY_TO_LEGACY: Record<
  TeamAttentionQueueItem["severity"],
  WorkforceAttentionQueueItem["severity"]
> = {
  blocking: "critical",
  warning: "high",
  info: "medium",
};

const SEVERITY_SCORE: Record<WorkforceAttentionQueueItem["severity"], number> = {
  critical: 1000,
  high: 750,
  medium: 500,
  low: 250,
};

/**
 * Map person-level Team attention items into the legacy queue DTO the client expects.
 */
export function mapTeamAttentionToLegacyQueue(
  items: readonly TeamAttentionQueueItem[],
  tenantId: string
): WorkforceAttentionQueueItem[] {
  const base = `/fi-admin/${tenantId.trim()}/team`;
  return items.map((item, index) => ({
    id: `person:${item.personKey}:${item.source}:${item.reasonCode}:${index}`,
    severity: SEVERITY_TO_LEGACY[item.severity],
    title: `${item.displayName}: ${item.label}`,
    explanation: `${item.source} · ${item.reasonCode}`,
    recommendedAction: item.actionAllowed ? "Open corrective action" : "Review identity integrity",
    href: item.href ?? base,
    score:
      SEVERITY_SCORE[SEVERITY_TO_LEGACY[item.severity]] +
      (item.actionAllowed ? 10 : 0),
  }));
}

/**
 * Prefer composed totalStaff when available; remaining KPI fields stay behaviour-neutral
 * via existing operational/planning inputs.
 */
export function mergeCommandCentreKpis(input: {
  composed: TeamCommandCentreKpis;
  legacy: WorkforceCommandCentreKpis;
}): WorkforceCommandCentreKpis {
  return {
    ...input.legacy,
    totalStaff: input.composed.totalStaff,
    credentialRisks:
      input.legacy.credentialRisks > 0
        ? input.legacy.credentialRisks
        : input.composed.credentialIssues,
  };
}

export type AdaptTeamCommandCentreInput = {
  team: TeamCommandCentreModel;
  canManage: boolean;
  operationalMetrics: WorkforceOperationalMetricsInput | null;
  planning: WorkforcePlanningSnapshot | null;
  shiftCost: ShiftCostIntelligenceSnapshot | null;
  openRecruitmentCount: number;
  activeRecruitmentPipelineCount: number;
  missingWageProfileCount: number;
  wageProfileCoveragePercent: number | null;
  intelligence: WorkforceIntelligencePanel;
  surgicalIntelligence: SurgicalWorkforceIntelligencePanel;
};

/**
 * Build the page DTO the existing WorkforceCommandCentreClient consumes.
 */
export function adaptTeamCommandCentreToPageData(
  input: AdaptTeamCommandCentreInput
): WorkforceCommandCentrePageData {
  const tid = input.team.tenantId;
  const composeInput = {
    tenantId: tid,
    totalStaff: input.team.kpis.totalStaff,
    operationalMetrics: input.operationalMetrics,
    planning: input.planning,
    shiftCost: input.shiftCost,
    openRecruitmentCount: input.openRecruitmentCount,
    activeRecruitmentPipelineCount: input.activeRecruitmentPipelineCount,
    missingWageProfileCount: input.missingWageProfileCount,
    wageProfileCoveragePercent: input.wageProfileCoveragePercent,
  };

  const legacyKpis = buildCommandCentreKpis(composeInput);
  const personAttention = mapTeamAttentionToLegacyQueue(input.team.attentionQueue, tid);
  const planningAndOpsAttention = buildAttentionQueue(composeInput);

  const attentionQueue = [...personAttention, ...planningAndOpsAttention]
    .sort((a, b) => b.score - a.score)
    .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
    .slice(0, 12);

  return {
    canManage: input.canManage,
    kpis: mergeCommandCentreKpis({ composed: input.team.kpis, legacy: legacyKpis }),
    healthRadar: buildWorkforceHealthRadar(composeInput),
    attentionQueue,
    moduleTiles: buildModuleTiles(composeInput),
    procedureForecast: buildProcedureStaffingForecast(input.planning),
    financialIntelligence: buildFinancialIntelligencePanel(input.planning, input.shiftCost),
    planning: input.planning,
    planningAvailable: input.planning != null,
    intelligence: input.intelligence,
    surgicalIntelligence: input.surgicalIntelligence,
    teamComposition: input.team,
  };
}
