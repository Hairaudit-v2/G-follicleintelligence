/**
 * CalendarOS — native Google Calendar integration delivery tracker (GC-1…GC-CSP).
 * Update as phases ship; surfaced on FI Admin Integrations and platform progress.
 */

import type { PlatformProgressModule } from "@/lib/marketing/platformProgressPageContent";

export const GOOGLE_CALENDAR_INTEGRATION_PROGRESS = {
  name: "Google Calendar Integration",
  status: "Operational beta" as const,
  progressPercent: 82,
  completed: [
    "Outbound FI appointment creation to Google",
    "Inbound multi-calendar sync",
    "OAuth calendarList scope seeding",
    "Admin calendar scope manager",
    "Manual refresh calendars",
    "Manual run sync now",
    "Per-calendar sync diagnostics",
    "Tenant-safe admin permissions",
    "Google Calendar CSP compatibility (GC-CSP)",
  ],
  remaining: [
    "Outbound calendar routing selection",
    "Conflict/duplicate review UI",
    "Timed background sync scheduling",
    "Patient/staff assignment intelligence from native Google events",
    "Production monitoring dashboard",
  ],
  platformStage: "CalendarOS GC-6B · inbound scope admin",
  platformDescription:
    "Native CalendarOS Google connector — OAuth, outbound FI appointment creation, multi-calendar inbound sync, admin scope manager, manual refresh and sync-now, per-calendar diagnostics, tenant-safe admin permissions, and focused global CSP allowlist for Google Calendar/Auth without broad loosening. Outbound calendar routing, conflict review UI, scheduled background sync, assignment intelligence, and production monitoring remain.",
} as const;

export type GoogleCalendarIntegrationProgress = typeof GOOGLE_CALENDAR_INTEGRATION_PROGRESS;

/** Platform progress registry row — single source for name, %, status, stage, description. */
export function buildGoogleCalendarPlatformProgressModule(): PlatformProgressModule {
  const p = GOOGLE_CALENDAR_INTEGRATION_PROGRESS;
  return {
    id: "google-calendar-integration",
    name: p.name,
    completionPercent: p.progressPercent,
    stage: p.platformStage,
    description: p.platformDescription,
    status: p.status,
  };
}

/** Changelog / recent-release ids for CalendarOS milestones (keep in sync with platformProgressPageContent). */
export const GOOGLE_CALENDAR_INTEGRATION_CHANGELOG_IDS = {
  gc6b: "2026-06-26-calendar-os-gc6b",
  gcCsp: "2026-06-26-calendar-os-gc-csp",
} as const;

export const GOOGLE_CALENDAR_INTEGRATION_LATEST_RELEASE_DATE = "2026-06-26" as const;
