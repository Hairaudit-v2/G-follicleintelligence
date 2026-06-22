import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildHubspotSyncPreview,
  calculateHubspotSyncHealth,
  classifyHubspotLeadType,
  detectDuplicateHubspotContact,
  detectHubspotDuplicateLead,
  normalizeHubspotContact,
  normalizeHubspotDeal,
  resolveHubspotImportStatus,
} from "../src/lib/onboarding-os/hubspotConnectorCore";
import {
  HUBSPOT_IMPORT_AUDIT_ACTIONS,
  HUBSPOT_IMPORT_STATUSES,
  HUBSPOT_LEAD_TYPES,
} from "../src/lib/onboarding-os/hubspotConnectorTypes";

describe("OnboardingOS Phase F4 — contact normalization", () => {
  it("normalizeHubspotContact maps HubSpot API shape to staging fields", () => {
    const normalized = normalizeHubspotContact({
      id: "501",
      properties: {
        firstname: "Jane",
        lastname: "Smith",
        email: "jane@example.com",
        phone: "+44 7700 900123",
        hs_lead_status: "NEW",
        lifecyclestage: "lead",
      },
    });

    assert.ok(normalized);
    assert.equal(normalized!.hubspotContactId, "501");
    assert.equal(normalized!.email, "jane@example.com");
    assert.equal(normalized!.phone, "+44 7700 900123");
    assert.equal(normalized!.leadSource, "NEW");
    assert.equal(normalized!.normalizedLeadType, "unknown");
    assert.equal(normalized!.duplicateRisk, false);
  });

  it("normalizeHubspotContact returns null without contact id", () => {
    const normalized = normalizeHubspotContact({ properties: { email: "a@b.com" } });
    assert.equal(normalized, null);
  });

  it("normalizeHubspotContact flags duplicate risk against existing emails", () => {
    const normalized = normalizeHubspotContact(
      { id: "502", properties: { email: "dup@example.com" } },
      { existingEmails: ["dup@example.com"] }
    );
    assert.ok(normalized);
    assert.equal(normalized!.duplicateRisk, true);
  });
});

describe("OnboardingOS Phase F4 — deal normalization", () => {
  it("normalizeHubspotDeal maps HubSpot API shape to staging fields", () => {
    const normalized = normalizeHubspotDeal(
      {
        id: "9001",
        properties: {
          dealname: "FUE Hair Transplant — Jane Smith",
          dealstage: "appointmentscheduled",
          pipeline: "default",
          hs_analytics_source: "ORGANIC_SEARCH",
        },
      },
      { pipelineName: "Sales Pipeline" }
    );

    assert.ok(normalized);
    assert.equal(normalized!.hubspotDealId, "9001");
    assert.equal(normalized!.pipelineName, "Sales Pipeline");
    assert.equal(normalized!.dealStage, "appointmentscheduled");
    assert.equal(normalized!.leadSource, "ORGANIC_SEARCH");
    assert.equal(normalized!.normalizedLeadType, "hair_transplant");
  });

  it("normalizeHubspotDeal returns null without deal id", () => {
    const normalized = normalizeHubspotDeal({ properties: { dealname: "Test" } });
    assert.equal(normalized, null);
  });
});

describe("OnboardingOS Phase F4 — lead classification", () => {
  it("classifyHubspotLeadType matches keywords without AI", () => {
    assert.equal(classifyHubspotLeadType("FUE Hair Transplant"), "hair_transplant");
    assert.equal(classifyHubspotLeadType("Trichology consultation"), "trichology");
    assert.equal(classifyHubspotLeadType("PRP Session"), "prp");
    assert.equal(classifyHubspotLeadType("Exosomes treatment"), "exosomes");
    assert.equal(classifyHubspotLeadType("6 month follow up"), "follow_up");
    assert.equal(classifyHubspotLeadType("Progress review"), "review");
    assert.equal(classifyHubspotLeadType("General enquiry"), "unknown");
  });

  it("every classification result is a supported lead type", () => {
    const samples = ["Hair transplant", "PRP", "trichology", "review", "random"];
    for (const text of samples) {
      const type = classifyHubspotLeadType(text);
      assert.ok((HUBSPOT_LEAD_TYPES as readonly string[]).includes(type));
    }
  });
});

