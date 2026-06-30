import type { FiCrmLeadRow } from "./types";

/** Source system for idempotent patient/case resolution from a CRM lead. */
export const CRM_LEAD_CONVERSION_SOURCE_SYSTEM = "fi_crm_lead" as const;

export const CRM_LEAD_CONVERSION_MAX_NOTE = 2000;

export type CrmLeadConversionMode = "patient_linked" | "patient_created";

export function assertLeadNotYetConverted(lead: Pick<FiCrmLeadRow, "converted_at">): void {
  if (lead.converted_at != null && String(lead.converted_at).trim() !== "") {
    throw new Error(
      "This lead has already been converted. Contact an administrator to relink if needed."
    );
  }
}

export function assertCaseSeedAllowed(seedCase: boolean, patientId: string | null): void {
  if (!seedCase) return;
  if (!patientId?.trim()) {
    throw new Error("Case seed requires a resolved patient record.");
  }
}

export function assertConversionNoteBounded(note: string | null | undefined): string | null {
  if (note === undefined || note === null) return null;
  const t = String(note).trim();
  if (t.length > CRM_LEAD_CONVERSION_MAX_NOTE) {
    throw new Error(`conversion_note must be at most ${CRM_LEAD_CONVERSION_MAX_NOTE} characters.`);
  }
  return t.length === 0 ? null : t;
}

export function isLeadConversionRowForTenant(
  row: Pick<FiCrmLeadRow, "tenant_id" | "id">,
  tenantId: string,
  leadId: string
): boolean {
  return row.tenant_id === tenantId.trim() && row.id === leadId.trim();
}
