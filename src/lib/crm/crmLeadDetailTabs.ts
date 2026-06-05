export const CRM_LEAD_DETAIL_TABS = [
  "overview",
  "clinical",
  "pipeline",
  "timeline",
  "documents",
  "convert",
] as const;

export type CrmLeadDetailTabId = (typeof CRM_LEAD_DETAIL_TABS)[number];

const TAB_SET = new Set<string>(CRM_LEAD_DETAIL_TABS);

export const CRM_LEAD_DETAIL_TAB_LABELS: Record<CrmLeadDetailTabId, string> = {
  overview: "Overview",
  clinical: "Clinical",
  pipeline: "Pipeline",
  timeline: "Timeline",
  documents: "Documents & notes",
  convert: "Convert",
};

export function parseCrmLeadDetailTab(raw: string | string[] | undefined): CrmLeadDetailTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim().toLowerCase();
  if (t && TAB_SET.has(t)) return t as CrmLeadDetailTabId;
  return "overview";
}