describe("OnboardingOS Phase F4 — duplicate detection", () => {
  it("detectHubspotDuplicateLead matches email", () => {
    assert.equal(
      detectHubspotDuplicateLead({ email: "dup@example.com" }, ["dup@example.com"], []),
      true
    );
  });

  it("detectHubspotDuplicateLead matches phone", () => {
    assert.equal(
      detectHubspotDuplicateLead({ phone: "+44 7700 900123" }, [], ["+44 7700 900123"]),
      true
    );
  });

  it("detectDuplicateHubspotContact matches hubspot_contact_id", () => {
    const candidate = normalizeHubspotContact({
      id: "501",
      properties: { email: "a@b.com" },
    })!;

    const isDup = detectDuplicateHubspotContact(candidate, [
      {
        hubspotContactId: "501",
        email: "other@example.com",
        phone: null,
        importStatus: "staged",
      },
    ]);
    assert.equal(isDup, true);
  });

  it("detectDuplicateHubspotContact ignores rejected rows for email match", () => {
    const candidate = normalizeHubspotContact({
      id: "502",
      properties: { email: "dup@example.com" },
    })!;

    const isDup = detectDuplicateHubspotContact(candidate, [
      {
        hubspotContactId: "500",
        email: "dup@example.com",
        phone: null,
        importStatus: "rejected",
      },
    ]);
    assert.equal(isDup, false);
  });
});

describe("OnboardingOS Phase F4 — sync status logic", () => {
  it("buildHubspotSyncPreview counts duplicates and records to stage", () => {
    const preview = buildHubspotSyncPreview({
      integrationId: "int-1",
      discoveredContacts: [
        { id: "c1", properties: { email: "a@example.com" } },
        { id: "c2", properties: { email: "b@example.com" } },
      ],
      discoveredDeals: [{ id: "d1", properties: { dealname: "PRP deal" } }],
      existingContacts: [
        {
          hubspotContactId: "c1",
          email: "a@example.com",
          phone: null,
          importStatus: "staged",
        },
      ],
      existingDeals: [],
    });

    assert.equal(preview.contactsDiscovered, 2);
    assert.equal(preview.contactsToStage, 1);
    assert.equal(preview.contactDuplicateCount, 1);
    assert.equal(preview.dealsDiscovered, 1);
    assert.equal(preview.dealsToStage, 1);
    assert.equal(preview.sampleContacts[0]?.hubspotContactId, "c2");
  });

  it("resolveHubspotImportStatus transitions staged records on approve/reject", () => {
    assert.equal(resolveHubspotImportStatus("staged", "approve"), "approved");
    assert.equal(resolveHubspotImportStatus("staged", "reject"), "rejected");
    assert.equal(resolveHubspotImportStatus("approved", "approve"), null);
    assert.equal(resolveHubspotImportStatus("rejected", "reject"), null);
  });

  it("calculateHubspotSyncHealth reflects auth, sync runs, and pending review", () => {
    const health = calculateHubspotSyncHealth({
      latestSyncRun: {
        id: "run-1",
        integrationId: "int-1",
        tenantId: "tenant-1",
        status: "completed",
        contactsDiscovered: 10,
        contactsStaged: 8,
        contactsSkipped: 2,
        dealsDiscovered: 5,
        dealsStaged: 4,
        dealsSkipped: 1,
        duplicateRisksDetected: 2,
        healthScore: 0,
        detail: {},
        startedAt: "2026-06-22T09:00:00Z",
        completedAt: "2026-06-22T09:01:00Z",
        createdAt: "2026-06-22T09:00:00Z",
      },
      recentSyncRuns: [],
      stagingContacts: [
        { importStatus: "staged", duplicateRisk: true },
        { importStatus: "staged", duplicateRisk: false },
        { importStatus: "approved", duplicateRisk: false },
      ],
      stagingDeals: [{ importStatus: "staged", duplicateRisk: false }],
      authVerified: true,
    });

    assert.ok(health.healthScore >= 70);
    assert.equal(health.contactsPendingReview, 2);
    assert.equal(health.dealsPendingReview, 1);
    assert.equal(health.duplicateRiskCount, 1);
    assert.match(health.summary, /pending human review/i);
  });

  it("calculateHubspotSyncHealth blocks when auth not verified", () => {
    const health = calculateHubspotSyncHealth({
      latestSyncRun: null,
      recentSyncRuns: [],
      stagingContacts: [],
      stagingDeals: [],
      authVerified: false,
    });

    assert.ok(health.blockers.some((b) => /not verified/i.test(b)));
    assert.equal(health.healthBand, "unknown");
  });
});

