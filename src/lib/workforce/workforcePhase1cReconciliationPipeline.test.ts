import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/workforce/identityReconciliationCore";
import {
  buildDuplicateStaffContexts,
  buildReconciliationDiagnostics,
  findBestExternalMatch,
  isActiveUnlinkedStaff,
  mergeExternalIdentities,
  scoreExternalMatch,
  type ExternalStaffIdentityOption,
  type ReconciliationMemberContext,
} from "@/src/lib/workforce/staffReconciliationDataCore";
import { loadStaffReconciliationQueue } from "@/src/lib/workforce/staffReconciliationPage.server";

const TENANT = "00000000-0000-4000-8000-000000000099";
const STAFF_CANONICAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF_DUPLICATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF_UNMATCHED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const IIOHR_SEETAL: ExternalStaffIdentityOption = {
  sourceSystem: "iiohr_hr",
  externalId: "ext-seetal",
  externalEmail: "seetskd@gmail.com",
  externalName: "Dr Seetal",
};

function member(
  id: string,
  overrides: Partial<ReconciliationMemberContext> = {}
): ReconciliationMemberContext {
  return {
    id,
    tenantId: TENANT,
    fullName: overrides.fullName ?? "Dr Seetal",
    email: overrides.email ?? "seetskd@gmail.com",
    phone: null,
    roleCode: "consultant",
    fiStaffId: overrides.fiStaffId ?? null,
    sourceExternalId: null,
    iiohrStaffRecordId: null,
    sourceSystem: null,
    mergedInto: null,
    archivedAt: null,
    employmentStatus: "active",
    ...overrides,
  };
}

test("exact email match returns score 100 and emailExactMatch", () => {
  const scored = scoreExternalMatch(member(STAFF_CANONICAL), IIOHR_SEETAL);
  assert.equal(scored.score, 100);
  assert.equal(scored.emailExactMatch, true);
});

test("normalized email match works with casing and whitespace", () => {
  const scored = scoreExternalMatch(
    member(STAFF_CANONICAL, { email: "  SeetsKD@Gmail.COM " }),
    {
      ...IIOHR_SEETAL,
      externalEmail: "SEETSKD@GMAIL.COM",
    }
  );
  assert.equal(scored.emailExactMatch, true);
  assert.equal(scored.score, 100);
});

test("unmatched staff remains unmatched", () => {
  const best = findBestExternalMatch(
    member(STAFF_UNMATCHED, { email: "nobody@example.com", fullName: "Nobody Known" }),
    [IIOHR_SEETAL]
  );
  assert.equal(best, null);
});

test("duplicate FI staff records are detected for canonical collapse", () => {
  const duplicateContexts = buildDuplicateStaffContexts([
    member(STAFF_CANONICAL, { fiStaffId: "fi-a" }),
    member(STAFF_DUPLICATE, { fullName: "Dr Seetal (duplicate)" }),
  ]);
  assert.equal(duplicateContexts.size, 1);
  const duplicate = duplicateContexts.get(STAFF_DUPLICATE);
  assert.ok(duplicate);
  assert.equal(duplicate?.canonicalStaffMemberId, STAFF_CANONICAL);
});

test("staff linked via iiohr_staff_record_id are excluded from unlinked queue", () => {
  const linkedMemberIds = new Set<string>();
  const linked = member(STAFF_CANONICAL, { iiohrStaffRecordId: "iiohr-uuid-1" });
  assert.equal(isActiveUnlinkedStaff({ member: linked, linkedMemberIds }), false);
});

