import assert from "node:assert/strict";
import { test } from "node:test";

import { FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION } from "@follicle/intelligence-core/contracts";

import {
  receiveIiohrCompetencyExport,
  resolveStaffByAcademyProfile,
  resolveStaffByGlobalProfessionalId,
  resolveStaffByIiohrUserId,
} from "./academyCompetencyReceiver.server";
import { buildAcademyCompetencySignalsFromProjections } from "./academyWorkforceSignalAdapter";
import { buildWorkforceIdentityReadinessSignals } from "@/src/lib/workforce-os/workforceIdentityReadinessSignals";
import { calculateWorkforceReadinessScore } from "@/src/lib/workforce-os/workforceReadinessEngine";
import { buildStaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const STAFF_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-06-09T12:00:00.000Z");

type MockRow = Record<string, unknown>;

function createMockSupabase(initial: {
  sourceIds?: MockRow[];
  staff?: MockRow[];
  projections?: MockRow[];
}) {
  const store = {
    sourceIds: [...(initial.sourceIds ?? [])],
    staff: [...(initial.staff ?? [])],
    projections: [...(initial.projections ?? [])],
    importEvents: [] as MockRow[],
  };

  const client = {
    from(table: string) {
      const state: {
        filters: [string, string, unknown][];
        op: string;
        payload?: MockRow;
        limitN?: number;
      } = {
        filters: [],
        op: "select",
      };

      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          state.filters.push(["eq", col, val]);
          return builder;
        },
        ilike: (col: string, val: unknown) => {
          state.filters.push(["ilike", col, val]);
          return builder;
        },
        limit: (n: number) => {
          state.limitN = n;
          return builder;
        },
        order: () => builder,
        maybeSingle: () => exec(true),
        single: () => exec(false),
        insert: (row: MockRow | MockRow[]) => {
          state.op = "insert";
          state.payload = Array.isArray(row) ? row[0]! : row;
          return builder;
        },
        upsert: (row: MockRow) => {
          state.op = "upsert";
          state.payload = row;
          return builder;
        },
        update: (row: MockRow) => {
          state.op = "update";
          state.payload = row;
          return builder;
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return exec(false).then(onFulfilled, onRejected);
        },
      };

      function matchRows(rows: MockRow[]) {
        return rows.filter((row) =>
          state.filters.every(([, col, val]) => {
            if (col === "tenant_id") return row.tenant_id === val;
            if (col === "staff_id") return row.staff_id === val;
            if (col === "source_system") return row.source_system === val;
            if (col === "source_staff_id") return row.source_staff_id === val;
            return true;
          })
        );
      }

      async function exec(maybe: boolean) {
        if (table === "fi_staff_source_ids") {
          if (state.op === "insert" || state.op === "update") {
            const row = { id: crypto.randomUUID(), ...(state.payload as MockRow) };
            store.sourceIds.push(row);
            return { data: row, error: null };
          }
          const rows = matchRows(store.sourceIds);
          const limited = state.limitN ? rows.slice(0, state.limitN) : rows;
          if (maybe) return { data: limited[0] ?? null, error: null };
          return { data: limited, error: null };
        }

        if (table === "fi_staff") {
          const rows = matchRows(store.staff);
          if (maybe) return { data: rows[0] ?? null, error: null };
          return { data: rows, error: null };
        }

        if (table === "fi_staff_competency_projections") {
          if (state.op === "upsert") {
            const incoming = state.payload as MockRow;
            const idx = store.projections.findIndex(
              (r) =>
                r.tenant_id === incoming.tenant_id &&
                r.staff_id === incoming.staff_id &&
                r.competency_key === incoming.competency_key
            );
            const row = {
              id: idx >= 0 ? store.projections[idx]!.id : crypto.randomUUID(),
              created_at: NOW.toISOString(),
              ...incoming,
              updated_at: NOW.toISOString(),
            };
            if (idx >= 0) store.projections[idx] = row;
            else store.projections.push(row);
            return { data: row, error: null };
          }
          return { data: matchRows(store.projections), error: null };
        }

        if (table === "fi_competency_import_events") {
          const row = { id: crypto.randomUUID(), ...(state.payload as MockRow) };
          store.importEvents.push(row);
          return { data: row, error: null };
        }

        return { data: maybe ? null : [], error: null };
      }

      return builder;
    },
    getStore: () => store,
  };

  return client;
}

function validExportPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION,
    exportEventId: "44444444-4444-4444-8444-444444444444",
    tenantId: TENANT_ID,
    exportedAt: NOW.toISOString(),
    academyProfileId: "academy-profile-99",
    competencies: [
      {
        competencyKey: "fue_extraction_level_1",
        competencyStatus: "active",
        readinessBand: "supervised",
        lastVerifiedAt: NOW.toISOString(),
      },
    ],
    ...overrides,
  };
}

