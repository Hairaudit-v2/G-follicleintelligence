import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { planIiohrHrStaffImport } from "./iiohrHrStaffImportPlan";
import type { IiohrHrImportExistingStaff, IiohrHrStaffImportRow } from "./iiohrHrStaffImportTypes";
import {
  applyIiohrHrStaffImportPlanForTests,
  attachEvolvedPerthClinicMetadataToPlan,
} from "./iiohrHrStaffImportRunner";

const TENANT = "00000000-0000-4000-8000-000000000001";

function row(p: Partial<IiohrHrStaffImportRow> & Pick<IiohrHrStaffImportRow, "external_staff_id" | "full_name">): IiohrHrStaffImportRow {
  return {
    staff_role: "consultant",
    employment_status: "active",
    ...p,
  };
}

test("attachEvolvedPerthClinicMetadataToPlan adds primary_fi_clinic_id to create_staff_source_id", () => {
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "X-1", email: "solo@x.com", full_name: "Solo" })],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, "clinic-perth-1");
  const sid = plan.actions.find((a) => a.type === "create_staff_source_id");
  assert.ok(sid && sid.type === "create_staff_source_id");
  assert.equal((sid.payload.metadata as { primary_fi_clinic_id?: string }).primary_fi_clinic_id, "clinic-perth-1");
});

test("attachEvolvedPerthClinicMetadataToPlan warns when no clinic", () => {
  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "Y-1", full_name: "Y" })],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, null);
  assert.ok(plan.warnings.some((w) => w.includes("No Perth clinic")));
});

test("commit path creates fi_staff_source_ids (mock supabase)", async () => {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  const mockFrom = (table: string) => ({
    insert(payload: Record<string, unknown>) {
      inserts.push({ table, payload });
      if (table === "fi_staff_source_ids") {
        return Promise.resolve({ error: null });
      }
      return {
        select: () => ({
          single: async () => {
            if (table === "fi_users") return { data: { id: "new-user-1" }, error: null };
            if (table === "fi_staff") return { data: { id: "new-staff-1" }, error: null };
            return { data: { id: "x" }, error: null };
          },
        }),
      };
    },
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "verify-ok" }, error: null }),
        }),
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  });
  const mockSupabase = { from: mockFrom } as unknown as SupabaseClient;

  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "COMMIT-1", email: "brandnew-commit@x.com", full_name: "Commit Hire" })],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, "clinic-99");

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

  const srcInserts = inserts.filter((x) => x.table === "fi_staff_source_ids");
  assert.equal(srcInserts.length, 1);
  assert.equal(srcInserts[0]?.payload.source_system, "iiohr_hr");
  assert.equal(srcInserts[0]?.payload.staff_id, "new-staff-1");
  assert.equal((srcInserts[0]?.payload.metadata as { primary_fi_clinic_id?: string }).primary_fi_clinic_id, "clinic-99");
  assert.equal(applied.createdSourceIds, 1);
});

test("commit does not create duplicate fi_staff when email matches existing staff (mock)", async () => {
  const inserts: { table: string; payload?: Record<string, unknown> }[] = [];
  const mockFrom = (table: string) => ({
    insert(payload: Record<string, unknown>) {
      inserts.push({ table, payload });
      return {
        select: () => ({
          single: async () => ({ data: { id: "should-not-run" }, error: null }),
        }),
      };
    },
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "verify-ok" }, error: null }),
        }),
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  });
  const mockSupabase = { from: mockFrom } as unknown as SupabaseClient;

  const existingStaff: IiohrHrImportExistingStaff[] = [
    {
      id: "existing-staff-1",
      fi_user_id: null,
      full_name: "Existing",
      staff_role: "consultant",
      email: "existing@x.com",
      is_active: true,
      working_hours: {},
    },
  ];

  const plan = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "EXT-DUP", email: "existing@x.com", full_name: "Existing" })],
    existingUsers: [],
    existingStaff,
    existingStaffSourceIds: [],
  });
  attachEvolvedPerthClinicMetadataToPlan(plan, null);

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

  assert.equal(applied.createdStaff, 0);
  assert.equal(inserts.filter((i) => i.table === "fi_staff").length, 0);
  assert.ok(applied.createdSourceIds >= 1);
});
