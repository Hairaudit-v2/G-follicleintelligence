import assert from "node:assert/strict";
import { test } from "node:test";

import {
  IIOHR_HR_SOURCE_SYSTEM,
  mapIiohrHrEmploymentToIsActive,
  planIiohrHrStaffImport,
  type IiohrHrImportExistingSourceId,
  type IiohrHrImportExistingStaff,
  type IiohrHrImportExistingUser,
  type IiohrHrStaffImportRow,
} from "./iiohrHrStaffImportPlan";

const TENANT = "00000000-0000-4000-8000-000000000001";

function row(p: Partial<IiohrHrStaffImportRow> & Pick<IiohrHrStaffImportRow, "external_staff_id" | "email">): IiohrHrStaffImportRow {
  return {
    full_name: "Pat",
    staff_role: "consultant",
    employment_status: "active",
    ...p,
  };
}

test("mapIiohrHrEmploymentToIsActive", () => {
  assert.equal(mapIiohrHrEmploymentToIsActive("active"), true);
  assert.equal(mapIiohrHrEmploymentToIsActive("Terminated"), false);
  assert.equal(mapIiohrHrEmploymentToIsActive("inactive"), false);
  assert.equal(mapIiohrHrEmploymentToIsActive("unknown"), true);
});

test("match by fi_staff_source_ids iiohr_hr before email", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-1",
      fi_user_id: null,
      full_name: "Old",
      staff_role: "nurse",
      email: "other@example.com",
      is_active: true,
      working_hours: {},
    },
  ];
  const source: IiohrHrImportExistingSourceId[] = [
    {
      id: "src-1",
      staff_id: "staff-1",
      source_system: IIOHR_HR_SOURCE_SYSTEM,
      source_staff_id: "HR-99",
      source_url: null,
      metadata: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [
      row({
        external_staff_id: "HR-99",
        email: "newemail@example.com",
        full_name: "Updated Name",
        staff_role: "surgeon",
      }),
    ],
    existingUsers: [],
    existingStaff: staff,
    existingStaffSourceIds: source,
  });
  assert.equal(r.perRow[0]?.matchKind, "source_id");
  assert.equal(r.perRow[0]?.matchedStaffId, "staff-1");
  const upd = r.perRow[0]?.actions.find((a) => a.type === "update_fi_staff");
  assert.ok(upd && upd.type === "update_fi_staff");
  assert.equal(upd.payload.full_name, "Updated Name");
  assert.equal(upd.payload.staff_role, "surgeon");
  assert.equal(upd.payload.email, "newemail@example.com");
});

test("match by fi_staff.email case-insensitive", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-2",
      fi_user_id: null,
      full_name: "Case",
      staff_role: "consultant",
      email: "MixedCase@Example.COM",
      is_active: true,
      working_hours: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "X-1", email: "  mixedcase@example.com  ", full_name: "Case" })],
    existingUsers: [],
    existingStaff: staff,
    existingStaffSourceIds: [],
  });
  assert.equal(r.perRow[0]?.matchKind, "staff_email");
  assert.equal(r.perRow[0]?.matchedStaffId, "staff-2");
  const createSrc = r.perRow[0]?.actions.filter((a) => a.type === "create_staff_source_id");
  assert.equal(createSrc.length, 1);
  assert.equal(createSrc[0]?.type === "create_staff_source_id" && createSrc[0].payload.staffId, "staff-2");
});

test("match by fi_users.email case-insensitive — create fi_staff + source id", () => {
  const users: IiohrHrImportExistingUser[] = [{ id: "user-1", email: "Op@Clinic.ORG" }];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "E-1", email: "op@clinic.org", full_name: "Operator" })],
    existingUsers: users,
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  assert.equal(r.perRow[0]?.matchKind, "user_email");
  assert.equal(r.perRow[0]?.matchedUserId, "user-1");
  const creates = r.perRow[0]?.actions;
  assert.ok(creates?.some((a) => a.type === "create_fi_staff"));
  const cs = creates?.find((a) => a.type === "create_fi_staff");
  assert.equal(cs?.type === "create_fi_staff" && cs.payload.fi_user_id, "user-1");
  const sid = creates?.find((a) => a.type === "create_staff_source_id");
  assert.equal(sid?.type === "create_staff_source_id" && sid.payload.staffFromRowIndex, 0);
});

test("dedupe: second row targeting same staff is skipped with warning", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-dup",
      fi_user_id: null,
      full_name: "Dup",
      staff_role: "consultant",
      email: "dup@x.com",
      is_active: true,
      working_hours: {},
    },
  ];
  const source: IiohrHrImportExistingSourceId[] = [
    {
      id: "s-dup",
      staff_id: "staff-dup",
      source_system: IIOHR_HR_SOURCE_SYSTEM,
      source_staff_id: "EXT-1",
      source_url: null,
      metadata: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [
      row({ external_staff_id: "EXT-1", email: "dup@x.com", full_name: "First" }),
      row({ external_staff_id: "EXT-1", email: "dup@x.com", full_name: "Second" }),
    ],
    existingUsers: [],
    existingStaff: staff,
    existingStaffSourceIds: source,
  });
  assert.equal(r.perRow[0]?.skippedDuplicate, false);
  assert.equal(r.perRow[1]?.skippedDuplicate, true);
  assert.equal(r.perRow[1]?.actions.length, 0);
  assert.ok(r.warnings.some((w) => w.includes("duplicate match")));
});