test("identity resolution priority prefers global professional id", async () => {
  const client = createMockSupabase({
    sourceIds: [
      {
        id: "link-nexus",
        tenant_id: TENANT_ID,
        staff_id: STAFF_ID,
        source_system: "iiohr_nexus",
        source_staff_id: "gp-priority",
        metadata: {},
      },
      {
        id: "link-academy",
        tenant_id: TENANT_ID,
        staff_id: "other-staff",
        source_system: "iiohr_academy",
        source_staff_id: "academy-profile-99",
        metadata: {},
      },
    ],
  });

  const byGlobal = await resolveStaffByGlobalProfessionalId(
    TENANT_ID,
    "gp-priority",
    client as never
  );
  assert.equal(byGlobal, STAFF_ID);

  const byAcademy = await resolveStaffByAcademyProfile(
    TENANT_ID,
    "academy-profile-99",
    client as never
  );
  assert.equal(byAcademy, "other-staff");
});

test("resolveStaffByIiohrUserId requires single match", async () => {
  const client = createMockSupabase({
    sourceIds: [
      {
        tenant_id: TENANT_ID,
        staff_id: STAFF_ID,
        source_system: "iiohr_hr",
        source_staff_id: "hr-1",
        metadata: { iiohr_user_id: "user-abc" },
      },
    ],
  });

  const found = await resolveStaffByIiohrUserId(TENANT_ID, "user-abc", client as never);
  assert.equal(found, STAFF_ID);
});

test("receiveIiohrCompetencyExport logs unresolved staff without creating projections", async () => {
  const client = createMockSupabase({});
  const result = await receiveIiohrCompetencyExport(validExportPayload(), {
    supabaseClient: client as never,
    skipAnalytics: true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, "unresolved_staff");
  assert.equal(client.getStore().projections.length, 0);
  assert.equal(client.getStore().importEvents.length, 1);
});

test("receiveIiohrCompetencyExport upserts projections and handles duplicate export", async () => {
  const client = createMockSupabase({
    sourceIds: [
      {
        id: "link-academy",
        tenant_id: TENANT_ID,
        staff_id: STAFF_ID,
        source_system: "iiohr_academy",
        source_staff_id: "academy-profile-99",
        metadata: { iiohr_academy_profile_id: "academy-profile-99" },
      },
    ],
  });

  const first = await receiveIiohrCompetencyExport(validExportPayload(), {
    supabaseClient: client as never,
    skipAnalytics: true,
  });
  assert.equal(first.ok, true);

  const second = await receiveIiohrCompetencyExport(
    validExportPayload({
      competencies: [
        {
          competencyKey: "fue_extraction_level_1",
          competencyStatus: "expiring",
          lastVerifiedAt: NOW.toISOString(),
        },
      ],
    }),
    { supabaseClient: client as never, skipAnalytics: true }
  );
  assert.equal(second.ok, true);
  assert.equal(client.getStore().projections.length, 1);
  assert.equal(String(client.getStore().projections[0]!.competency_status), "expiring");
});

test("workforce readiness uses academy projection with legacy fallback", () => {
  const hr = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      metadata: {
        onboarding_status: "complete",
        training_required_count: 0,
        required_documents_missing_count: 0,
        certificates_outstanding_count: 0,
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );

  const identityRows = [
    {
      source_system: "iiohr_hr",
      source_staff_id: "hr-1",
      metadata: { last_synced_at: NOW.toISOString(), competency_source: "iiohr_hr" },
    },
  ];

  const academySignals = buildAcademyCompetencySignalsFromProjections(
    [
      {
        id: "p1",
        tenantId: TENANT_ID,
        staffId: STAFF_ID,
        sourceSystem: "iiohr_academy",
        globalProfessionalId: null,
        iiohrUserId: null,
        academyProfileId: "academy-profile-99",
        competencyKey: "fue_extraction_level_1",
        competencyStatus: "active",
        readinessBand: "advanced",
        certificationLevel: "level_2",
        evidenceCount: 2,
        latestCertificate: "cert-ref-1",
        sourceExportEventId: "evt-1",
        metadata: {},
        expiresAt: null,
        lastVerifiedAt: NOW.toISOString(),
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ],
    NOW
  );

  const identitySignals = buildWorkforceIdentityReadinessSignals(identityRows, NOW, academySignals);
  assert.equal(identitySignals.academyCompetencySignals?.hasProjection, true);

  const withProjection = calculateWorkforceReadinessScore({
    is_active: true,
    staff_role: "consultant",
    working_hours: { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } },
    hr,
    identityRows,
    compliance: buildStaffComplianceSummaryFromSourceRows([], { now: NOW }),
    academyCompetencySignals: academySignals,
    now: NOW,
  });

  const withoutProjection = calculateWorkforceReadinessScore({
    is_active: true,
    staff_role: "consultant",
    working_hours: { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } },
    hr,
    identityRows,
    compliance: buildStaffComplianceSummaryFromSourceRows([], { now: NOW }),
    now: NOW,
  });

  const competencyWith = withProjection.factors.find((f) => f.key === "competency")!.score;
  const competencyWithout = withoutProjection.factors.find((f) => f.key === "competency")!.score;
  assert.ok(competencyWith >= competencyWithout);
});
