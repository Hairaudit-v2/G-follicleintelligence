import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildWorkspaceStaffIdentity,
  collectWorkspaceAccessDiagnostics,
  followMergedIntoCanonicalMemberId,
  resolveCanonicalStaffMemberRow,
  resolveWorkspaceAccessDecision,
  resolveWorkspaceStaffRoleKey,
  type StaffMemberRowSnapshot,
} from "@/src/lib/fiOs/workspaceAccessResolverCore";
import { seedTenantRoleTemplatesFromGlobal } from "@/src/lib/fiOs/workspaceAccessResolverSeed.server";

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const FI_STAFF = "f9e0bfdf-535a-4f0c-ab2f-3930b5ffc6c1";
const CANONICAL_MEMBER = "531653ab-e07f-40e4-90f4-f4ebbdde4ba0";
const ARCHIVED_DUP = "09f8cc84-15ab-473f-a6a7-fe913e973ca0";

test("resolveWorkspaceStaffRoleKey normalizes production role labels", () => {
  assert.equal(
    resolveWorkspaceStaffRoleKey({ staffRole: "Manager", roleCode: null }).roleKey,
    "manager"
  );
  assert.equal(
    resolveWorkspaceStaffRoleKey({ staffRole: null, roleCode: "Receptionist" }).roleKey,
    "reception"
  );
  assert.equal(
    resolveWorkspaceStaffRoleKey({ staffRole: "Nurse", roleCode: null }).roleKey,
    "nurse"
  );
  assert.equal(
    resolveWorkspaceStaffRoleKey({ staffRole: "Doctor", roleCode: null }).roleKey,
    "doctor"
  );
  assert.equal(
    resolveWorkspaceStaffRoleKey({ staffRole: "Consultant", roleCode: null }).roleKey,
    "consultant"
  );
});

test("resolveCanonicalStaffMemberRow ignores archived duplicate and picks canonical", () => {
  const archived: StaffMemberRowSnapshot = {
    id: ARCHIVED_DUP,
    fiStaffId: FI_STAFF,
    roleCode: "manager",
    archivedAt: "2026-01-01T00:00:00Z",
    mergedInto: CANONICAL_MEMBER,
    employmentStatus: "merged",
    systemAccessRevoked: false,
  };
  const canonical: StaffMemberRowSnapshot = {
    id: CANONICAL_MEMBER,
    fiStaffId: FI_STAFF,
    roleCode: "manager",
    archivedAt: null,
    mergedInto: null,
    employmentStatus: "active",
    systemAccessRevoked: false,
  };

  const picked = resolveCanonicalStaffMemberRow([archived, canonical], FI_STAFF);
  assert.equal(picked.canonical?.id, CANONICAL_MEMBER);
  assert.equal(picked.archivedDuplicateSelected, true);
});

test("followMergedIntoCanonicalMemberId resolves duplicate to canonical id", () => {
  const rows: StaffMemberRowSnapshot[] = [
    {
      id: ARCHIVED_DUP,
      fiStaffId: FI_STAFF,
      roleCode: "manager",
      archivedAt: "2026-01-01T00:00:00Z",
      mergedInto: CANONICAL_MEMBER,
      employmentStatus: "merged",
      systemAccessRevoked: false,
    },
    {
      id: CANONICAL_MEMBER,
      fiStaffId: FI_STAFF,
      roleCode: "manager",
      archivedAt: null,
      mergedInto: null,
      employmentStatus: "active",
      systemAccessRevoked: false,
    },
  ];
  assert.equal(followMergedIntoCanonicalMemberId(rows, ARCHIVED_DUP), CANONICAL_MEMBER);
});

test("grants are resolved through fi_staff.id not fi_staff_members.id", () => {
  const diagnostics = collectWorkspaceAccessDiagnostics({
    fiStaff: { id: FI_STAFF, staffRole: "Manager", isActive: true, employmentStatus: "active" },
    memberRows: [
      {
        id: CANONICAL_MEMBER,
        fiStaffId: FI_STAFF,
        roleCode: "manager",
        archivedAt: null,
        mergedInto: null,
        employmentStatus: "active",
        systemAccessRevoked: false,
      },
    ],
    tenantTemplateCount: 5,
    globalTemplateCount: 5,
    activeGrantCountForFiStaffId: 3,
    activeGrantCountForMemberId: 0,
    isAdminOverride: false,
    identity: buildWorkspaceStaffIdentity({
      fiStaff: { id: FI_STAFF, staffRole: "Manager", isActive: true, employmentStatus: "active" },
      memberRows: [
        {
          id: CANONICAL_MEMBER,
          fiStaffId: FI_STAFF,
          roleCode: "manager",
          archivedAt: null,
          mergedInto: null,
          employmentStatus: "active",
          systemAccessRevoked: false,
        },
      ],
    }),
  });
  assert.ok(
    diagnostics.some((d) => d.code === "grants_query_used_wrong_staff_id"),
    "expected grants_query_used_wrong_staff_id diagnostic"
  );
});

