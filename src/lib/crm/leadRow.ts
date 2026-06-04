import type { FiCrmLeadRow } from "./types";

export function mapFiCrmLeadRow(row: Record<string, unknown>): FiCrmLeadRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    organisation_id: row.organisation_id != null ? String(row.organisation_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    person_id: String(row.person_id),
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    current_stage_id: row.current_stage_id != null ? String(row.current_stage_id) : null,
    primary_owner_user_id: row.primary_owner_user_id != null ? String(row.primary_owner_user_id) : null,
    status: String(row.status),
    priority: row.priority != null ? String(row.priority) : null,
    summary: row.summary != null ? String(row.summary) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
