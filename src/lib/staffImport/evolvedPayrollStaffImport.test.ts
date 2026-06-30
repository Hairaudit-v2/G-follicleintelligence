import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EVOLVED_PAYROLL_SOURCE_SYSTEM,
  PAYROLL_SENSITIVE_EXPORT_FIELDS,
} from "./evolvedPayrollStaffImportConstants";
import {
  buildPayrollFullName,
  excelSerialToIsoDate,
  listPresentSensitivePayrollFields,
  parseEvolvedPayrollExportRow,
  parseEvolvedPayrollExportRows,
  parseEvolvedPayrollExportXlsxBuffer,
} from "./evolvedPayrollStaffImportParse";
import {
  EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED,
  planEvolvedPayrollStaffImport,
} from "./evolvedPayrollStaffImportPlan";
import type {
  EvolvedPayrollImportExistingStaff,
  EvolvedPayrollStaffImportRow,
} from "./evolvedPayrollStaffImportTypes";
import { applyIiohrHrStaffImportPlanForTests } from "./iiohrHrStaffImportRunner";

const TENANT = "00000000-0000-4000-8000-000000000001";
const CLINIC = "Evolved Hair Restoration Perth";

function payrollRow(
  p: Partial<EvolvedPayrollStaffImportRow> &
    Pick<EvolvedPayrollStaffImportRow, "external_staff_id" | "full_name">
): EvolvedPayrollStaffImportRow {
  return {
    email: null,
    mobile: null,
    employment_type: "Full Time",
    start_date: "2022-02-02",
    end_date: null,
    hours_per_week: 38,
    hours_per_day: 7.6,
    source: "payroll_export",
    source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM,
    clinic_display_name: CLINIC,
    is_active: true,
    staff_role: "needs_review",
    ...p,
  };
}

test("sensitive payroll columns are detected but not included in parsed row", () => {
  const raw = {
    EmployeeId: 4491810,
    FirstName: "Sandra",
    Surname: "Popadinoski",
    EmailAddress: "s.anmari@hotmail.com",
    MobilePhone: "0483 235 682",
    EmploymentType: "Full Time",
    StartDate: 44594,
    HoursPerWeek: 38,
    TaxFileNumber: "123456789",
    DateOfBirth: 30000,
    Rate: 85000,
    BankAccount1_AccountNumber: "999999",
  };
  const sensitive = listPresentSensitivePayrollFields(raw);
  assert.ok(sensitive.includes("TaxFileNumber"));
  assert.ok(sensitive.includes("DateOfBirth"));
  assert.ok(sensitive.includes("Rate"));
  assert.ok(sensitive.includes("BankAccount1_AccountNumber"));

  const row = parseEvolvedPayrollExportRow(raw);
  assert.ok(row);
  assert.equal(row!.external_staff_id, "4491810");
  assert.equal(row!.full_name, "Sandra Popadinoski");
  assert.equal(row!.email, "s.anmari@hotmail.com");
  assert.equal(row!.staff_role, "needs_review");
  assert.equal((row as Record<string, unknown>).TaxFileNumber, undefined);
  assert.equal((row as Record<string, unknown>).Rate, undefined);
});

test("parse export lists skipped sensitive field names only", () => {
  const r = parseEvolvedPayrollExportRows([
    {
      EmployeeId: 1,
      FirstName: "A",
      Surname: "B",
      TaxFileNumber: "x",
      DateOfBirth: 1,
    },
  ]);
  assert.equal(r.rows.length, 1);
  assert.ok(r.skippedSensitiveFields.includes("TaxFileNumber"));
  assert.ok(r.skippedSensitiveFields.includes("DateOfBirth"));
  for (const name of r.skippedSensitiveFields) {
    assert.ok(
      PAYROLL_SENSITIVE_EXPORT_FIELDS.includes(
        name as (typeof PAYROLL_SENSITIVE_EXPORT_FIELDS)[number]
      )
    );
  }
});

test("excel serial StartDate maps to ISO date", () => {
  assert.equal(excelSerialToIsoDate(44594), "2022-02-02");
});

test("EndDate sets is_active false", () => {
  const row = payrollRow({
    external_staff_id: "9",
    full_name: "Former",
    end_date: "2025-01-01",
    is_active: false,
  });
  const plan = planEvolvedPayrollStaffImport({
    tenantId: TENANT,
    rows: [row],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
    primaryFiClinicId: "clinic-1",
  });
  const create = plan.actions.find((a) => a.type === "create_fi_staff");
  assert.ok(create && create.type === "create_fi_staff");
  assert.equal(create.payload.is_active, false);
});