test("archived duplicate does not block active canonical staff", () => {
  const result = resolveWorkspaceAccessDecision({
    fiStaff: { id: FI_STAFF, staffRole: "Manager", isActive: true, employmentStatus: "active" },
    memberRows: [
      {
        id: ARCHIVED_DUP,
        fiStaffId: FI_STAFF,
        roleCode: "manager",
        archivedAt: "2026-01-01T00:00:00Z",
        mergedInto: CANONICAL_MEMBER,
        employmentStatus: "merged",
        systemAccessRevoked: false,
      },
      {
        id: CANONICAL_MEMBER,
        fiStaffId: FI_STAFF,
        roleCode: "manager",
        archivedAt: null,
        mergedInto: null,
        employmentStatus: "active",
        systemAccessRevoked: false,
      },
    ],
    tenantTemplateCount: 1,
    globalTemplateCount: 1,
    activeGrantCountForFiStaffId: 2,
    activeGrantCountForMemberId: 0,
    isAdminOverride: false,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.identity.roleKey, "manager");
  assert.equal(result.identity.fiStaffId, FI_STAFF);
});

test("Manager role gets manager grants via fi_staff.id lookup path", () => {
  const identity = buildWorkspaceStaffIdentity({
    fiStaff: { id: FI_STAFF, staffRole: "Manager", isActive: true, employmentStatus: "active" },
    memberRows: [
      {
        id: CANONICAL_MEMBER,
        fiStaffId: FI_STAFF,
        roleCode: "Manager",
        archivedAt: null,
        mergedInto: null,
        employmentStatus: "active",
        systemAccessRevoked: false,
      },
    ],
  });
  assert.equal(identity.roleKey, "manager");
  assert.equal(identity.fiStaffId, FI_STAFF);
  assert.notEqual(identity.canonicalStaffMemberId, identity.fiStaffId);
});

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(state: TableState): SupabaseClient {
  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    let pendingInsert: Record<string, unknown>[] | null = null;
    let headCount = false;

    const rows = () => (state[table] ?? []).filter((r) => filters.every((f) => f(r)));

    const applyPendingMutation = () => {
      if (pendingInsert) {
        const created = pendingInsert.map((row) => ({
          id: row.id ?? randomUUID(),
          ...row,
        }));
        state[table] = [...(state[table] ?? []), ...created];
        pendingInsert = null;
        return created;
      }
      if (patch) {
        state[table] = (state[table] ?? []).map((row) =>
          filters.every((f) => f(row)) ? { ...row, ...patch } : row
        );
        patch = null;
      }
      return null;
    };

    const api = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        headCount = Boolean(opts?.head && opts?.count === "exact");
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        return api;
      },
      limit(_n: number) {
        return api;
      },
      maybeSingle() {
        applyPendingMutation();
        const matched = rows();
        return Promise.resolve({ data: matched[0] ?? null, error: null, count: matched.length });
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        pendingInsert = Array.isArray(payload) ? payload : [payload];
        return api;
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        applyPendingMutation();
        const matched = rows();
        const result = headCount
          ? { data: null, error: null, count: matched.length }
          : { data: matched, error: null, count: matched.length };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return api;
  };

  return {
    from,
    auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } },
  } as unknown as SupabaseClient;
}

test("global templates can seed tenant templates idempotently", async () => {
  const state: TableState = {
    fi_role_permission_templates: [
      {
        id: randomUUID(),
        tenant_id: null,
        role_key: "manager",
        module_key: "workforce_os",
        tab_key: null,
        access_level: "edit",
        scope: "tenant",
        metadata: {},
      },
    ],
  };
  const client = makeMockClient(state);

  const inserted = await seedTenantRoleTemplatesFromGlobal(TENANT, "manager", client);
  assert.equal(inserted, 1);
  const tenantRows = (state.fi_role_permission_templates ?? []).filter(
    (r) => r.tenant_id === TENANT && r.role_key === "manager"
  );
  assert.equal(tenantRows.length, 1);

  const second = await seedTenantRoleTemplatesFromGlobal(TENANT, "manager", client);
  assert.equal(second, 0);
  assert.equal(
    (state.fi_role_permission_templates ?? []).filter((r) => r.tenant_id === TENANT).length,
    1
  );
});
