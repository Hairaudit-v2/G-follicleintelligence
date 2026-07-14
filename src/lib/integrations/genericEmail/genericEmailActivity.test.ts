import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGenericEmailCrmActivityDetail,
  counterpartyEmailForMatch,
  hashEmailForStorage,
  maskEmailForPreview,
  resolveGenericEmailMatch,
  truncateBodyPreview,
  truncateSubjectPreview,
} from "./genericEmailActivityCore";
import { ingestGenericEmailActivity } from "./genericEmailActivityIngestion.server";
import { buildLiveDataHealthWarnings, loadLiveDataHealthSummary } from "../liveDataHealth.server";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const LEAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-07-03T12:00:00.000Z");

describe("genericEmailActivityCore", () => {
  it("truncates subject and body previews", () => {
    const longSubject = "x".repeat(200);
    assert.equal(truncateSubjectPreview(longSubject)?.endsWith("…"), true);
    const longBody = "y".repeat(300);
    assert.equal(truncateBodyPreview(longBody)?.endsWith("…"), true);
  });

  it("hashes and masks emails consistently", () => {
    const hash = hashEmailForStorage("Test@Clinic.com");
    assert.ok(hash);
    assert.equal(hashEmailForStorage("test@clinic.com"), hash);
    assert.equal(maskEmailForPreview("jane.doe@clinic.com"), "j***@clinic.com");
  });

  it("resolves counterparty email by direction", () => {
    assert.equal(
      counterpartyEmailForMatch("inbound", "lead@clinic.com", ["reception@clinic.com"]),
      "lead@clinic.com"
    );
    assert.equal(
      counterpartyEmailForMatch("outbound", "reception@clinic.com", ["lead@clinic.com"]),
      "lead@clinic.com"
    );
  });

  it("marks ambiguous when multiple persons match", () => {
    const result = resolveGenericEmailMatch({
      counterpartyEmail: "lead@clinic.com",
      personIds: ["p1", "p2"],
      leadIds: [],
      patientIds: [],
      decidedAt: NOW.toISOString(),
    });
    assert.equal(result.matchStatus, "ambiguous");
    assert.equal(result.matchedLeadId, null);
  });

  it("matches a single lead confidently", () => {
    const result = resolveGenericEmailMatch({
      counterpartyEmail: "lead@clinic.com",
      personIds: ["p1"],
      leadIds: [LEAD_A],
      patientIds: [PATIENT_A],
      decidedAt: NOW.toISOString(),
    });
    assert.equal(result.matchStatus, "matched");
    assert.equal(result.matchedLeadId, LEAD_A);
    assert.equal(result.matchConfidence, 1);
  });

  it("builds CRM detail without raw body", () => {
    const detail = buildGenericEmailCrmActivityDetail({
      genericEmailActivityId: "act-1",
      direction: "inbound",
      subjectPreview: "Hello",
      matchConfidence: 1,
      matchReason: "single_lead_email_match",
      externalMessageId: "msg-1",
    });
    assert.equal(detail.subject_preview, "Hello");
    assert.equal("body_preview" in detail, false);
  });
});

