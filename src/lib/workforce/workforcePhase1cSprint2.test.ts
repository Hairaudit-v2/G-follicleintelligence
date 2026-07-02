import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  approveDuplicateCandidateForMerge,
  dismissDuplicateCandidate,
} from "@/src/lib/workforce/duplicateReview.server";
import { manuallyLinkStaffIdentity } from "@/src/lib/workforce/staffReconciliationPage.server";
import { mergeStaffRecords } from "@/src/lib/workforce/staffMerge.server";
import { offboardStaffMember } from "@/src/lib/workforce/staffOffboarding.server";
import { WORKFORCE_PHASE_1C_AUDIT_EVENTS } from "@/src/lib/workforce/workforcePhase1cAudit";

const TENANT = "00000000-0000-4000-8000-000000000002";
const STAFF_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CANDIDATE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FI_STAFF_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FI_STAFF_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(state: TableState): SupabaseClient {
  const auditEvents: Record<string, unknown>[] = [];

  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    let deleteMode = false;
    let selectCols = "*";
    let isHeadCount = false;

    const applyPendingMutation = () => {
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
      select(cols: string, opts?: { count?: string; head?: boolean }) {
        selectCols = cols;
        isHeadCount = Boolean(opts?.head);
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
        if (val === null) {
          filters.push((row) => row[col] == null);
        } else {
          filters.push((row) => row[col] === val);
        }
        return api;
      },
      order() {
        return api;
      },
      limit() {
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
        return Promise.resolve({
          data: rows[0] ?? null,
          error: rows.length ? null : { message: "not found" },
        });
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(row) ? row : [row];
        if (table === "fi_staff_member_audit_events") {
          auditEvents.push(...rows);
          return Promise.resolve({ error: null });
        }
        state[table] = [...(state[table] ?? []), ...rows];
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: rows[0] ?? null,
                error: null,
              }),
          }),
          then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
        };
      },
      upsert(row: Record<string, unknown>) {
        const rows = state[table] ?? [];
        const idx = rows.findIndex(
          (r) =>
            r.tenant_id === row.tenant_id &&
            r.source_system === row.source_system &&
            r.external_id === row.external_id
        );
        if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
        else rows.push(row);
        state[table] = rows;
        return Promise.resolve({ error: null });
      },
      update(next: Record<string, unknown>) {
        patch = next;
        return api;
      },
      delete() {
        deleteMode = true;
        return api;
      },
      then(resolve: (v: { data: unknown; error: null; count?: number }) => void) {
        applyPendingMutation();

        if (deleteMode) {
          resolve({ data: null, error: null });
          return;
        }

        if (patch) {
          const updated = (state[table] ?? []).filter((r) => filters.every((f) => f(r)));
          resolve({
            data: selectCols === "*" && !isHeadCount ? updated : updated,
            error: null,
            count: isHeadCount ? updated.length : undefined,
          });
          return;
        }

        const matched = (state[table] ?? []).filter((r) => filters.every((f) => f(r)));
        resolve({
          data: isHeadCount ? null : matched,
          error: null,
          count: isHeadCount ? matched.length : undefined,
        });
      },
    };

    return api;
  };

  const client = {
    from,
    rpc(name: string, args: Record<string, unknown>) {
      return {
        then(resolve: (v: { data: unknown; error: null }) => void) {
          from("_rpc").then((result) => {
            void result;
            if (name === "workforce_merge_staff_members") {
              const sourceId = String(args.p_source_staff_member_id);
              const targetId = String(args.p_target_staff_member_id);
              for (const link of state.fi_staff_identity_links ?? []) {
                if (link.staff_member_id === sourceId) link.staff_member_id = targetId;
              }
              const source = (state.fi_staff_members ?? []).find((m) => m.id === sourceId);
              if (source) {
                source.employment_status = "merged";
                source.merged_into = targetId;
                source.merged_at = new Date().toISOString();
              }
              for (const dup of state.fi_staff_duplicate_candidates ?? []) {
                dup.status = "resolved";
              }
            }
            resolve({
              data: {
                ok: true,
                moved_identity_links: 1,
                archived_source_fi_staff: true,
                dependency_counts: { identity_links: 1, credentials: 0 },
              },
              error: null,
            });
          });
        },
      };
    },
  } as unknown as SupabaseClient & { __auditEvents: Record<string, unknown>[] };

  (client as { __auditEvents: Record<string, unknown>[] }).__auditEvents = auditEvents;
  return client;
}