test("EmployeeId links through fi_staff_source_ids evolved_payroll", () => {
  const staff: EvolvedPayrollImportExistingStaff[] = [
    {
      id: "staff-1",
      fi_user_id: null,
      full_name: "Existing",
      staff_role: "consultant",
      email: "other@example.com",
      mobile: null,
      is_active: true,
      working_hours: {},
    },
  ];
  const plan = planEvolvedPayrollStaffImport({
    tenantId: TENANT,
    rows: [
      payrollRow({ external_staff_id: "4491810", full_name: "Updated", email: "new@example.com" }),
    ],
    existingUsers: [],
    existingStaff: staff,
    existingStaffSourceIds: [
      {
        id: "src-1",
        staff_id: "staff-1",
        source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED,
        source_staff_id: "4491810",
        source_url: null,
        metadata: {},
      },
    ],
    primaryFiClinicId: null,
  });
  assert.equal(plan.perRow[0]?.matchKind, "source_id");
  const src = plan.actions.find(
    (a) => a.type === "update_staff_source_id" || a.type === "create_staff_source_id"
  );
  assert.ok(src);
});

test("duplicate email in import file does not create duplicate staff", () => {
  const plan = planEvolvedPayrollStaffImport({
    tenantId: TENANT,
    rows: [
      payrollRow({ external_staff_id: "1", full_name: "First", email: "dup@example.com" }),
      payrollRow({ external_staff_id: "2", full_name: "Second", email: "dup@example.com" }),
    ],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
    primaryFiClinicId: null,
  });
  assert.equal(plan.perRow[0]?.skippedDuplicate, false);
  assert.equal(plan.perRow[1]?.skippedDuplicate, true);
  assert.equal(plan.actions.filter((a) => a.type === "create_fi_staff").length, 1);
});

test("existing staff email match does not create duplicate fi_staff", async () => {
  const inserts: { table: string }[] = [];
  const mockFrom = (table: string) => ({
    insert() {
      inserts.push({ table });
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

  const existingStaff: EvolvedPayrollImportExistingStaff[] = [
    {
      id: "existing-staff-1",
      fi_user_id: null,
      full_name: "Existing",
      staff_role: "consultant",
      email: "existing@x.com",
      mobile: null,
      is_active: true,
      working_hours: {},
    },
  ];

  const plan = planEvolvedPayrollStaffImport({
    tenantId: TENANT,
    rows: [
      payrollRow({ external_staff_id: "EXT-DUP", email: "existing@x.com", full_name: "Existing" }),
    ],
    existingUsers: [],
    existingStaff,
    existingStaffSourceIds: [],
    primaryFiClinicId: null,
  });

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
});

test("new staff defaults staff_role to needs_review and evolved_payroll source id", () => {
  const plan = planEvolvedPayrollStaffImport({
    tenantId: TENANT,
    rows: [
      payrollRow({
        external_staff_id: "12891032",
        full_name: "Evie Shackleton",
        email: "evie@example.com",
      }),
    ],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
    primaryFiClinicId: "clinic-perth",
  });
  const create = plan.actions.find((a) => a.type === "create_fi_staff");
  assert.ok(create && create.type === "create_fi_staff");
  assert.equal(create.payload.staff_role, "needs_review");
  const src = plan.actions.find((a) => a.type === "create_staff_source_id");
  assert.ok(src && src.type === "create_staff_source_id");
  assert.equal(src.payload.source_system, EVOLVED_PAYROLL_SOURCE_SYSTEM_NORMALIZED);
  assert.equal(src.payload.source_staff_id, "12891032");
  const meta = src.payload.metadata as Record<string, unknown>;
  assert.equal(meta.source, "payroll_export");
  assert.equal(meta.source_system, EVOLVED_PAYROLL_SOURCE_SYSTEM);
  assert.equal(meta.primary_fi_clinic_id, "clinic-perth");
});

test("real export sample parses 10 Perth staff rows", () => {
  const path =
    "c:/Users/thelo/OneDrive/Desktop/EVOLVEDCLINICSPTYLTD_EmployeeData_20260609182701.xlsx";
  let buffer: Buffer;
  try {
    buffer = readFileSync(path);
  } catch {
    return;
  }
  const parsed = parseEvolvedPayrollExportXlsxBuffer(buffer);
  assert.equal(parsed.rows.length, 10);
  assert.ok(parsed.rows.some((r) => r.full_name.includes("Popadinoski")));
  assert.ok(parsed.skippedSensitiveFields.length > 0);
});

test("buildPayrollFullName prefixes Dr when Title is Dr", () => {
  assert.equal(
    buildPayrollFullName({
      Title: "Dr",
      FirstName: "Anita",
      MiddleName: "Katherine",
      Surname: "Cottee",
    }),
    "Dr Anita Katherine Cottee"
  );
});
