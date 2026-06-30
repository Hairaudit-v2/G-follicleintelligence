import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyIiohrHrStaffSyncStampToPlan,
  mapIiohrHrStaffSyncRowToImportRow,
} from "@/src/lib/staffImport/iiohrHrStaffSync";
import {
  IIOHR_HR_SOURCE_SYSTEM,
  planIiohrHrStaffImport,
} from "@/src/lib/staffImport/iiohrHrStaffImportPlan";
import type {
  IiohrHrImportExistingStaff,
  IiohrHrStaffImportPlanResult,
  IiohrHrStaffImportRow,
} from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import {
  applyIiohrHrStaffImportPlanForTests,
  attachEvolvedPerthClinicMetadataToPlan,
} from "@/src/lib/staffImport/iiohrHrStaffImportRunner";
import type { IiohrHrStaffSyncRow } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

const TENANT = "00000000-0000-4000-8000-000000000001";

const ALLOWED_IMPORT_ACTION_TYPES = new Set([
  "create_fi_user",
  "update_fi_user",
  "create_fi_staff",
  "update_fi_staff",
  "link_staff_to_user",
  "create_staff_source_id",
  "update_staff_source_id",
  "deactivate_staff",
  "skip_row",
]);

function importRow(
  p: Partial<IiohrHrStaffImportRow> & Pick<IiohrHrStaffImportRow, "external_staff_id" | "full_name">
): IiohrHrStaffImportRow {
  return {
    staff_role: "consultant",
    employment_status: "active",
    ...p,
  };
}

test("mapIiohrHrStaffSyncRowToImportRow maps fields; metadata_snapshot excluded from import row", () => {
  const sync: IiohrHrStaffSyncRow = {
    external_staff_id: " HR-1 ",
    full_name: " Pat ",
    email: "Pat@EXAMPLE.com",
    staff_role: "nurse",
    employment_status: "active",
    source_url: "https://hr.example/p/1",
    default_timezone: "Australia/Perth",
    working_hours: { mon: [] },
    iiohr_user_id: "user-abc",
    metadata_snapshot: { training: [{ id: "t1", label: "CPR" }] },
  };
  const r = mapIiohrHrStaffSyncRowToImportRow(sync);
  assert.equal(r.external_staff_id, "HR-1");
  assert.equal(r.full_name, "Pat");
  assert.equal(r.email, "pat@example.com");
  assert.equal(r.iiohr_user_id, "user-abc");
  assert.equal((r as { metadata_snapshot?: unknown }).metadata_snapshot, undefined);
});

test("applyIiohrHrStaffSyncStampToPlan sets metadata.last_synced_at and merges readiness metadata", () => {
  const syncRows: IiohrHrStaffSyncRow[] = [
    {
      external_staff_id: "S1",
      full_name: "One",
      email: "one@x.com",
      onboarding_status: "pending",
      training_required_count: 2,
      metadata_snapshot: { bank_details: { account: "secret" }, schema_version: 1 },
    },
  ];
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [importRow({ external_staff_id: "S1", email: "one@x.com", full_name: "One" })],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, "clinic-1");
  applyIiohrHrStaffSyncStampToPlan(plan, syncRows, "2026-06-08T12:00:00.000Z");
  plan.actions = plan.perRow.flatMap((p) => p.actions);

  const create = plan.actions.find((a) => a.type === "create_staff_source_id");
  assert.ok(create && create.type === "create_staff_source_id");
  const md = create.payload.metadata as Record<string, unknown>;
  assert.equal(md.last_synced_at, "2026-06-08T12:00:00.000Z");
  assert.equal(md.onboarding_status, "pending");
  assert.equal(md.training_required_count, 2);
  assert.equal(md.schema_version, 1);
  assert.equal(md.bank_details, undefined);
  assert.equal(md.primary_fi_clinic_id, "clinic-1");
});

test("create_staff_source_id uses external_staff_id as stable source_staff_id (iiohr_hr)", () => {
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [importRow({ external_staff_id: "STABLE-KEY-42", email: "e@x.com", full_name: "E" })],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, null);
  applyIiohrHrStaffSyncStampToPlan(
    plan,
    [{ external_staff_id: "STABLE-KEY-42", full_name: "E", email: "e@x.com" }],
    "2026-01-01T00:00:00.000Z"
  );
  plan.actions = plan.perRow.flatMap((p) => p.actions);
  const c = plan.actions.find((a) => a.type === "create_staff_source_id");
  assert.ok(c && c.type === "create_staff_source_id");
  assert.equal(c.payload.source_system, IIOHR_HR_SOURCE_SYSTEM);
  assert.equal(c.payload.source_staff_id, "STABLE-KEY-42");
});