function baseState(): TableState {
  return {
    fi_staff_members: [
      {
        id: STAFF_A,
        tenant_id: TENANT,
        full_name: "Dr Seetal A",
        email: "seetal@example.com",
        role_code: "consultant",
        employment_status: "active",
        fi_staff_id: FI_STAFF_A,
        archived_at: null,
        merged_into: null,
        source_external_id: null,
      },
      {
        id: STAFF_B,
        tenant_id: TENANT,
        full_name: "Dr Seetal B",
        email: "seetal@example.com",
        role_code: "consultant",
        employment_status: "active",
        fi_staff_id: FI_STAFF_B,
        archived_at: null,
        merged_into: null,
        source_external_id: null,
      },
    ],
    fi_staff_identity_links: [],
    fi_staff_duplicate_candidates: [
      {
        id: CANDIDATE,
        tenant_id: TENANT,
        staff_a_id: STAFF_A,
        staff_b_id: STAFF_B,
        status: "open",
        similarity_score: 100,
        match_email: true,
        match_name: true,
        match_phone: false,
        role_similarity: true,
      },
    ],
    fi_staff_source_ids: [
      {
        tenant_id: TENANT,
        source_system: "iiohr_evolved_hr",
        source_staff_id: "ext-seetal",
        metadata: { full_name: "Dr Seetal", email: "seetal@example.com" },
      },
    ],
    fi_staff: [
      { id: FI_STAFF_A, tenant_id: TENANT, is_active: true, employment_status: "active" },
      { id: FI_STAFF_B, tenant_id: TENANT, is_active: true, employment_status: "active" },
    ],
    fi_staff_feature_access: [
      { tenant_id: TENANT, staff_id: FI_STAFF_A, feature_key: "surgery_os", enabled: true },
    ],
    fi_staff_access_grants: [
      { tenant_id: TENANT, staff_member_id: FI_STAFF_A, revoked_at: null },
    ],
    fi_staff_field_access_grants: [],
    fi_staff_shifts: [
      { tenant_id: TENANT, staff_id: FI_STAFF_A, status: "scheduled" },
    ],
    fi_staff_event_assignments: [],
    fi_staff_calendar_links: [
      { tenant_id: TENANT, staff_member_id: FI_STAFF_A, is_active: true },
    ],
    fi_staff_pins: [
      {
        tenant_id: TENANT,
        staff_id: FI_STAFF_A,
        is_active: true,
        pin_hash: "hash",
        pin_salt: "salt",
      },
    ],
    fi_staff_member_audit_events: [],
  };
}

test("manual linking creates fi_staff_identity_links", async () => {
  const state = baseState();
  const client = makeMockClient(state);

  await manuallyLinkStaffIdentity({
    tenantId: TENANT,
    staffMemberId: STAFF_A,
    sourceSystem: "iiohr_evolved_hr",
    externalId: "ext-seetal",
    linkedBy: "actor-1",
    client,
  });

  assert.equal(state.fi_staff_identity_links?.length, 1);
  assert.equal(state.fi_staff_identity_links?.[0]?.staff_member_id, STAFF_A);
  assert.equal(state.fi_staff_identity_links?.[0]?.external_id, "ext-seetal");
});

test("manual linking removes unlinked status for staff member", async () => {
  const state = baseState();
  const client = makeMockClient(state);

  await manuallyLinkStaffIdentity({
    tenantId: TENANT,
    staffMemberId: STAFF_A,
    sourceSystem: "iiohr_evolved_hr",
    externalId: "ext-seetal",
    client,
  });

  const linkedIds = new Set(
    (state.fi_staff_identity_links ?? []).map((l) => l.staff_member_id)
  );
  assert.equal(linkedIds.has(STAFF_A), true);
});

test("dismiss duplicate updates status", async () => {
  const state = baseState();
  const client = makeMockClient(state);

  await dismissDuplicateCandidate(TENANT, CANDIDATE, "actor-1", client);
  assert.equal(state.fi_staff_duplicate_candidates?.[0]?.status, "dismissed");
});

