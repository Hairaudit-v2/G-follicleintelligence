/**
 * Stage 17: staging-only replay activation allow-list (single event; no production widening).
 */

/** Only event permitted for staging activation replay runs. */
export const STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT = "hairaudit.audit.completed" as const;

const ALLOWED = new Set<string>([STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT]);

export function isStagingActivationEventAllowed(eventName: string | null | undefined): boolean {
  if (!eventName || !eventName.trim()) return false;
  return ALLOWED.has(eventName.trim());
}

/** Frozen list for UI / docs; do not expand without a new governance stage. */
export function getStagingActivationAllowedEvents(): readonly string[] {
  return [STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT];
}
