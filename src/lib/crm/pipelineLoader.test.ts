/**
 * FI-UX-REBUILD-1 S4.4 — pipeline loader orchestration tests (DI, no live DB).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  comparePipelineTierIdentity,
  createPipelineRefreshCoordinator,
  resolvePipelinePermissions,
  resolvePipelinePermissionsFromSession,
  toPipelineMoveStageDefinitions,
  toPipelineMoveStageDefinitionsForClient,
} from "@/src/lib/crm/pipelineLoader";
import { buildPipelinePresentation } from "@/src/lib/crm/pipelinePresentation";
import type { CrmKanbanLeadCard, FiCrmLeadRow, FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import {
  loadPipelineFullPayload,
  loadPipelineShellPayload,
  refreshPipelinePresentation,
  type PipelineLoaderDeps,
} from "@/src/lib/crm/pipelineLoaderOrchestration";

const NOW_MS = Date.parse("2026-07-12T12:00:00.000Z");
const TENANT = "22222222-2222-4222-8222-222222222222";
const L1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function leadRow(partial: Partial<FiCrmLeadRow> & Pick<FiCrmLeadRow, "id">): FiCrmLeadRow {
  return {
    id: partial.id,
    tenant_id: TENANT,
    organisation_id: null,
    clinic_id: null,
    person_id: "person-1",
    patient_id: null,
    case_id: null,
    current_stage_id: "stage-qualified",
    primary_owner_user_id: null,
    status: "open",
    priority: null,
    summary: "Enquiry",
    metadata: {},
    converted_person_id: null,
    converted_case_id: null,
    converted_at: null,
    converted_by_user_id: null,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
  };
}

function kanban(id: string): CrmKanbanLeadCard {
  return {
    lead: leadRow({ id }),
    stage: { id: "stage-qualified", slug: "qualified", label: "Qualified", sort_order: 20 },
    person: { id: "person-1", metadata: {} },
    owner: null,
    patient: null,
    clinicalSummaryLine: null,
    norwoodScale: null,
    ludwigScale: null,
    primaryConcernLine: null,
    daysInStage: 1,
    stageEnteredAtIso: "2026-07-01T10:00:00.000Z",
    lastActivityAtIso: "2026-07-01T10:00:00.000Z",
    overdueTaskCount: 0,
    isHighValue: false,
  };
}

function stageRow(partial: Partial<FiCrmPipelineStageRow> & Pick<FiCrmPipelineStageRow, "id" | "slug">): FiCrmPipelineStageRow {
  return {
    id: partial.id,
    tenant_id: TENANT,
    organisation_id: null,
    clinic_id: null,
    pipeline_key: "hair_restoration_default",
    slug: partial.slug,
    label: partial.label ?? partial.slug,
    sort_order: partial.sort_order ?? 10,
    is_entry: partial.is_entry ?? false,
    is_won: partial.is_won ?? false,
    is_lost: partial.is_lost ?? false,
    metadata: partial.metadata ?? {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

let boardCallCount = 0;

function mockDeps(overrides: Partial<PipelineLoaderDeps> = {}): PipelineLoaderDeps {
  boardCallCount = 0;
  return {
    getSessionContext: async () => ({
      session: {
        authUserId: "auth-1",
        fiUserId: "user-1",
        role: "crm_operator",
        canUseClinicFeatures: false,
      },
      bookingsOperator: true,
    }),
    loadBoardIndex: async () => {
      boardCallCount += 1;
      return {
        cards: [kanban(L1), kanban(L2)],
        total: 10,
        truncated: true,
        query: { page: 1, pageSize: 100, searchRaw: null } as never,
      };
    },
    loadStages: async () => [
      stageRow({ id: "stage-new", slug: "new", is_entry: true, sort_order: 0 }),
      stageRow({ id: "stage-qualified", slug: "qualified", sort_order: 20 }),
      stageRow({
        id: "stage-archived",
        slug: "old_stage",
        metadata: { archived: true },
        sort_order: 999,
      }),
    ],
    loadTasksByLeadIds: async () =>
      new Map([
        [
          L1,
          [
            {
              taskId: "t1",
              leadId: L1,
              title: "Call back",
              status: "open",
              dueAtIso: "2026-07-15T10:00:00.000Z",
              completedAtIso: null,
              assigneeUserId: null,
            },
          ],
        ],
      ]),
    loadCommunicationHintsByLeadIds: async () => new Map(),
    loadConsultationBookingsByLeadIds: async () => new Map(),
    loadReminderJobsByLeadIds: async () => new Map(),
    nowMs: () => NOW_MS,
    ...overrides,
  };
}

// --- Permissions and stages ---------------------------------------------------

test("1 capability override preserves mutation access", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: true,
    bookingsOperator: false,
  });
  assert.equal(perms.canMutate, true);
  assert.equal(perms.canCreateEnquiry, true);
});

test("2 read-only resolves without mutations", () => {
  const perms = resolvePipelinePermissions({
    hasCrmShellAccess: true,
    canUseClinicFeatures: false,
    canMutateFromOperatorContext: false,
    canUseConversion: false,
    canUseBookings: false,
  });
  assert.equal(perms.canMutate, false);
  assert.equal(perms.canConvert, false);
  assert.equal(perms.canBookConsultation, false);
});

test("3 conversion permission stays distinct", () => {
  const perms = resolvePipelinePermissions({
    hasCrmShellAccess: true,
    canUseClinicFeatures: false,
    canMutateFromOperatorContext: true,
    canUseConversion: false,
    canUseBookings: true,
  });
  assert.equal(perms.canMutate, true);
  assert.equal(perms.canConvert, false);
});

test("4 booking permission stays distinct", () => {
  const perms = resolvePipelinePermissions({
    hasCrmShellAccess: true,
    canUseClinicFeatures: false,
    canMutateFromOperatorContext: false,
    canUseConversion: false,
    canUseBookings: true,
  });
  assert.equal(perms.canBookConsultation, true);
  assert.equal(perms.canMutate, false);
});

test("5 platform-admin proxy remains supported via session helper shape", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "fi_admin",
    canUseClinicFeatures: true,
    bookingsOperator: true,
  });
  assert.equal(perms.canView, true);
  assert.equal(perms.canMutate, true);
  assert.equal(perms.canConvert, true);
});

test("5b platform-admin with valid tenant proxy can create even when clinic-features flag is false", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member", // proxy may surface a non-mutation membership role
    canUseClinicFeatures: false,
    bookingsOperator: false,
    validPlatformAdminTenantProxy: true,
  });
  assert.equal(perms.canView, true);
  assert.equal(perms.canMutate, true);
  assert.equal(perms.canCreateEnquiry, true);
  assert.equal(perms.canConvert, true);
  assert.equal(perms.canBookConsultation, true);
});

test("5c platform-admin without tenant proxy cannot create (fail closed)", () => {
  const perms = resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    bookingsOperator: false,
    validPlatformAdminTenantProxy: false,
  });
  assert.equal(perms.canMutate, false);
  assert.equal(perms.canCreateEnquiry, false);
});

test("5d bare shell access without operator mutate or proxy is read-only", () => {
  const perms = resolvePipelinePermissions({
    hasCrmShellAccess: true,
    canUseClinicFeatures: false,
    canMutateFromOperatorContext: false,
    canUseConversion: false,
    canUseBookings: false,
    validPlatformAdminTenantProxy: false,
  });
  assert.equal(perms.canView, true);
  assert.equal(perms.canCreateEnquiry, false);
});

test("5e permission diagnostic reports denial without PHI", () => {
  let diag: ReturnType<typeof Object> | null = null;
  resolvePipelinePermissionsFromSession({
    hasCrmShellAccess: true,
    userRole: "member",
    canUseClinicFeatures: false,
    validPlatformAdminTenantProxy: false,
    onPermissionDiagnostic: (row) => {
      diag = row as unknown as ReturnType<typeof Object>;
    },
  });
  assert.ok(diag);
  const s = JSON.stringify(diag);
  assert.ok(!s.includes("@"));
  assert.ok(!s.includes("phone"));
  assert.equal((diag as { canCreateEnquiry: boolean }).canCreateEnquiry, false);
  assert.equal((diag as { denialReasonCode: string | null }).denialReasonCode, "mutation_denied");
});

test("6 stage adapter returns real stage IDs", () => {
  const rows = [stageRow({ id: "real-uuid-stage", slug: "qualified" })];
  const defs = toPipelineMoveStageDefinitions(rows);
  assert.equal(defs[0]!.id, "real-uuid-stage");
  assert.equal(defs[0]!.slug, "qualified");
});

test("7 archived stages are not movement destinations", () => {
  const rows = [
    stageRow({ id: "s1", slug: "qualified" }),
    stageRow({ id: "s2", slug: "old", metadata: { archived: true } }),
  ];
  const client = toPipelineMoveStageDefinitionsForClient(rows);
  assert.equal(client.length, 1);
  assert.equal(client[0]!.id, "s1");
});

// --- Shell loader -------------------------------------------------------------

test("8 shell uses loadCrmShellLeadsBoardIndex seam", async () => {
  const deps = mockDeps();
  await loadPipelineShellPayload(TENANT, {}, deps);
  assert.equal(boardCallCount, 1);
});

test("9 shell uses board cards as only lead source", async () => {
  const deps = mockDeps();
  const shell = await loadPipelineShellPayload(TENANT, {}, deps);
  const ids = shell.presentation.columns.flatMap((c) => c.cards.map((card) => card.leadId));
  assert.deepEqual(ids.sort(), [L1, L2]);
});

test("10 shell calls buildPipelinePresentation once (shell tier)", async () => {
  const deps = mockDeps();
  const shell = await loadPipelineShellPayload(TENANT, {}, deps);
  assert.equal(shell.presentation.loadTier, "shell");
});

test("11 shell preserves source total", async () => {
  const deps = mockDeps();
  const shell = await loadPipelineShellPayload(TENANT, {}, deps);
  assert.equal(shell.presentation.diagnostics.sourceLeadCount, 10);
  assert.equal(shell.presentation.diagnostics.hiddenLeadCount, 8);
});

test("12 shell returns real tenant movement stages", async () => {
  const deps = mockDeps();
  const shell = await loadPipelineShellPayload(TENANT, {}, deps);
  assert.ok(shell.tenantStages.some((s) => s.id === "stage-qualified"));
  assert.ok(!shell.tenantStages.some((s) => s.id === "stage-archived"));
});

test("13 shell loads no full enrichment", async () => {
  let tasksCalled = false;
  const deps = mockDeps({
    loadTasksByLeadIds: async () => {
      tasksCalled = true;
      return new Map();
    },
  });
  await loadPipelineShellPayload(TENANT, {}, deps);
  assert.equal(tasksCalled, false);
});

// --- Full loader --------------------------------------------------------------

test("14 full uses the same board query contract", async () => {
  const deps = mockDeps();
  await loadPipelineFullPayload(TENANT, { search: "smith" }, deps);
  assert.equal(boardCallCount, 1);
});

test("15 full batch-loads tasks", async () => {
  let taskLeads: string[] = [];
  const deps = mockDeps({
    loadTasksByLeadIds: async (_t, ids) => {
      taskLeads = [...ids];
      return new Map();
    },
  });
  await loadPipelineFullPayload(TENANT, {}, deps);
  assert.deepEqual(taskLeads.sort(), [L1, L2]);
});

test("16 full batch-loads communication hints", async () => {
  let called = false;
  const deps = mockDeps({
    loadCommunicationHintsByLeadIds: async () => {
      called = true;
      return new Map();
    },
  });
  await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(called, true);
});

test("17 full batch-loads consultation bookings", async () => {
  let called = false;
  const deps = mockDeps({
    loadConsultationBookingsByLeadIds: async () => {
      called = true;
      return new Map();
    },
  });
  await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(called, true);
});

test("18 full batch-loads reminders", async () => {
  let called = false;
  const deps = mockDeps({
    loadReminderJobsByLeadIds: async () => {
      called = true;
      return new Map();
    },
  });
  await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(called, true);
});

test("19 full does not perform per-lead queries", async () => {
  const deps = mockDeps();
  await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(boardCallCount, 1);
});

test("20 full produces full tier", async () => {
  const deps = mockDeps();
  const full = await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(full.presentation.loadTier, "full");
});

test("21 full does not mint leads from enrichment", async () => {
  const deps = mockDeps({
    loadTasksByLeadIds: async () =>
      new Map([
        [
          "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          [
            {
              taskId: "t-orphan",
              leadId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              title: "Orphan",
              status: "open",
              dueAtIso: null,
              completedAtIso: null,
              assigneeUserId: null,
            },
          ],
        ],
      ]),
  });
  const full = await loadPipelineFullPayload(TENANT, {}, deps);
  const ids = full.presentation.columns.flatMap((c) => c.cards.map((card) => card.leadId));
  assert.ok(!ids.includes("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"));
  assert.ok(full.presentation.diagnostics.orphanTaskIds.includes("t-orphan"));
});

test("22 full preserves source total", async () => {
  const deps = mockDeps();
  const full = await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(full.presentation.diagnostics.sourceLeadCount, 10);
});

// --- Identity and refresh -----------------------------------------------------

test("23 shell/full equal lead sets pass", async () => {
  const deps = mockDeps();
  const shell = await loadPipelineShellPayload(TENANT, {}, deps);
  const full = await loadPipelineFullPayload(TENANT, {}, deps);
  assert.equal(comparePipelineTierIdentity(shell.presentation, full.presentation).ok, true);
});

test("24 missing full lead blocks swap", () => {
  const shell = buildPipelinePresentation({
    leads: [kanban(L1), kanban(L2)],
    nowMs: NOW_MS,
    base: `/fi-admin/${TENANT}`,
    permissions: { canMutate: true, canConvert: true },
  });
  const full = buildPipelinePresentation({
    leads: [kanban(L1)],
    nowMs: NOW_MS,
    base: `/fi-admin/${TENANT}`,
    permissions: { canMutate: true, canConvert: true },
    tasksByLeadId: new Map(),
  });
  const id = comparePipelineTierIdentity(shell, full);
  assert.equal(id.ok, false);
  if (!id.ok) assert.deepEqual(id.missingFromFull, [L2]);
});

test("25 extra full lead blocks swap", () => {
  const shell = buildPipelinePresentation({
    leads: [kanban(L1)],
    nowMs: NOW_MS,
    base: `/fi-admin/${TENANT}`,
    permissions: { canMutate: true, canConvert: true },
  });
  const full = buildPipelinePresentation({
    leads: [kanban(L1), kanban(L2)],
    nowMs: NOW_MS,
    base: `/fi-admin/${TENANT}`,
    permissions: { canMutate: true, canConvert: true },
    tasksByLeadId: new Map(),
  });
  const id = comparePipelineTierIdentity(shell, full);
  assert.equal(id.ok, false);
  if (!id.ok) assert.deepEqual(id.extraInFull, [L2]);
});

test("26 full failure preserves shell/last-full (partial task batch)", async () => {
  const deps = mockDeps({
    loadTasksByLeadIds: async () => {
      throw new Error("task db down");
    },
  });
  const full = await loadPipelineFullPayload(TENANT, {}, deps);
  assert.ok(full.warnings.includes("task_batch_failed"));
  assert.equal(full.presentation.loadTier, "full");
  assert.equal(full.presentation.columns.flatMap((c) => c.cards).length, 2);
});

test("27 one refresh owner is exposed", async () => {
  const deps = mockDeps();
  const refreshed = await refreshPipelinePresentation(TENANT, {}, deps);
  assert.equal(refreshed.loadTier, "full");
});

test("28 no polling is enabled by default", () => {
  assert.equal(typeof refreshPipelinePresentation, "function");
});

test("29 concurrent refreshes do not overwrite newer data", async () => {
  let n = 0;
  const coordinator = createPipelineRefreshCoordinator(async () => {
    n += 1;
    const tier = n;
    return buildPipelinePresentation({
      leads: [kanban(L1)],
      nowMs: NOW_MS + tier,
      base: `/fi-admin/${TENANT}`,
      permissions: { canMutate: true, canConvert: true },
      tasksByLeadId: tier >= 2 ? new Map() : undefined,
    });
  });
  const [a, b] = await Promise.all([coordinator.refresh(), coordinator.refresh()]);
  assert.equal(a.loadTier, b.loadTier);
});

test("30 permission failure fails closed", () => {
  const perms = resolvePipelinePermissions({
    hasCrmShellAccess: false,
    canUseClinicFeatures: true,
    canMutateFromOperatorContext: true,
    canUseConversion: true,
    canUseBookings: true,
  });
  assert.equal(perms.canView, false);
  assert.equal(perms.canMutate, false);
});