describe("OnboardingOS Phase F4 — staging audit shape", () => {
  it("import audit actions cover sync lifecycle and review", () => {
    for (const action of [
      "sync_started",
      "sync_completed",
      "sync_failed",
      "contact_staged",
      "deal_staged",
      "contact_duplicate",
      "deal_duplicate",
      "contact_approved",
      "contact_rejected",
    ]) {
      assert.ok((HUBSPOT_IMPORT_AUDIT_ACTIONS as readonly string[]).includes(action));
    }
  });

  it("import statuses include staged through imported", () => {
    for (const status of ["staged", "reviewed", "approved", "rejected", "imported"]) {
      assert.ok((HUBSPOT_IMPORT_STATUSES as readonly string[]).includes(status));
    }
  });
});

describe("OnboardingOS Phase F4 — migration smoke checks", () => {
  it("defines HubSpot staging tables with tenant-safe RLS and indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120013_onboarding_os_phase_f4_hubspot_connector.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    assert.match(sql, /create table if not exists public\.fi_external_hubspot_contact_staging/);
    assert.match(sql, /create table if not exists public\.fi_external_hubspot_deal_staging/);
    assert.match(sql, /create table if not exists public\.fi_external_hubspot_sync_runs/);
    assert.match(sql, /create table if not exists public\.fi_external_hubspot_import_audit/);
    assert.match(sql, /create table if not exists public\.fi_external_hubspot_pipeline_mappings/);

    assert.match(sql, /fi_external_hubspot_contact_staging_select_tenant_member/);
    assert.match(sql, /fi_external_hubspot_deal_staging_select_tenant_member/);
    assert.match(sql, /fi_external_hubspot_import_audit_select_tenant_member/);
    assert.match(sql, /grant insert on public\.fi_external_hubspot_import_audit to service_role/);

    for (const col of [
      "tenant_id",
      "integration_id",
      "hubspot_contact_id",
      "hubspot_deal_id",
      "email",
      "phone",
      "lead_source",
      "pipeline_name",
      "deal_stage",
      "duplicate_risk",
      "normalized_lead_type",
      "raw_payload",
      "import_status",
      "sync_run_id",
      "created_at",
    ]) {
      assert.match(sql, new RegExp(col));
    }

    for (const status of ["staged", "reviewed", "approved", "rejected", "imported"]) {
      assert.match(sql, new RegExp(status));
    }

    for (const type of ["hair_transplant", "trichology", "prp", "exosomes", "follow_up", "review", "unknown"]) {
      assert.match(sql, new RegExp(type));
    }

    assert.match(sql, /idx_fi_external_hubspot_contact_staging_tenant/);
    assert.match(sql, /idx_fi_external_hubspot_contact_staging_integration/);
    assert.match(sql, /idx_fi_external_hubspot_contact_staging_hubspot_contact_id/);
    assert.match(sql, /idx_fi_external_hubspot_deal_staging_hubspot_deal_id/);
    assert.match(sql, /idx_fi_external_hubspot_deal_staging_integration/);
  });
});
