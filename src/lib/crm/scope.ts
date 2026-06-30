/**
 * Pure helpers for matching pipeline stage scope to tenant/org/clinic columns.
 */

export type OrgClinicScopeColumns = {
  organisation_id: string | null;
  clinic_id: string | null;
};

export function normaliseOrgClinicScope(params: {
  organisationId?: string | null;
  clinicId?: string | null;
}): { organisationId: string | null; clinicId: string | null } {
  return {
    organisationId: params.organisationId?.trim() || null,
    clinicId: params.clinicId?.trim() || null,
  };
}

/** True when stage row belongs to the same org/clinic scope as the lead (IS NOT DISTINCT FROM). */
export function stageRowMatchesOrgClinicScope(
  stage: OrgClinicScopeColumns,
  scope: { organisationId: string | null; clinicId: string | null }
): boolean {
  return (
    (stage.organisation_id ?? null) === scope.organisationId &&
    (stage.clinic_id ?? null) === scope.clinicId
  );
}
