/**
 * "What's new" highlight after major Clinic guide releases.
 * Version is bumped when tours / quick actions / engagement ship together.
 */

export const GUIDED_ASSIST_WHATS_NEW_VERSION = "2026-07-clinical-qa-engagement-v1";

export const GUIDED_ASSIST_WHATS_NEW_ITEMS = [
  {
    title: "Quick actions for clinical days",
    body: "One-tap paths for imaging, consult prep, scales, and follow-ups — operational only.",
  },
  {
    title: "Tours when a screen is empty",
    body: "Short walkthroughs for Pipeline, Front desk, Money, and more when you’re just starting.",
  },
  {
    title: "Gentle progress & streaks",
    body: "See weekly tips explored and a calm day-to-day streak — no pressure, just momentum.",
  },
] as const;

export function shouldShowGuidedAssistWhatsNew(
  seenVersion: string | null | undefined
): boolean {
  const seen = String(seenVersion ?? "").trim();
  if (!seen) return true;
  return seen !== GUIDED_ASSIST_WHATS_NEW_VERSION;
}

export function parseWhatsNewSeenFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = metadata.whats_new_seen_version;
  return v != null ? String(v).trim() || null : null;
}

export function withWhatsNewSeenMetadata(
  metadata: Record<string, unknown> | null | undefined,
  version: string = GUIDED_ASSIST_WHATS_NEW_VERSION
): Record<string, unknown> {
  return {
    ...(metadata && typeof metadata === "object" ? metadata : {}),
    whats_new_seen_version: version,
  };
}
