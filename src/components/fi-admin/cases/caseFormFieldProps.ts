/** Stable id + name pair for case admin form controls (autofill and DevTools audits). */
export function caseFormField(fieldKey: string): { id: string; name: string } {
  const id = fieldKey.startsWith("case-") ? fieldKey : `case-${fieldKey}`;
  return { id, name: id };
}
