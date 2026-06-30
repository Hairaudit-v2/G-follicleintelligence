import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildHrSyncEnvironmentChecklist,
  buildHrSyncHealthOverview,
  buildHrSyncIssuesCsvExport,
  buildStaffHrSyncIssueRows,
  canPerformHrSyncHealthAdminAction,
  hrSyncIssuesCsvIsSafe,
  pickLatestSuccessfulSyncRun,
  summarizeSyncRunRow,
} from "./hrStaffSyncHealthDashboard";
import {
  buildStaffHrNotificationSummary,
  STAFF_HR_SYNC_STALE_DAYS,
} from "@/src/lib/staff/staffHrNotificationSummary";
import type { FiStaffSyncRunRow } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";
import { buildRelinkSyncRowsByEmail, buildRelinkSyncRowsBySourceStaffId } from "./hrStaffRelink";

const NOW = new Date("2026-06-09T12:00:00.000Z");
const TENANT = "00000000-0000-4000-8000-000000000001";

function runRow(
  p: Partial<FiStaffSyncRunRow> & Pick<FiStaffSyncRunRow, "status" | "started_at">
): FiStaffSyncRunRow {
  return {
    id: "run-1",
    tenant_id: TENANT,
    source_system: "iiohr_hr",
    mode: "commit",
    received_rows: 10,
    created_count: 1,
    updated_count: 8,
    linked_count: 0,
    skipped_count: 1,
    warning_count: 0,
    error_message: null,
    finished_at: p.started_at,
    metadata: {},
    ...p,
  };
}

function envAllPresent(k: string): string | undefined {
  const map: Record<string, string> = {
    IIOHR_HR_PERTH_STAFF_FEED_URL: "https://hr.example/feed",
    FI_BASE_URL: "https://fi.example",
    IIOHR_HR_SYNC_SECRET: "secret",
    EVOLVED_PERTH_TENANT_ID: TENANT,
    CRON_SECRET: "0123456789abcdef0123456789abcdef",
  };
  return map[k];
}

test("healthy sync state when latest run succeeded and staff metadata is fresh", () => {
  const checklist = buildHrSyncEnvironmentChecklist(envAllPresent);
  const runs = [
    runRow({
      status: "success",
      started_at: NOW.toISOString(),
      finished_at: NOW.toISOString(),
    }),
  ];
  const hr = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      source_url: "https://hr.example/s/1",
      metadata: {
        onboarding_status: "complete",
        training_required_count: 0,
        required_documents_missing_count: 0,
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
  const staffIssues = buildStaffHrSyncIssueRows(
    [{ id: "s1", full_name: "Alex", email: "a@x.com", is_active: true }],
    { s1: hr }
  );
  const overview = buildHrSyncHealthOverview({
    runs,
    staffIssueRows: staffIssues,
    envChecklist: checklist,
    now: NOW,
  });
  assert.equal(overview.variant, "healthy");
  assert.equal(overview.staffWithIssuesCount, 0);
  assert.equal(overview.staffMetadataStale, false);
});

test("stale sync detected for staff metadata older than 14 days", () => {
  const staleAt = new Date(
    NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000
  ).toISOString();
  const hr = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      source_url: "https://hr.example/s/1",
      metadata: {
        onboarding_status: "complete",
        training_required_count: 0,
        required_documents_missing_count: 0,
        last_synced_at: staleAt,
      },
    },
    NOW
  );
  const issues = buildStaffHrSyncIssueRows(
    [{ id: "s1", full_name: "Alex", email: "a@x.com", is_active: true }],
    { s1: hr }
  );
  assert.ok(issues.some((r) => r.issues.includes("stale_hr_sync")));
  const overview = buildHrSyncHealthOverview({
    runs: [runRow({ status: "success", started_at: NOW.toISOString() })],
    staffIssueRows: issues,
    envChecklist: buildHrSyncEnvironmentChecklist(envAllPresent),
    now: NOW,
  });
  assert.equal(overview.staffMetadataStale, true);
  assert.equal(overview.variant, "warning");
});

test("missing env vars shown without values", () => {
  const checklist = buildHrSyncEnvironmentChecklist(() => undefined);
  const feed = checklist.find((i) => i.key === "IIOHR_HR_PERTH_STAFF_FEED_URL");
  assert.equal(feed?.present, false);
  const serialized = JSON.stringify(checklist);
  assert.equal(serialized.includes("https://"), false);
  assert.equal(serialized.includes("0123456789abcdef"), false);
  assert.ok(!checklist.some((i) => typeof (i as { value?: string }).value === "string"));
});

test("export excludes sensitive fields", () => {
  const csv = buildHrSyncIssuesCsvExport([
    {
      staffId: "s1",
      fullName: "Pat",
      email: "pat@x.com",
      issues: ["no_hr_link", "training_count_unknown"],
    },
  ]);
  assert.ok(hrSyncIssuesCsvIsSafe(csv));
  assert.ok(csv.includes("Pat"));
  assert.ok(!csv.toLowerCase().includes("bank"));
});

test("non-admin cannot run sync admin actions", () => {
  assert.equal(
    canPerformHrSyncHealthAdminAction({
      userRole: "member",
      isPlatformAdmin: false,
      hasValidAdminKey: false,
    }),
    false
  );
  assert.equal(
    canPerformHrSyncHealthAdminAction({
      userRole: "crm_operator",
      isPlatformAdmin: false,
      hasValidAdminKey: false,
    }),
    true
  );
  assert.equal(
    canPerformHrSyncHealthAdminAction({
      userRole: "member",
      isPlatformAdmin: true,
      hasValidAdminKey: false,
    }),
    true
  );
});

test("relink by email respects tenant staff list boundaries", () => {
  const feedRows = [
    {
      external_staff_id: "HR-1",
      full_name: "In Tenant",
      email: "in@tenant.com",
    },
    {
      external_staff_id: "HR-2",
      full_name: "Other Tenant",
      email: "other@elsewhere.com",
    },
  ];
  const tenantStaff = [{ id: "staff-a", email: "in@tenant.com" }];
  const { rows, matchedStaffIds } = buildRelinkSyncRowsByEmail({ staff: tenantStaff, feedRows });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.external_staff_id, "HR-1");
  assert.deepEqual(matchedStaffIds, ["staff-a"]);
});

test("relink by source_staff_id matches HR source ids only", () => {
  const feedRows = [{ external_staff_id: "EXT-9", full_name: "Nine", email: "nine@x.com" }];
  const { rows, matchedStaffIds } = buildRelinkSyncRowsBySourceStaffId({
    staff: [{ id: "st-9", email: "nine@x.com" }],
    sourceIds: [{ staff_id: "st-9", source_system: "iiohr_hr", source_staff_id: "EXT-9" }],
    feedRows,
  });
  assert.equal(rows.length, 1);
  assert.deepEqual(matchedStaffIds, ["st-9"]);
});

test("summarize latest run and pick latest success", () => {
  const runs = [
    runRow({
      id: "r2",
      status: "failed",
      started_at: "2026-06-09T11:00:00.000Z",
      error_message: "boom",
    }),
    runRow({ id: "r1", status: "success", started_at: "2026-06-08T11:00:00.000Z" }),
  ];
  const latest = summarizeSyncRunRow(runs[0]!);
  assert.equal(latest.status, "failed");
  assert.equal(latest.errorMessage, "boom");
  assert.equal(pickLatestSuccessfulSyncRun(runs)?.id, "r1");
});