test("approve merge candidate sets approved_for_merge", async () => {
  const state = baseState();
  const client = makeMockClient(state);

  const pair = await approveDuplicateCandidateForMerge(TENANT, CANDIDATE, "actor-1", client);
  assert.equal(pair.staffAId, STAFF_A);
  assert.equal(pair.staffBId, STAFF_B);
  assert.equal(state.fi_staff_duplicate_candidates?.[0]?.status, "approved_for_merge");
});

test("merge utility moves identity links and archives source", async () => {
  const state = baseState();
  state.fi_staff_identity_links = [
    {
      tenant_id: TENANT,
      staff_member_id: STAFF_A,
      source_system: "iiohr_evolved_hr",
      external_id: "ext-a",
    },
  ];
  const client = makeMockClient(state);

  await mergeStaffRecords({
    tenantId: TENANT,
    sourceStaffId: STAFF_A,
    targetStaffId: STAFF_B,
    mergedBy: "actor-1",
    client,
  });

  assert.equal(state.fi_staff_identity_links?.[0]?.staff_member_id, STAFF_B);
  const source = state.fi_staff_members?.find((m) => m.id === STAFF_A);
  assert.equal(source?.employment_status, "merged");
  assert.equal(source?.merged_into, STAFF_B);
  assert.equal(state.fi_staff_duplicate_candidates?.[0]?.status, "resolved");
});

test("offboarding sets terminated and revokes access", async () => {
  const state = baseState();
  const client = makeMockClient(state);

  await offboardStaffMember({
    tenantId: TENANT,
    staffId: STAFF_A,
    exitReason: "Resignation",
    terminatedBy: "actor-1",
    client,
  });

  const member = state.fi_staff_members?.find((m) => m.id === STAFF_A);
  assert.equal(member?.employment_status, "terminated");
  assert.equal(member?.system_access_revoked, true);
  assert.equal(member?.academy_access_revoked, true);
  assert.equal(state.fi_staff_feature_access?.length, 0);
  assert.ok(state.fi_staff_access_grants?.[0]?.revoked_at);
  assert.equal(state.fi_staff_shifts?.[0]?.status, "cancelled");
  const pinRow = state.fi_staff_pins?.find((p) => p.staff_id === FI_STAFF_A);
  assert.equal(pinRow?.is_active, false);
});

test("offboarding disables fi_staff_pins.is_active directly", async () => {
  const state = baseState();
  const client = makeMockClient(state);

  await offboardStaffMember({
    tenantId: TENANT,
    staffId: STAFF_A,
    exitReason: "Role eliminated",
    terminatedBy: "actor-1",
    client,
  });

  const pinRow = state.fi_staff_pins?.find((p) => p.staff_id === FI_STAFF_A);
  assert.equal(pinRow?.is_active, false);

  const fiStaff = state.fi_staff?.find((s) => s.id === FI_STAFF_A);
  assert.equal(fiStaff?.is_active, false);
  if (fiStaff) fiStaff.is_active = true;
  assert.equal(pinRow?.is_active, false);
});

test("offboarding preserves audit history", async () => {
  const state = baseState();
  state.fi_staff_member_audit_events = [
    {
      tenant_id: TENANT,
      staff_member_id: STAFF_A,
      event_type: "legacy_event",
      metadata: { preserved: true },
    },
  ];
  const client = makeMockClient(state);

  await offboardStaffMember({
    tenantId: TENANT,
    staffId: STAFF_A,
    exitReason: "End of contract",
    client,
  });

  assert.equal(state.fi_staff_member_audit_events?.length, 1);
  assert.equal(state.fi_staff_member_audit_events?.[0]?.event_type, "legacy_event");
});

test("audit event constants are stable", () => {
  assert.equal(
    WORKFORCE_PHASE_1C_AUDIT_EVENTS.MANUAL_IDENTITY_LINKED,
    "workforce_manual_identity_linked"
  );
  assert.equal(WORKFORCE_PHASE_1C_AUDIT_EVENTS.STAFF_OFFBOARDED, "workforce_staff_offboarded");
});