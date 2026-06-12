/**
 * Pure display helpers for CRM lead list rows (Stage 2F).
 */

import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";

export function personMetadataDisplayLabel(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || typeof metadata !== "object") return "—";
  return derivePatientIdentityContact({ personMetadata: metadata, patientMetadata: {} }).fullName;
}

export function leadTitleFromRow(summary: string | null | undefined, leadId: string): string {
  const s = summary?.trim();
  if (s) return s;
  return `Lead ${leadId.slice(0, 8)}…`;
}
