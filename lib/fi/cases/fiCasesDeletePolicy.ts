/**
 * Hard-delete guard for `fi_cases` — importable from tests without `server-only`.
 * @see fiCasesGuard.ts for soft-delete implementation.
 */

/**
 * Call this in place of any `.from("fi_cases").delete()` statement.
 * Throws unconditionally at runtime — the caller must use `softDeleteFiCase()` instead.
 */
export function assertNeverHardDeleteFiCase(context: string): never {
  throw new Error(
    `[fiCasesGuard] Hard delete of fi_cases is not permitted from application code ` +
      `(context: ${context}). ` +
      `Use softDeleteFiCase() to archive the case and preserve the clinical audit trail. ` +
      `See lib/fi/cases/fiCasesGuard.ts for details.`
  );
}
