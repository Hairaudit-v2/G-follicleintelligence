/**
 * Pure lead/tenant ownership checks for CRM tasks (Stage 2I).
 */

export type TaskLeadTenantRef = {
  tenant_id: string;
  lead_id: string;
};

export function isTaskOwnedByLeadTenant(task: TaskLeadTenantRef, tenantId: string, leadId: string): boolean {
  return task.tenant_id.trim() === tenantId.trim() && task.lead_id.trim() === leadId.trim();
}
