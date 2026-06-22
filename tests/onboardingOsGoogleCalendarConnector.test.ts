import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildCalendarSyncPreview,
  calculateCalendarSyncHealth,
  classifyExternalCalendarEventType,
  detectDuplicateExternalEvent,
  normalizeGoogleCalendarEvent,
  resolveCalendarImportStatus,
} from "../src/lib/onboarding-os/googleCalendarConnectorCore";
import {
  EXTERNAL_CALENDAR_EVENT_TYPES,
  EXTERNAL_CALENDAR_IMPORT_AUDIT_ACTIONS,
  EXTERNAL_CALENDAR_IMPORT_STATUSES,
} from "../src/lib/onboarding-os/googleCalendarConnectorTypes";

describe("OnboardingOS Phase F3 — event normalization", () => {
  it("normalizeGoogleCalendarEvent maps Google API shape to staging fields", () => {
    const normalized = normalizeGoogleCalendarEvent(
      {
        id: "evt-123",
        summary: "John Smith - Hair Consultation",
        description: "Initial consult for hair restoration",
        start: { dateTime: "2026-06-22T10:00:00Z" },
        end: { dateTime: "2026-06-22T11:00:00Z" },
        attendees: [{ email: "john@example.com" }, { email: "Clinic@Example.com" }],
      },
      "primary"
    );

    assert.ok(normalized);
    assert.equal(normalized!.googleEventId, "evt-123");
    assert.equal(normalized!.eventTitle, "John Smith - Hair Consultation");
    assert.equal(normalized!.calendarId, "primary");
    assert.equal(normalized!.startAt, new Date("2026-06-22T10:00:00Z").toISOString());
    assert.equal(normalized!.endAt, new Date("2026-06-22T11:00:00Z").toISOString());
    assert.deepEqual(normalized!.attendeeEmails, ["john@example.com", "clinic@example.com"]);
    assert.equal(normalized!.normalizedEventType, "consultation");
  });

  it("normalizeGoogleCalendarEvent returns null without event id", () => {
    const normalized = normalizeGoogleCalendarEvent({ summary: "Untitled" }, "primary");
    assert.equal(normalized, null);
  });
});

describe("OnboardingOS Phase F3 — deterministic classification", () => {
  it("classifyExternalCalendarEventType matches keywords without AI", () => {
    assert.equal(classifyExternalCalendarEventType("FUE Hair Transplant"), "surgery");
    assert.equal(classifyExternalCalendarEventType("PRP Session"), "prp");
    assert.equal(classifyExternalCalendarEventType("Exosomes treatment"), "exosomes");
    assert.equal(classifyExternalCalendarEventType("6 month follow up"), "follow_up");
    assert.equal(classifyExternalCalendarEventType("John Smith - Hair Consultation"), "consultation");
    assert.equal(classifyExternalCalendarEventType("Progress review"), "review");
    assert.equal(classifyExternalCalendarEventType("Team lunch"), "unknown");
  });

  it("every classification result is a supported event type", () => {
    const samples = ["Surgery day", "PRP", "consult", "review", "random"];
    for (const title of samples) {
      const type = classifyExternalCalendarEventType(title);
      assert.ok((EXTERNAL_CALENDAR_EVENT_TYPES as readonly string[]).includes(type));
    }
  });
});

describe("OnboardingOS Phase F3 — duplicate detection", () => {
  it("detectDuplicateExternalEvent matches google_event_id", () => {
    const candidate = normalizeGoogleCalendarEvent(
      { id: "dup-1", summary: "Consult", start: { dateTime: "2026-06-22T10:00:00Z" } },
      "primary"
    )!;

    const isDup = detectDuplicateExternalEvent(candidate, [
      {
        googleEventId: "dup-1",
        eventTitle: "Other title",
        startAt: null,
        importStatus: "staged",
      },
    ]);
    assert.equal(isDup, true);
  });

  it("detectDuplicateExternalEvent matches title and start_at", () => {
    const candidate = normalizeGoogleCalendarEvent(
      { id: "new-id", summary: "Hair Consultation", start: { dateTime: "2026-06-22T10:00:00Z" } },
      "primary"
    )!;

    const isDup = detectDuplicateExternalEvent(candidate, [
      {
        googleEventId: "old-id",
        eventTitle: "Hair Consultation",
        startAt: candidate.startAt,
        importStatus: "staged",
      },
    ]);
    assert.equal(isDup, true);
  });

  it("detectDuplicateExternalEvent ignores rejected rows for title+start match", () => {
    const candidate = normalizeGoogleCalendarEvent(
      { id: "new-id", summary: "Hair Consultation", start: { dateTime: "2026-06-22T10:00:00Z" } },
      "primary"
    )!;

    const isDup = detectDuplicateExternalEvent(candidate, [
      {
        googleEventId: "old-id",
        eventTitle: "Hair Consultation",
        startAt: candidate.startAt,
        importStatus: "rejected",
      },
    ]);
    assert.equal(isDup, false);
  });
});