test("source_url deep link preserved on stamped create_staff_source_id", () => {
  const url = "https://iiohr.example/hr/staff/abc";
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [
      importRow({ external_staff_id: "K", email: "k@x.com", full_name: "K", source_url: url }),
    ],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, null);
  applyIiohrHrStaffSyncStampToPlan(
    plan,
    [{ external_staff_id: "K", full_name: "K", email: "k@x.com" }],
    "2026-01-02T00:00:00.000Z"
  );
  plan.actions = plan.perRow.flatMap((p) => p.actions);
  const c = plan.actions.find((a) => a.type === "create_staff_source_id");
  assert.ok(c && c.type === "create_staff_source_id");
  assert.equal(c.payload.source_url, url);
});

test("match by staff email when no source id — email is reconciliation, external id is new", () => {
  const existingStaff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-1",
      fi_user_id: null,
      full_name: "Existing",
      staff_role: "consultant",
      email: "same@x.com",
      is_active: true,
      default_timezone: null,
      working_hours: {},
    },
  ];
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [
      importRow({ external_staff_id: "NEW-HR-ID", email: "same@x.com", full_name: "Renamed" }),
    ],
    existingUsers: [],
    existingStaff,
    existingStaffSourceIds: [],
  });
  const pr = plan.perRow[0];
  assert.ok(pr);
  assert.equal(pr.matchKind, "staff_email");
  assert.equal(pr.matchedStaffId, "staff-1");
});

test("sync plan + stamp only emits allowed import action types (no HR document tables)", () => {
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [
      importRow({ external_staff_id: "A1", email: "a1@x.com", full_name: "A1" }),
      importRow({ external_staff_id: "A2", email: "a2@x.com", full_name: "A2" }),
    ],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, null);
  applyIiohrHrStaffSyncStampToPlan(
    plan,
    [
      {
        external_staff_id: "A1",
        full_name: "A1",
        email: "a1@x.com",
        required_documents_missing_count: 0,
      },
      {
        external_staff_id: "A2",
        full_name: "A2",
        email: "a2@x.com",
        metadata_snapshot: { compliance_summary: "ok" },
      },
    ],
    "2026-06-08T00:00:00.000Z"
  );
  plan.actions = plan.perRow.flatMap((p) => p.actions);
  for (const a of plan.actions) {
    assert.ok(ALLOWED_IMPORT_ACTION_TYPES.has(a.type), `unexpected action ${a.type}`);
  }
});

test("update_fi_user apply path never sends auth_user_id (synthetic plan + mock)", async () => {
  const fiUserUpdates: Record<string, unknown>[] = [];
  const mockFrom = (table: string) => {
    if (table === "fi_users") {
      return {
        update: (row: Record<string, unknown>) => {
          fiUserUpdates.push(row);
          return {
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        },
      };
    }
    return {};
  };
  const mockSupabase = { from: mockFrom } as unknown as SupabaseClient;

  const plan: IiohrHrStaffImportPlanResult = {
    perRow: [
      {
        rowIndex: 0,
        row: importRow({ external_staff_id: "HR-KEY", email: "new@x.com", full_name: "Staff" }),
        matchKind: "source_id" as const,
        matchedStaffId: "st1",
        matchedUserId: "u1",
        actions: [
          {
            type: "update_fi_user" as const,
            sourceRowIndex: 0,
            payload: { userId: "u1", email: "new@x.com" },
          },
        ],
        skippedDuplicate: false,
        skippedValidation: false,
      },
    ],
    actions: [],
    warnings: [],
    validationIssues: [],
  };
  plan.actions = plan.perRow.flatMap((p) => p.actions);

  const applied = {
    createdUsers: 0,
    updatedUsers: 0,
    createdStaff: 0,
    updatedStaff: 0,
    linkedStaff: 0,
    deactivatedStaff: 0,
    createdSourceIds: 0,
    updatedSourceIds: 0,
  };
  await applyIiohrHrStaffImportPlanForTests(TENANT, plan, applied, mockSupabase);

  assert.equal(fiUserUpdates.length, 1);
  for (const row of fiUserUpdates) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, "auth_user_id"), false);
  }
});
