/**
 * Pure helpers for optional `fi_crm_lead_source_ids` mapping (Stage 2G).
 * Used by `createCrmLeadWithPerson` and unit tests.
 */

export type NormalisedLeadSource = {
  source_system: string;
  source_lead_id: string;
};

/**
 * Returns null when both inputs are blank after trim.
 * Throws when only one side is provided (pair required).
 */
export function normaliseOptionalLeadSource(
  sourceSystem: string | undefined | null,
  sourceLeadId: string | undefined | null
): NormalisedLeadSource | null {
  const ss = (sourceSystem ?? "").trim();
  const sl = (sourceLeadId ?? "").trim();
  if (!ss && !sl) return null;
  if (!ss || !sl) {
    throw new Error("Provide both a source system and a source lead id, or leave both blank.");
  }
  return { source_system: ss, source_lead_id: sl };
}

export function leadSourceDuplicateErrorMessage(ref: NormalisedLeadSource, existingLeadId: string): string {
  return `A lead already exists for source “${ref.source_system}” with external id “${ref.source_lead_id}”. Open lead ${existingLeadId} instead of creating a duplicate.`;
}

/** When the unique index fires between pre-check and insert (concurrent writers). */
export function leadSourceInsertRaceErrorMessage(ref: NormalisedLeadSource): string {
  return `Could not attach external id “${ref.source_lead_id}” for “${ref.source_system}” — another lead claimed it while this request was running. The draft lead was removed; open the existing lead or try again.`;
}