describe("OnboardingOS Phase F3 — sync preview and status logic", () => {
  it("buildCalendarSyncPreview counts duplicates and events to stage", () => {
    const preview = buildCalendarSyncPreview({
      integrationId: "int-1",
      calendarId: "primary",
      discoveredEvents: [
        { id: "a", summary: "Consult 1", start: { dateTime: "2026-06-22T10:00:00Z" } },
        { id: "b", summary: "Consult 2", start: { dateTime: "2026-06-23T10:00:00Z" } },
      ],
      existingStaging: [
        {
          googleEventId: "a",
          eventTitle: "Consult 1",
          startAt: new Date("2026-06-22T10:00:00Z").toISOString(),
          importStatus: "staged",
        },
      ],
    });

    assert.equal(preview.eventsDiscovered, 2);
    assert.equal(preview.eventsToStage, 1);
    assert.equal(preview.duplicateCount, 1);
    assert.equal(preview.sampleEvents[0]?.googleEventId, "b");
  });

  it("resolveCalendarImportStatus transitions staged events on approve/reject", () => {
    assert.equal(resolveCalendarImportStatus("staged", "approve"), "approved");
    assert.equal(resolveCalendarImportStatus("staged", "reject"), "rejected");
    assert.equal(resolveCalendarImportStatus("approved", "approve"), null);
    assert.equal(resolveCalendarImportStatus("rejected", "reject"), null);
  });

  it("calculateCalendarSyncHealth reflects auth, sync runs, and pending review", () => {
    const health = calculateCalendarSyncHealth({
      latestSyncRun: {
        id: "run-1",
        integrationId: "int-1",
        tenantId: "tenant-1",
        status: "completed",
        eventsDiscovered: 5,
        eventsStaged: 4,
        eventsSkipped: 1,
        healthScore: 0,
        detail: {},
        startedAt: "2026-06-22T09:00:00Z",
        completedAt: "2026-06-22T09:01:00Z",
        createdAt: "2026-06-22T09:00:00Z",
      },
      recentSyncRuns: [],
      stagingEvents: [
        { importStatus: "staged" },
        { importStatus: "staged" },
        { importStatus: "approved" },
      ],
      authVerified: true,
    });

    assert.ok(health.healthScore >= 70);
    assert.equal(health.stagedPendingReview, 2);
    assert.equal(health.approvedCount, 1);
    assert.match(health.summary, /pending human review/i);
  });

  it("calculateCalendarSyncHealth blocks when auth not verified", () => {
    const health = calculateCalendarSyncHealth({
      latestSyncRun: null,
      recentSyncRuns: [],
      stagingEvents: [],
      authVerified: false,
    });

    assert.ok(health.blockers.some((b) => /not verified/i.test(b)));
    assert.equal(health.healthBand, "unknown");
  });
});

describe("OnboardingOS Phase F3 — staging audit shape", () => {
  it("import audit actions cover sync lifecycle and review", () => {
    for (const action of [
      "sync_started",
      "sync_completed",
      "sync_failed",
      "event_staged",
      "event_duplicate",
      "event_approved",
      "event_rejected",
    ]) {
      assert.ok((EXTERNAL_CALENDAR_IMPORT_AUDIT_ACTIONS as readonly string[]).includes(action));
    }
  });

  it("import statuses include staged through imported", () => {
    for (const status of ["staged", "reviewed", "approved", "rejected", "imported"]) {
      assert.ok((EXTERNAL_CALENDAR_IMPORT_STATUSES as readonly string[]).includes(status));
    }
  });
});

describe("OnboardingOS Phase F3 — migration smoke checks", () => {
  it("defines calendar staging tables with tenant-safe RLS and indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120012_onboarding_os_phase_f3_google_calendar_connector.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    assert.match(sql, /create table if not exists public\.fi_external_calendar_event_staging/);
    assert.match(sql, /create table if not exists public\.fi_external_calendar_sync_runs/);
    assert.match(sql, /create table if not exists public\.fi_external_calendar_event_mappings/);
    assert.match(sql, /create table if not exists public\.fi_external_calendar_import_audit/);

    assert.match(sql, /fi_external_calendar_event_staging_select_tenant_member/);
    assert.match(sql, /fi_external_calendar_import_audit_select_tenant_member/);
    assert.match(sql, /grant insert on public\.fi_external_calendar_import_audit to service_role/);

    for (const col of ["tenant_id", "integration_id", "google_event_id", "import_status", "created_at"]) {
      assert.match(sql, new RegExp(col));
    }

    for (const status of ["staged", "reviewed", "approved", "rejected", "imported"]) {
      assert.match(sql, new RegExp(status));
    }

    for (const type of ["consultation", "surgery", "prp", "exosomes", "follow_up", "review", "unknown"]) {
      assert.match(sql, new RegExp(type));
    }

    assert.match(sql, /idx_fi_external_calendar_event_staging_tenant/);
    assert.match(sql, /idx_fi_external_calendar_event_staging_integration/);
    assert.match(sql, /idx_fi_external_calendar_event_staging_google_event_id/);
    assert.match(sql, /idx_fi_external_calendar_event_staging_import_status/);
  });
});