describe("ingestGenericEmailActivity", () => {
  function buildIngestMockSupabase(opts?: {
    existingActivityId?: string | null;
    persons?: Array<{ id: string; metadata: Record<string, unknown> }>;
    leadIds?: string[];
    patientIds?: string[];
  }) {
    const rows: Record<string, unknown>[] = [];
    let crmInsertCount = 0;

    const supabase = {
      from(table: string) {
        const filters: Record<string, string> = {};
        const chain = {
          select: () => chain,
          eq: (col: string, val: string) => {
            filters[col] = val;
            return chain;
          },
          in: (col: string, vals: string[]) => {
            filters[`__in_${col}`] = vals.join(",");
            return chain;
          },
          maybeSingle: async () => {
            if (table === "fi_generic_clinic_email_activities" && filters.external_message_id) {
              if (opts?.existingActivityId) {
                return { data: { id: opts.existingActivityId }, error: null };
              }
              const hit = rows.find(
                (r) =>
                  r.tenant_id === filters.tenant_id &&
                  r.source === filters.source &&
                  r.external_message_id === filters.external_message_id
              );
              return { data: hit ? { id: hit.id } : null, error: null };
            }
            return { data: null, error: null };
          },
          insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
            const row = Array.isArray(payload) ? payload[0] : payload;
            return {
              select: () => ({
                single: async () => {
                  if (table === "fi_crm_activity_events") {
                    crmInsertCount += 1;
                    return {
                      data: {
                        ...row,
                        id: "crm-1",
                        created_at: NOW.toISOString(),
                        detail: row.detail ?? {},
                      },
                      error: null,
                    };
                  }
                  const id = `activity-${rows.length + 1}`;
                  const stored = { ...row, id, created_at: NOW.toISOString() };
                  rows.push(stored);
                  return { data: stored, error: null };
                },
              }),
            };
          },
          update: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
          then(resolve: (v: unknown) => void) {
            if (table === "fi_persons") {
              resolve({ data: opts?.persons ?? [], error: null });
              return;
            }
            if (table === "fi_crm_leads") {
              const ids = (opts?.leadIds ?? []).map((id) => ({ id }));
              resolve({ data: ids, error: null });
              return;
            }
            if (table === "fi_patients") {
              const ids = (opts?.patientIds ?? []).map((id) => ({ id }));
              resolve({ data: ids, error: null });
              return;
            }
            resolve({ data: [], error: null });
          },
        };
        return chain;
      },
    };

    return { supabase, getCrmInsertCount: () => crmInsertCount, rows };
  }

  it("is idempotent by tenant + source + external_message_id", async () => {
    const { supabase } = buildIngestMockSupabase();

    const baseInput = {
      tenantId: TENANT_A,
      source: "manual_test",
      externalMessageId: "msg-dup",
      direction: "inbound" as const,
      fromEmail: "unknown@clinic.com",
      toEmails: ["reception@clinic.com"],
      subject: "Test",
    };

    const first = await ingestGenericEmailActivity(baseInput, {
      supabaseClientForTests: supabase as never,
      now: NOW,
      skipRevalidation: true,
    });
    assert.equal(first.ok && !first.duplicate, true);

    const second = await ingestGenericEmailActivity(baseInput, {
      supabaseClientForTests: supabase as never,
      now: NOW,
      skipRevalidation: true,
    });
    assert.equal(second.ok && second.duplicate, true);
  });

  it("projects to CRM when a single lead matches sender email", async () => {
    const { supabase } = buildIngestMockSupabase({
      persons: [
        {
          id: "person-1",
          metadata: { email_normalized: "lead@clinic.com" },
        },
      ],
      leadIds: [LEAD_A],
      patientIds: [PATIENT_A],
    });

    const result = await ingestGenericEmailActivity(
      {
        tenantId: TENANT_A,
        source: "manual_test",
        externalMessageId: "msg-lead-match",
        direction: "inbound",
        fromEmail: "lead@clinic.com",
        toEmails: ["reception@clinic.com"],
        subject: "Question about consultation",
      },
      {
        supabaseClientForTests: supabase as never,
        now: NOW,
        skipRevalidation: true,
      }
    );

    assert.equal(result.ok && !result.duplicate, true);
    if (result.ok && !result.duplicate) {
      assert.equal(result.activity.match_status, "matched");
      assert.equal(result.activity.matched_lead_id, LEAD_A);
      assert.ok(result.crmActivityEventId);
    }
  });

  it("does not auto-link ambiguous matches", async () => {
    const { supabase, getCrmInsertCount } = buildIngestMockSupabase({
      persons: [
        {
          id: "person-1",
          metadata: { email_normalized: "lead@clinic.com" },
        },
      ],
      leadIds: [LEAD_A, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      patientIds: [],
    });

    const result = await ingestGenericEmailActivity(
      {
        tenantId: TENANT_A,
        source: "manual_test",
        externalMessageId: "msg-ambiguous",
        direction: "inbound",
        fromEmail: "lead@clinic.com",
        toEmails: ["reception@clinic.com"],
      },
      {
        supabaseClientForTests: supabase as never,
        now: NOW,
        skipRevalidation: true,
      }
    );

    assert.equal(result.ok && !result.duplicate, true);
    if (result.ok && !result.duplicate) {
      assert.equal(result.activity.match_status, "ambiguous");
      assert.equal(result.crmActivityEventId, null);
    }
    assert.equal(getCrmInsertCount(), 0);
  });
});

