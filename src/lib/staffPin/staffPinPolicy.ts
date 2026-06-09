/** Failed PIN attempts before temporary lockout. */
export const STAFF_PIN_MAX_FAILED_ATTEMPTS = 5;

/** Lockout duration after exceeding failed attempts. */
export const STAFF_PIN_LOCKOUT_MINUTES = 15;

/** Default clinic-floor PIN session lifetime (hours). */
export const STAFF_PIN_SESSION_HOURS = 10;

/** Generic login failure — do not reveal whether staff or PIN was wrong. */
export const STAFF_PIN_LOGIN_FAILURE_MESSAGE = "Invalid credentials. Please try again.";

export type StaffPinPublicStatus = "active" | "not_set" | "locked" | "disabled";

export function nextFailedPinAttemptState(
  currentCount: number,
  now: Date = new Date()
): { failedAttemptCount: number; lockedUntil: string | null; shouldLock: boolean } {
  const nextFailed = currentCount + 1;
  if (nextFailed >= STAFF_PIN_MAX_FAILED_ATTEMPTS) {
    return {
      failedAttemptCount: 0,
      lockedUntil: new Date(now.getTime() + STAFF_PIN_LOCKOUT_MINUTES * 60 * 1000).toISOString(),
      shouldLock: true,
    };
  }
  return { failedAttemptCount: nextFailed, lockedUntil: null, shouldLock: false };
}

export function resolveStaffPinPublicStatus(opts: {
  hasPinRow: boolean;
  isActive: boolean;
  lockedUntil: string | null;
  now?: Date;
}): StaffPinPublicStatus {
  if (!opts.hasPinRow) return "not_set";
  if (!opts.isActive) return "disabled";
  const now = opts.now ?? new Date();
  if (opts.lockedUntil && new Date(opts.lockedUntil).getTime() > now.getTime()) return "locked";
  return "active";
}
