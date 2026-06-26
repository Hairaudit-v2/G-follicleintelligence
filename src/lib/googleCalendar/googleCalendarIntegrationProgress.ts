/**
 * CalendarOS — native Google Calendar integration delivery tracker (GC-1…GC-11).
 * Update as phases ship; surfaced on FI Admin Integrations and platform progress.
 */

import type { PlatformProgressModule } from "@/lib/marketing/platformProgressPageContent";

export const GOOGLE_CALENDAR_INTEGRATION_PROGRESS = {
  name: "CalendarOS",
  status: "Operational beta" as const,
  statusLabel: "Operational Beta" as const,
  progressPercent: 90,
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
    "Scheduled background sync monitoring (GC-8)",
    "Google sync conflict review queue (GC-7)",
    "Calendar Settings Centre (GC-11)",
  ],
  remaining: [
    "Outbound calendar routing selection",
    "Patient/staff assignment intelligence from native Google events",
    "Production monitoring dashboard",
  ],
  platformStage: "GC-11 · calendar settings centre",
  platformDescription:
    "Native CalendarOS Google connector — OAuth, outbound FI appointment creation, multi-calendar inbound sync, admin scope manager, sync health monitoring, conflict review queue, Calendar Settings Centre, and focused global CSP allowlist for Google Calendar/Auth.",
  latestMilestone: "GC-11 Calendar Settings Centre deployed",
} as const;

export type GoogleCalendarIntegrationProgress = typeof GOOGLE_CALENDAR_INTEGRATION_PROGRESS;

/** Platform progress registry row — single source for name, %, status, stage, description. */
export function buildGoogleCalendarPlatformProgressModule(): PlatformProgressModule {
  const p = GOOGLE_CALENDAR_INTEGRATION_PROGRESS;
  return {
    id: "calendar-os",
    name: p.name,
    completionPercent: p.progressPercent,
    stage: p.platformStage,
    description: p.platformDescription,
    status: p.status,
    statusLabel: p.statusLabel,
    latestMilestone: p.latestMilestone,
  };
}

/** Changelog / recent-release ids for CalendarOS milestones (keep in sync with platformProgressPageContent). */
export const GOOGLE_CALENDAR_INTEGRATION_CHANGELOG_IDS = {
  gc6b: "2026-06-26-calendar-os-gc6b",
  gcCsp: "2026-06-26-calendar-os-gc-csp",
  gc11: "2026-06-26-calendar-os-gc11",
} as const;

export const GOOGLE_CALENDAR_INTEGRATION_LATEST_RELEASE_DATE = "2026-06-26" as const;
