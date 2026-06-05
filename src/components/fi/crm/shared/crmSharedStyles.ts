import {
  CRM_LEAD_DETAIL_PRIORITY_VALUES,
  CRM_LEAD_DETAIL_STATUS_VALUES,
} from "@/src/lib/crm/crmLeadDetailsPolicy";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";

export const crmLeadCardClass = "rounded border border-gray-200 bg-white p-3 shadow-sm";

export function crmStageLabel(stageId: string | null, stages: FiCrmPipelineStageRow[]): string {
  if (!stageId) return "—";
  return stages.find((s) => s.id === stageId)?.label ?? `${stageId.slice(0, 8)}…`;
}

export function crmStatusSelectOptions(current: string): string[] {
  const s = new Set<string>(CRM_LEAD_DETAIL_STATUS_VALUES);
  const c = current.trim();
  if (c) s.add(c);
  return Array.from(s);
}

export function crmPrioritySelectOptions(current: string | null): string[] {
  const s = new Set<string>(CRM_LEAD_DETAIL_PRIORITY_VALUES);
  const c = (current ?? "").trim();
  if (c) s.add(c);
  return Array.from(s);
}
