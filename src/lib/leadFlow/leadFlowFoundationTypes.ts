/**
 * LeadFlowOS Phase LF-1 — database row shapes (LeadFlow-native tables).
 */

import type {
  FiLeadActivityType,
  FiLeadCurrentStage,
  FiLeadExternalEventStatus,
  FiLeadExternalProvider,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";

export type FiExternalEventRow = {
  id: string;
  tenant_id: string;
  provider: FiLeadExternalProvider | string;
  event_type: string;
  external_id: string | null;
  provider_event_id: string | null;
  payload_json: Record<string, unknown>;
  status: FiLeadExternalEventStatus;
  error_message: string | null;
  retry_count: number;
  last_retry_at: string | null;
  processed_at: string | null;
  created_at: string;
};

export type FiLeadRow = {
  id: string;
  tenant_id: string;
  hubspot_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  procedure_interest: string | null;
  country: string | null;
  budget_range: string | null;
  current_stage: FiLeadCurrentStage | string;
  lead_score: number;
  conversion_probability: number;
  priority_band: string | null;
  predicted_procedure: string | null;
  scoring_reasons: string[] | unknown;
  risk_flags: string[] | unknown;
  scored_at: string | null;
  assigned_consultant: string | null;
  created_at: string;
  updated_at: string;
};

export type FiLeadActivityRow = {
  id: string;
  lead_id: string;
  activity_type: FiLeadActivityType | string;
  metadata: Record<string, unknown>;
  created_at: string;
};
