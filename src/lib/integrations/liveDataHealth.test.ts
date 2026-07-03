import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLiveDataHealthWarnings,
  loadLiveDataHealthSummary,
} from "./liveDataHealth.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-03T12:00:00.000Z");

describe("buildLiveDataHealthWarnings", () => {
  it("warns when Google Calendar is connected but never synced", () => {
    const warnings = buildLiveDataHealthWarnings({
      googleCalendarConnected: true,
      googleCalendarLastSyncAt: null,
      googleCalendarStagedEventCount: 0,
      googleCalendarPromotedAppointmentCount: 0,
      hubSpotConnected: false,
      hubSpotLastSyncAt: null,
      hubSpotStagedContactCount: 0,
      hubSpotStagedDealCount: 0,
      hubSpotPromotedLeadCount: 0,
      hubSpotPromotedOpportunityCount: 0,
      emailIngestionConfigured: false,
      genericEmailConfigured: false,
      genericEmailLastIngestedAt: null,
      genericEmailRecentActivityCount: 0,
      genericEmailUnmatchedCount: 0,
      genericEmailAmbiguousMatchCount: 0,
      now: NOW,
    });
    assert.ok(warnings.some((w) => w.includes("never synced")));
  });

  it("warns when HubSpot staging exists without promoted CRM records", () => {
    const warnings = buildLiveDataHealthWarnings({
      googleCalendarConnected: false,
      googleCalendarLastSyncAt: null,
      googleCalendarStagedEventCount: 0,
      googleCalendarPromotedAppointmentCount: 0,
      hubSpotConnected: true,
      hubSpotLastSyncAt: NOW.toISOString(),
      hubSpotStagedContactCount: 3,
      hubSpotStagedDealCount: 1,
      hubSpotPromotedLeadCount: 0,
      hubSpotPromotedOpportunityCount: 0,
      emailIngestionConfigured: true,
      genericEmailConfigured: false,
      genericEmailLastIngestedAt: null,
      genericEmailRecentActivityCount: 0,
      genericEmailUnmatchedCount: 0,
      genericEmailAmbiguousMatchCount: 0,
      now: NOW,
    });
    assert.ok(warnings.some((w) => w.includes("connector staging")));
  });
});

describe("loadLiveDataHealthSummary", () => {
  it("returns tenant-scoped counts from mocked Supabase", async () => {
    const count = (n: number) => ({ count: n, error: null, data: null });
    const row = (data: Record<string, unknown> | null) => ({ data, error: null, count: null });

    const supabase = {
      from(table: string) {
        const chain = {
          select: () => chain,
          eq: () => chain,
          neq: () => chain,
          not: () => chain,
          in: () => chain,
          gte: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === "fi_calendar_integrations") {
              return row({ last_synced_at: "2026-07-03T10:00:00.000Z", status: "active" });
            }
            if (table === "fi_tenant_external_integrations") {
              return row(null);
            }
            if (table === "fi_external_hubspot_sync_runs") {
              return row({ completed_at: "2026-07-03T09:00:00.000Z" });
            }
            return row(null);
          },
          then(resolve: (v: unknown) => void) {
            const counts: Record<string, number> = {
              fi_external_calendar_event_staging: 2,
              fi_calendar_events: 5,
              fi_external_entity_mappings: 1,
              fi_external_hubspot_contact_staging: 0,
              fi_external_hubspot_deal_staging: 0,
              fi_crm_leads: 4,
              fi_leads: 2,
              fi_external_record_mappings: 1,
              fi_pathology_email_routes: 0,
              fi_generic_clinic_email_routes: 0,
              fi_generic_clinic_email_activities: 0,
              fi_crm_activity_events: 7,
            };
            resolve(count(counts[table] ?? 0));
          },
        };
        return chain;
      },
    };

    const summary = await loadLiveDataHealthSummary(TENANT, {
      supabaseClientForTests: supabase as never,
      now: NOW,
    });

    assert.equal(summary.tenantId, TENANT);
    assert.equal(summary.googleCalendarConnected, true);
    assert.equal(summary.googleCalendarStagedEventCount, 2);
    assert.equal(summary.googleCalendarPromotedAppointmentCount, 6);
    assert.equal(summary.hubSpotPromotedLeadCount, 6);
    assert.equal(summary.recentActivityEventCount, 7);
  });
});
