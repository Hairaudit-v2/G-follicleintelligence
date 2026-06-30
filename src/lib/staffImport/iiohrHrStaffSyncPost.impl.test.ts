import assert from "node:assert/strict";
import { test } from "node:test";

import type { IiohrHrStaffImportRunResult } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";
import {
  IIOHR_HR_STAFF_SYNC_MAX_ROWS,
  processIiohrHrStaffSyncPost,
  type StaffSyncPostServices,
} from "@/src/lib/staffImport/iiohrHrStaffSyncPost.impl";
import type { IiohrHrStaffSyncSummary } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

const TENANT = "00000000-0000-4000-8000-000000000001";
const SECRET = "sync-test-secret-value";

function emptyResult(over: Partial<IiohrHrStaffImportRunResult> = {}): IiohrHrStaffImportRunResult {
  return {
    ok: true,
    commit: false,
    validationErrors: [],
    warnings: [],
    skippedRowCount: 0,
    plan: { perRow: [], actions: [], warnings: [], validationIssues: [] },
    dryRunCounts: {
      createdUsers: 0,
      updatedUsers: 0,
      createdStaff: 0,
      updatedStaff: 0,
      linkedStaff: 0,
      deactivatedStaff: 0,
      createdSourceIds: 0,
      updatedSourceIds: 0,
    },
    ...over,
  };
}

function makeSummary(
  mode: "preview" | "commit",
  result: IiohrHrStaffImportRunResult
): IiohrHrStaffSyncSummary {
  return { mode, lastSyncedAt: "2026-06-08T12:00:00.000Z", result };
}

function oneRow() {
  return [{ external_staff_id: "X-1", full_name: "Test User", email: "t@example.com" }];
}

function trackedDeps(over: Partial<StaffSyncPostServices> = {}): {
  deps: StaffSyncPostServices;
  createCalls: unknown[];
  finishCalls: unknown[];
} {
  const createCalls: unknown[] = [];
  const finishCalls: unknown[] = [];
  const deps: StaffSyncPostServices = {
    assertTenantExists: async () => true,
    runSync: async () => makeSummary("preview", emptyResult()),
    createRun: async (input) => {
      createCalls.push(input);
      return { id: "run-1" };
    },
    finishRun: async (input) => {
      finishCalls.push(input);
    },
    ...over,
  };
  return { deps, createCalls, finishCalls };
}

test("invalid secret returns 401", async () => {
  const { deps } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: "wrong",
      configuredSecret: SECRET,
      body: { mode: "preview", rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 401);
  assert.equal((r.body as { ok: boolean }).ok, false);
});

test("missing configured secret returns 503", async () => {
  const { deps } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: undefined,
      body: { mode: "preview", rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 503);
});

test("configured secret shorter than minimum returns 503", async () => {
  const { deps } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: "short-header-here",
      configuredSecret: "tooshort",
      body: { mode: "preview", rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 503);
});

test("commit without confirm returns 400", async () => {
  const { deps } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { mode: "commit", rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 400);
  assert.match(String((r.body as { error?: string }).error ?? ""), /confirm/i);
});

test("preview accepted and records run", async () => {
  const { deps, createCalls, finishCalls } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { mode: "preview", rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 200);
  assert.equal((r.body as { ok: boolean }).ok, true);
  assert.equal(createCalls.length, 1);
  assert.equal(finishCalls.length, 1);
  assert.equal((finishCalls[0] as { status: string }).status, "success");
});

test("default mode is preview when mode omitted", async () => {
  const modes: string[] = [];
  const { deps } = trackedDeps({
    runSync: async (input) => {
      modes.push(input.mode);
      return makeSummary(input.mode, emptyResult());
    },
  });
  await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { rows: oneRow() },
    },
    deps
  );
  assert.deepEqual(modes, ["preview"]);
});

test("row limit enforced", async () => {
  const { deps } = trackedDeps();
  const rows = Array.from({ length: IIOHR_HR_STAFF_SYNC_MAX_ROWS + 1 }, (_, i) => ({
    external_staff_id: `id-${i}`,
    full_name: "N",
  }));
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { mode: "preview", rows },
    },
    deps
  );
  assert.equal(r.httpStatus, 400);
});

test("empty rows rejected", async () => {
  const { deps } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { mode: "preview", rows: [] },
    },
    deps
  );
  assert.equal(r.httpStatus, 400);
});

test("successful commit calls runSync with commit and finishes run", async () => {
  const syncModes: string[] = [];
  const { deps } = trackedDeps({
    runSync: async (input) => {
      syncModes.push(input.mode);
      assert.equal(input.confirm, true);
      const c = emptyResult().dryRunCounts;
      return makeSummary("commit", emptyResult({ ok: true, commit: true, appliedCounts: c }));
    },
  });
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { mode: "commit", confirm: true, rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 200);
  assert.deepEqual(syncModes, ["commit"]);
});

test("failed sync records failed status on finish", async () => {
  const finishes: { status: string; errorMessage?: string | null }[] = [];
  const { deps } = trackedDeps({
    runSync: async () =>
      makeSummary(
        "preview",
        emptyResult({
          ok: false,
          error: "Planner rejected.",
          validationErrors: ["Row 0: bad"],
        })
      ),
    finishRun: async (input) => {
      finishes.push({ status: input.status, errorMessage: input.errorMessage });
    },
  });
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 200);
  assert.equal((r.body as { ok: boolean }).ok, false);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0]!.status, "failed");
  assert.ok(finishes[0]!.errorMessage);
});

test("sync throw finishes run as failed", async () => {
  const finishes: { status: string }[] = [];
  const { deps } = trackedDeps({
    runSync: async () => {
      throw new Error("boom");
    },
    finishRun: async (input) => {
      finishes.push({ status: input.status });
    },
  });
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { rows: oneRow() },
    },
    deps
  );
  assert.equal(r.httpStatus, 500);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0]!.status, "failed");
});

test("syncSource is stored on fi_staff_sync_runs metadata as trigger", async () => {
  const { deps, createCalls } = trackedDeps();
  const r = await processIiohrHrStaffSyncPost(
    {
      tenantId: TENANT,
      secretHeader: SECRET,
      configuredSecret: SECRET,
      body: { mode: "preview", rows: oneRow() },
      syncSource: "cron",
    },
    deps
  );
  assert.equal(r.httpStatus, 200);
  assert.equal(createCalls.length, 1);
  const meta = (createCalls[0] as { metadata?: Record<string, unknown> }).metadata;
  assert.equal(meta?.trigger, "cron");
  assert.equal(meta?.channel, "api");
});