describe("buildLiveDataHealthWarnings generic email", () => {
  it("warns when generic email is configured but stale", () => {
    const warnings = buildLiveDataHealthWarnings({
      googleCalendarConnected: false,
      googleCalendarLastSyncAt: null,
      googleCalendarStagedEventCount: 0,
      googleCalendarPromotedAppointmentCount: 0,
      googleCalendarBackfillLastRunAt: null,
      googleCalendarBackfillReviewCount: 0,
      hubSpotConnected: false,
      hubSpotLastSyncAt: null,
      hubSpotStagedContactCount: 0,
      hubSpotStagedDealCount: 0,
      hubSpotPromotedLeadCount: 0,
      hubSpotPromotedOpportunityCount: 0,
      emailIngestionConfigured: false,
      genericEmailConfigured: true,
      genericEmailLastIngestedAt: "2026-06-30T12:00:00.000Z",
      genericEmailRecentActivityCount: 1,
      genericEmailUnmatchedCount: 30,
      genericEmailAmbiguousMatchCount: 2,
      now: NOW,
    });
    assert.ok(warnings.some((w) => w.includes("Generic clinic email last ingested")));
    assert.ok(warnings.some((w) => w.includes("unmatched")));
    assert.ok(warnings.some((w) => w.includes("ambiguous")));
  });
});

describe("loadLiveDataHealthSummary tenant isolation", () => {
  it("scopes generic email counts to tenant id", async () => {
    const count = (n: number) => ({ count: n, error: null, data: null });
    const row = (data: Record<string, unknown> | null) => ({ data, error: null, count: null });
    const tenantFilter: string[] = [];

    const supabase = {
      from(table: string) {
        const chain = {
          select: () => chain,
          eq: (col: string, val: string) => {
            if (col === "tenant_id") tenantFilter.push(val);
            return chain;
          },
          neq: () => chain,
          not: () => chain,
          in: () => chain,
          gte: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === "fi_generic_clinic_email_activities") {
              return row({ created_at: "2026-07-03T11:00:00.000Z" });
            }
            return row(null);
          },
          then(resolve: (v: unknown) => void) {
            const counts: Record<string, number> = {
              fi_external_calendar_event_staging: 0,
              fi_calendar_events: 0,
              fi_external_entity_mappings: 0,
              fi_external_hubspot_contact_staging: 0,
              fi_external_hubspot_deal_staging: 0,
              fi_crm_leads: 0,
              fi_leads: 0,
              fi_external_record_mappings: 0,
              fi_pathology_email_routes: 0,
              fi_generic_clinic_email_routes: 1,
              fi_generic_clinic_email_activities: 5,
              fi_crm_activity_events: 0,
            };
            resolve(count(counts[table] ?? 0));
          },
        };
        return chain;
      },
    };

    const summary = await loadLiveDataHealthSummary(TENANT_A, {
      supabaseClientForTests: supabase as never,
      now: NOW,
    });

    assert.equal(summary.tenantId, TENANT_A);
    assert.ok(tenantFilter.every((t) => t === TENANT_A));
    assert.notEqual(summary.tenantId, TENANT_B);
    assert.equal(summary.genericEmailRecentActivityCount, 5);
  });
});

describe("patient timeline generic email visibility", () => {
  it("omits generic email CRM events when viewer lacks clinical PHI access", async () => {
    const { buildPatientTimeline } =
      await import("@/src/lib/patients/timeline/patientTimelineBuild");
    const href = { tenantId: TENANT_A };
    const bundle = {
      tenantId: TENANT_A,
      foundationPatientId: PATIENT_A,
      patient: {
        id: PATIENT_A,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
        patient_status: "active",
      },
      leads: [],
      cases: [],
      bookings: [],
      activity: [
        {
          id: "crm-email-1",
          occurred_at: NOW.toISOString(),
          activity_kind: "email.clinic.inbound",
          title: "Inbound clinic email",
          lead_id: LEAD_A,
          case_id: null,
          patient_id: PATIENT_A,
          detail: { direction: "inbound", subject_preview: "Follow up" },
        },
      ],
      clinical: null,
      images: [],
      followUpEncounters: [],
      followUpImagingSessions: [],
    };

    const withoutPhi = buildPatientTimeline(bundle, {
      hrefContext: href,
      viewerCanReadClinicalPhi: false,
    });
    assert.equal(
      withoutPhi.items.some((i) => i.id === "crm_activity:crm-email-1"),
      false
    );

    const withPhi = buildPatientTimeline(bundle, {
      hrefContext: href,
      viewerCanReadClinicalPhi: true,
    });
    assert.equal(
      withPhi.items.some((i) => i.id === "crm_activity:crm-email-1"),
      true
    );
  });
});