test("deactivate_staff when employment terminated", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-t",
      fi_user_id: null,
      full_name: "T",
      staff_role: "consultant",
      email: "t@x.com",
      is_active: true,
      working_hours: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "T-1", email: "t@x.com", full_name: "T", employment_status: "terminated" })],
    existingUsers: [],
    existingStaff: staff,
    existingStaffSourceIds: [],
  });
  const de = r.actions.find((a) => a.type === "deactivate_staff");
  assert.ok(de);
  assert.equal(de.type === "deactivate_staff" && de.payload.staffId, "staff-t");
  const upd = r.actions.find((a) => a.type === "update_fi_staff");
  assert.equal(upd, undefined);
});

test("external id: staff matched by email gets create_staff_source_id when no HR source row", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-ns",
      fi_user_id: null,
      full_name: "No Source Yet",
      staff_role: "consultant",
      email: "ns@x.com",
      is_active: true,
      working_hours: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "HR-NEW-42", email: "ns@x.com", iiohr_user_id: "u-9" })],
    existingUsers: [],
    existingStaff: staff,
    existingStaffSourceIds: [],
  });
  assert.equal(r.perRow[0]?.matchKind, "staff_email");
  const c = r.actions.find((a) => a.type === "create_staff_source_id");
  assert.ok(c && c.type === "create_staff_source_id");
  assert.equal(c.payload.source_staff_id, "HR-NEW-42");
  assert.equal(c.payload.source_system, IIOHR_HR_SOURCE_SYSTEM);
  assert.equal(c.payload.staffId, "staff-ns");
  assert.equal(c.payload.metadata.iiohr_user_id, "u-9");
});

test("new staff + new user: fi_user_id_from_same_row_index", () => {
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "N-1", email: "brandnew@x.com", full_name: "New Hire" })],
    existingUsers: [],
    existingStaff: [],
    existingStaffSourceIds: [],
  });
  assert.equal(r.perRow[0]?.matchKind, "none");
  assert.ok(r.actions.some((a) => a.type === "create_fi_user"));
  const cs = r.actions.find((a) => a.type === "create_fi_staff");
  assert.ok(cs && cs.type === "create_fi_staff");
  assert.equal(cs.payload.fi_user_id_from_same_row_index, 0);
  assert.equal(cs.payload.fi_user_id, null);
});

test("link_staff_to_user when staff matched by source but fi_user_id null and user email matches", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-l",
      fi_user_id: null,
      full_name: "L",
      staff_role: "consultant",
      email: "link@x.com",
      is_active: true,
      working_hours: {},
    },
  ];
  const users: IiohrHrImportExistingUser[] = [{ id: "user-l", email: "link@x.com" }];
  const source: IiohrHrImportExistingSourceId[] = [
    {
      id: "sl-1",
      staff_id: "staff-l",
      source_system: IIOHR_HR_SOURCE_SYSTEM,
      source_staff_id: "L-1",
      source_url: null,
      metadata: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [row({ external_staff_id: "L-1", email: "LINK@x.com" })],
    existingUsers: users,
    existingStaff: staff,
    existingStaffSourceIds: source,
  });
  const lk = r.actions.find((a) => a.type === "link_staff_to_user");
  assert.ok(lk && lk.type === "link_staff_to_user");
  assert.equal(lk.payload.staffId, "staff-l");
  assert.equal(lk.payload.fiUserId, "user-l");
});

test("update_staff_source_id when URL or metadata changes", () => {
  const staff: IiohrHrImportExistingStaff[] = [
    {
      id: "staff-u",
      fi_user_id: "user-u",
      full_name: "U",
      staff_role: "consultant",
      email: "u@x.com",
      is_active: true,
      working_hours: {},
    },
  ];
  const source: IiohrHrImportExistingSourceId[] = [
    {
      id: "src-u",
      staff_id: "staff-u",
      source_system: IIOHR_HR_SOURCE_SYSTEM,
      source_staff_id: "U-1",
      source_url: "https://old",
      metadata: {},
    },
  ];
  const r = planIiohrHrStaffImport({
    tenantId: TENANT,
    rows: [
      row({
        external_staff_id: "U-1",
        email: "u@x.com",
        source_url: "https://new",
        iiohr_user_id: "acad-1",
      }),
    ],
    existingUsers: [{ id: "user-u", email: "u@x.com" }],
    existingStaff: staff,
    existingStaffSourceIds: source,
  });
  const up = r.actions.find((a) => a.type === "update_staff_source_id");
  assert.ok(up && up.type === "update_staff_source_id");
  assert.equal(up.payload.id, "src-u");
  assert.equal(up.payload.source_url, "https://new");
  assert.equal(up.payload.metadata?.iiohr_user_id, "acad-1");
});
