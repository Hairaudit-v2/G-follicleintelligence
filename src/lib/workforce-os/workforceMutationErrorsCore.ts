export const WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE =
  "Your user profile is not linked correctly for workforce changes. Please contact an administrator.";

/** Maps raw Postgres FK violations on workforce actor columns to a user-safe message. */
export function mapWorkforceFkMutationError(raw: string): string | null {
  const message = raw.trim();
  if (!message) return null;

  if (/fi_staff_availability_blocks_created_by_fkey/i.test(message)) {
    return WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE;
  }

  if (/fi_staff_shifts_created_by_fkey/i.test(message)) {
    return WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE;
  }

  if (/created_by_fkey/i.test(message) && /fi_staff/i.test(message)) {
    return WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE;
  }

  return null;
}
