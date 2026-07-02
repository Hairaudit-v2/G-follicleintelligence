import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { alignIiohrStaffDeparture } from "@/src/lib/staffImport/iiohrStaffDepartureAlignment.server";

const TENANT = "00000000-0000-4000-8000-000000000010";
const STAFF_MEMBER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FI_STAFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(state: TableState): SupabaseClient {
  const auditEvents: Record<string, unknown>[] = [];

  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    let deleteMode = false;
    let upsertRow: Record<string, unknown> | null = null;

    const applyPendingMutation = () => {
      if (upsertRow) {
        const rows = state[table] ?? [];
        const idx = rows.findIndex(
          (r) =>
            r.tenant_id === upsertRow!.tenant_id &&
            r.staff_member_id === upsertRow!.staff_member_id &&
            r.alert_type === upsertRow!.alert_type
        );
        if (idx >= 0) rows[idx] = { ...rows[idx], ...upsertRow };
        else rows.push(upsertRow);
        state[table] = rows;
        upsertRow = null;
        return;
      }
      if (!patch && !deleteMode) return;
      let rows = state[table] ?? [];
      if (deleteMode) {
        rows = rows.filter((r) => !filters.every((f) => f(r)));
        state[table] = rows;
        deleteMode = false;
        return;
      }
      if (patch) {
        rows = rows.map((r) => (filters.every((f) => f(r)) ? { ...r, ...patch } : r));
        state[table] = rows;
        patch = null;
      }
    };

    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col]));
        return api;
      },
      is(col: string, val: unknown) {
        if (val === null) filters.push((row) => row[col] == null);
        else filters.push((row) => row[col] === val);
        return api;
      },
      gte(col: string, val: unknown) {
        filters.push((row) => String(row[col] ?? "") >= String(val));
        return api;
      },
      neq(col: string, val: unknown) {
        filters.push((row) => row[col] !== val);
        return api;
      },
      maybeSingle() {
        applyPendingMutation();
        const rows = (state[table] ?? []).filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        applyPendingMutation();
        const rows = (state[table] ?? []).filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: rows[0] ?? null, error: rows.length ? null : { message: "not found" } });
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(row) ? row : [row];
        if (table === "fi_staff_member_audit_events") {
          auditEvents.push(...rows);
          return Promise.resolve({ error: null });
        }
        state[table] = [...(state[table] ?? []), ...rows];
        return Promise.resolve({ error: null });
      },
      upsert(row: Record<string, unknown>) {
        upsertRow = row;
        return api;
      },
      update(next: Record<string, unknown>) {
        patch = next;
        return api;
      },
      delete() {
        deleteMode = true;
        return api;
      },
      then(resolve: (v: { data: unknown; error: null }) => void) {
        applyPendingMutation();
        resolve({ data: null, error: null });
      },
    };

    return api;
  };

  return {
    from,
    rpc() {
      return { then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: null, error: null }) };
    },
  } as unknown as SupabaseClient;
}

function baseMember(employmentStatus: string) {
  return {
    id: STAFF_MEMBER,
    tenant_id: TENANT,
    fi_staff_id: FI_STAFF,
    employment_status: employmentStatus,
    full_name: "Dr Test",
    archived_at: null,
  };
}

function baseState(employmentStatus = "active"): TableState {
  return {
    fi_staff_members: [baseMember(employmentStatus)],
    fi_staff: [
      {
        id: FI_STAFF,
        tenant_id: TENANT,
        is_active: employmentStatus === "active",
        employment_status: employmentStatus,
      },
    ],
    fi_staff_feature_access: [],
    fi_staff_access_grants: [],
    fi_staff_field_access_grants: [],
    fi_staff_shifts: [],
    fi_staff_event_assignments: [],
    fi_staff_calendar_links: [],
    fi_staff_pins: [
      {
        tenant_id: TENANT,
        staff_id: FI_STAFF,
        is_active: true,
        pin_hash: "hash",
        pin_salt: "salt",
      },
    ],
    fi_bookings: [],
    fi_booking_resource_assignments: [],
    fi_staff_member_audit_events: [],
    fi_staff_compliance_alerts: [],
  };
}

test("IIOHR terminated staff updates fi_staff_members status via full offboard", async () => {
  const state = baseState("active");
  const client = makeMockClient(state);

  const result = await alignIiohrStaffDeparture({
    tenantId: TENANT,
    fiStaffId: FI_STAFF,
    hrEmploymentStatus: "terminated",
    client,
  });

  assert.equal(result.action, "full_offboard");
  assert.equal(result.employmentStatus, "terminated");
  const member = state.fi_staff_members?.[0];
  assert.equal(member?.employment_status, "terminated");
  assert.equal(state.fi_staff?.[0]?.is_active, false);
});

test("IIOHR resigned staff updates fi_staff_members status", async () => {
  const state = baseState("active");
  const client = makeMockClient(state);

  const result = await alignIiohrStaffDeparture({
    tenantId: TENANT,
    fiStaffId: FI_STAFF,
    hrEmploymentStatus: "resigned",
    client,
  });

  assert.equal(result.action, "full_offboard");
  assert.equal(state.fi_staff_members?.[0]?.employment_status, "resigned");
});

test("IIOHR inactive staff deactivates without full termination side effects on employment status", async () => {
  const state = baseState("active");
  const client = makeMockClient(state);

  const result = await alignIiohrStaffDeparture({
    tenantId: TENANT,
    fiStaffId: FI_STAFF,
    hrEmploymentStatus: "inactive",
    client,
  });

  assert.equal(result.action, "deactivate_only");
  assert.equal(state.fi_staff_members?.[0]?.employment_status, "inactive");
  assert.equal(state.fi_staff?.[0]?.is_active, false);
  assert.notEqual(state.fi_staff_members?.[0]?.employment_status, "terminated");
});

test("already offboarded staff is idempotent", async () => {
  const state = baseState("terminated");
  state.fi_staff![0]!.is_active = false;
  const client = makeMockClient(state);

  const result = await alignIiohrStaffDeparture({
    tenantId: TENANT,
    fiStaffId: FI_STAFF,
    hrEmploymentStatus: "terminated",
    client,
  });

  assert.equal(result.action, "skipped_already_offboarded");
  assert.equal(state.fi_staff_members?.[0]?.employment_status, "terminated");
});
