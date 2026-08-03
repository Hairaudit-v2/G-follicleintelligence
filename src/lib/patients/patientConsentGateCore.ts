/**
 * Pure helpers for trial/photo consent gate (testable without Supabase).
 */

export function photographyConsentGateSatisfied(input: {
  photoClinicalSigned: boolean;
  vaultConsentDocumentPresent: boolean;
}): boolean {
  return input.photoClinicalSigned || input.vaultConsentDocumentPresent;
}