test("mergeExternalIdentities dedupes feed and source-id rows", () => {
  const merged = mergeExternalIdentities([
    IIOHR_SEETAL,
    {
      sourceSystem: "iiohr_hr",
      externalId: "ext-seetal",
      externalEmail: null,
      externalName: "Dr Seetal (source id)",
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.externalEmail, "seetskd@gmail.com");
});

test("diagnostics count exact email candidates separately from unmatched", () => {
  const externals = [IIOHR_SEETAL];
  const members = [
    member(STAFF_CANONICAL),
    member(STAFF_UNMATCHED, { email: "other@example.com", fullName: "Other Person" }),
  ];
  const diagnostics = buildReconciliationDiagnostics({
    members,
    externals,
    linkedMemberIds: new Set(),
    unlinkedMembers: members,
    duplicateContexts: new Map(),
  });
  assert.equal(diagnostics.totalIiohrExternalRows, 1);
  assert.equal(diagnostics.exactEmailCandidatePairs, 1);
  assert.equal(diagnostics.genuinelyUnmatched, 1);
});

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(state: TableState): SupabaseClient {
  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let isHeadCount = false;

    const api = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        isHeadCount = Boolean(opts?.head);
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      neq() {
        return api;
      },
      is(col: string, val: unknown) {
        if (val === null) filters.push((row) => row[col] == null);
        else filters.push((row) => row[col] === val);
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      maybeSingle() {
        const rows = (state[table] ?? []).filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: rows[0] ?? null, error: null, count: isHeadCount ? rows.length : null });
      },
      then(resolve: (v: unknown) => void) {
        const rows = (state[table] ?? []).filter((r) => filters.every((f) => f(r)));
        resolve({ data: rows, error: null, count: isHeadCount ? rows.length : null });
      },
    };
    return api;
  };

  return { from } as unknown as SupabaseClient;
}

test("page loader returns exact email match for Dr Seetal scenario", async () => {
  const state: TableState = {
    fi_staff_members: [
      {
        id: STAFF_CANONICAL,
        tenant_id: TENANT,
        full_name: "Dr Seetal",
        email: "seetskd@gmail.com",
        phone: null,
        role_code: "consultant",
        fi_staff_id: "fi-staff-1",
        source_external_id: null,
        iiohr_staff_record_id: null,
        source_system: null,
        merged_into: null,
        archived_at: null,
        employment_status: "active",
      },
      {
        id: STAFF_DUPLICATE,
        tenant_id: TENANT,
        full_name: "Dr Seetal",
        email: "seetskd@gmail.com",
        phone: null,
        role_code: "consultant",
        fi_staff_id: null,
        source_external_id: null,
        iiohr_staff_record_id: null,
        source_system: null,
        merged_into: null,
        archived_at: null,
        employment_status: "active",
      },
      {
        id: STAFF_UNMATCHED,
        tenant_id: TENANT,
        full_name: "Nobody",
        email: "nobody@example.com",
        phone: null,
        role_code: "nurse",
        fi_staff_id: null,
        source_external_id: null,
        iiohr_staff_record_id: null,
        source_system: null,
        merged_into: null,
        archived_at: null,
        employment_status: "active",
      },
    ],
    fi_staff_identity_links: [],
    fi_staff_source_ids: [
      {
        tenant_id: TENANT,
        source_system: "iiohr_hr",
        source_staff_id: "ext-seetal",
        metadata: { full_name: "Dr Seetal", email: "seetskd@gmail.com" },
      },
    ],
  };

  const client = makeMockClient(state);
  const queue = await loadStaffReconciliationQueue(TENANT, client);

  assert.equal(queue.availableExternalIdentities.length, 1);
  assert.equal(queue.diagnostics.exactEmailCandidatePairs, 2);
  assert.equal(queue.diagnostics.duplicateFiStaffRows, 1);
  assert.equal(queue.diagnostics.genuinelyUnmatched, 1);

  const canonical = queue.unlinkedStaff.find((row) => row.id === STAFF_CANONICAL);
  assert.ok(canonical);
  assert.equal(canonical?.matchSuggestions[0]?.score, 100);
  assert.equal(
    normalizeEmail(canonical?.matchSuggestions[0]?.externalEmail),
    "seetskd@gmail.com"
  );

  const unmatched = queue.unlinkedStaff.find((row) => row.id === STAFF_UNMATCHED);
  assert.ok(unmatched);
  assert.equal(unmatched?.matchSuggestions.length, 0);
});