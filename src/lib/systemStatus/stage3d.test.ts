import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFeatureInventoryStatuses, SYSTEM_FEATURE_REGISTRY } from "./systemFeatureRegistry";
import {
  aggregateHealthTraffic,
  assembleSystemStatusPayload,
  calculateSystemReadinessScore,
  SYSTEM_STATUS_CORE_TABLES,
} from "./systemStatusSummary";
import type { DatabaseHealthRow, SystemStatusDbSnapshot } from "./systemStatusTypes";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function baseSnapshot(over: Partial<SystemStatusDbSnapshot> = {}): SystemStatusDbSnapshot {
  const allTables = [
    "fi_crm_leads",
    "fi_crm_tasks",
    "fi_crm_lead_notes",
    "fi_crm_lead_communications",
    "fi_bookings",
    "fi_persons",
    "fi_patients",
    "fi_patient_clinical_details",
    "fi_patient_images",
    "fi_cases",
    "fi_users",
    "fi_crm_activity_events",
  ];
  const tablePresence = Object.fromEntries(allTables.map((t) => [t, true])) as Record<string, boolean>;
  const z = (n: number) => n;
  const snap: SystemStatusDbSnapshot = {
    tenantId: TID,
    generatedAtIso: "2026-06-05T12:00:00.000Z",
    tablePresence,
    counts: {
      crmLeads: z(3),
      crmTasks: z(1),
      crmLeadNotes: z(2),
      crmLeadCommunications: z(1),
      convertedLeads: z(1),
      leadsWithPersonId: z(3),
      leadsWithPatientId: z(2),
      leadsWithCaseId: z(0),
      bookingsTotal: z(4),
      bookingsFuture: z(2),
      bookingsCompleted: z(1),
      bookingsCancelled: z(0),
      persons: z(5),
      patients: z(4),
      casesActive: z(2),
      casesCompleted: z(1),
      activityToday: z(0),
      activityLast7d: z(3),
      fiUsersTotal: z(2),
      fiUsersActive: z(2),
      patientImagesTotal: z(0),
      patientImagesActive: z(0),
      patientImagesArchived: z(0),
    },
    supabaseConfigured: true,
    calendarLoadersAvailable: true,
    migrationLatestFilename: "20260610120001_fi_bookings.sql",
    migrationMetadataAvailable: true,
  };
  return { ...snap, ...over };
}

describe("Stage 3D — system status & readiness", () => {
  it("calculateSystemReadinessScore matches weighted formula", () => {
    const rows: DatabaseHealthRow[] = SYSTEM_STATUS_CORE_TABLES.map((table) => ({ table, present: true }));
    const score = calculateSystemReadinessScore({
      databaseHealth: rows,
      summaryStrip: [
        { traffic: "green" },
        { traffic: "green" },
        { traffic: "green" },
        { traffic: "green" },
        { traffic: "green" },
      ],
      calendarReady: true,
    });
    assert.equal(score, 100);
  });

  it("calculateSystemReadinessScore drops when tables missing", () => {
    const rows: DatabaseHealthRow[] = SYSTEM_STATUS_CORE_TABLES.map((table, i) => ({
      table,
      present: i > 0,
    }));
    const score = calculateSystemReadinessScore({
      databaseHealth: rows,
      summaryStrip: [{ traffic: "red" }],
      calendarReady: false,
    });
    assert.ok(score < 70);
  });

  it("assembleSystemStatusPayload marks CRM operational when all CRM tables exist", () => {
    const p = assembleSystemStatusPayload(baseSnapshot());
    assert.equal(p.crm.overallLabel, "Operational");
    assert.equal(p.crm.traffic, "green");
  });

  it("assembleSystemStatusPayload marks CRM missing without leads table", () => {
    const snap = baseSnapshot();
    snap.tablePresence.fi_crm_leads = false;
    const p = assembleSystemStatusPayload(snap);
    assert.equal(p.crm.overallLabel, "Missing");
    assert.equal(p.crm.traffic, "red");
  });

  it("aggregateHealthTraffic reflects table presence", () => {
    assert.equal(
      aggregateHealthTraffic([
        { table: "a", present: true },
        { table: "b", present: true },
      ]),
      "green"
    );
    assert.equal(
      aggregateHealthTraffic([
        { table: "a", present: true },
        { table: "b", present: false },
      ]),
      "amber"
    );
    assert.equal(
      aggregateHealthTraffic([
        { table: "a", present: false },
        { table: "b", present: false },
      ]),
      "red"
    );
  });

  it("feature inventory resolves CRM rows from payload", () => {
    const p = assembleSystemStatusPayload(baseSnapshot());
    const rows = resolveFeatureInventoryStatuses(p);
    assert.ok(rows.length === SYSTEM_FEATURE_REGISTRY.length);
    const leads = rows.find((r) => r.id === "crm.leads");
    assert.equal(leads?.status, "ready");
    const hli = rows.find((r) => r.id === "patients.hli");
    assert.equal(hli?.status, "planned");
    const profile = rows.find((r) => r.id === "patients.profile");
    assert.equal(profile?.status, "ready");
    const clinical = rows.find((r) => r.id === "patients.clinicalDetails");
    assert.equal(clinical?.status, "ready");
    const images = rows.find((r) => r.id === "patients.images");
    assert.equal(images?.status, "ready");
    const surgery = rows.find((r) => r.id === "surgeryos.core");
    assert.equal(surgery?.status, "planned");
  });

  it("migration health unknown when metadata flag false", () => {
    const p = assembleSystemStatusPayload(
      baseSnapshot({ migrationMetadataAvailable: false, migrationLatestFilename: null })
    );
    assert.equal(p.migrationHealth.label, "Unknown");
  });
});
