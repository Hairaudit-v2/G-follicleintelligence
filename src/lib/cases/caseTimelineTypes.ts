/**
 * Stage 5E: unified read-only SurgeryOS case timeline (aggregation only; no new write flows).
 */

export type CaseTimelineItemKind =
  | "case_lifecycle"
  | "lead"
  | "booking"
  | "image"
  | "surgery_plan"
  | "procedure_day"
  | "post_op"
  | "follow_up"
  | "crm_activity"
  | "foundation_timeline";

/** High-level filter presets for the case timeline UI. */
export type CaseTimelineFilterPreset = "all" | "clinical" | "crm";

export type CaseTimelineItem = {
  id: string;
  kind: CaseTimelineItemKind;
  /** Origin table or subsystem (e.g. fi_cases, fi_crm_activity_events). */
  source: string;
  title: string;
  description: string | null;
  occurred_at: string;
  status?: string | null;
  href?: string | null;
  metadata_summary?: string | null;
  /** Reserved for rows that may contain PII-heavy CRM payloads. */
  is_sensitive?: boolean;
};

export type CaseTimelineFoundationEventRow = {
  id: string;
  event_kind: string;
  title: string | null;
  occurred_at: string;
  detail: unknown;
};

export type CaseTimelineCrmActivityRow = {
  id: string;
  lead_id: string;
  activity_kind: string;
  title: string | null;
  occurred_at: string;
  detail: Record<string, unknown>;
};

export type CaseTimelineLinkedLeadRow = {
  id: string;
  summary: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  case_id: string | null;
  converted_case_id: string | null;
  converted_at: string | null;
};

export type CaseTimelineExtraSources = {
  foundationTimelineEvents: CaseTimelineFoundationEventRow[];
  crmActivityEvents: CaseTimelineCrmActivityRow[];
  linkedLeads: CaseTimelineLinkedLeadRow[];
};
