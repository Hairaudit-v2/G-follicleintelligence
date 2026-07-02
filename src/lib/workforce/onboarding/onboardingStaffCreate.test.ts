import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STAFF_LIFECYCLE_AUDIT_EVENTS } from "@/src/lib/workforce-os/staffLifecycleTypes";
import { createOnboardingStaffMember } from "@/src/lib/workforce/onboarding/onboardingPage.server";
import {
  buildOnboardingInboundIdentity,
  evaluateOnboardingStaffCreation,
  ONBOARDING_STAFF_SOURCE,
  resolveOnboardingStaffCreationDecision,
} from "@/src/lib/workforce/onboarding/onboardingStaffCreateCore";
import type {
  IdentityLinkSnapshot,
  StaffMemberSnapshot,
} from "@/src/lib/workforce/identityReconciliationCore";

const TENANT = "00000000-0000-4000-8000-000000000001";
const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const EXISTING_MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const NEW_MEMBER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const NEW_FI_STAFF_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function activeMember(overrides: Partial<StaffMemberSnapshot> = {}): StaffMemberSnapshot {
  return {
    id: EXISTING_MEMBER_ID,
    tenantId: TENANT,
    fullName: "Existing Staff",
    email: "existing@example.com",
    phone: null,
    roleCode: "consultant",
    fiStaffId: "33333333-3333-4333-8333-333333333333",
    sourceExternalId: null,
    mergedInto: null,
    archivedAt: null,
    ...overrides,
  };
}

test("buildOnboardingInboundIdentity: uses normalized email as external id", () => {
  const inbound = buildOnboardingInboundIdentity({
    email: "  Person@Example.COM ",
    fullName: "Person Example",
  });
  assert.equal(inbound.sourceSystem, ONBOARDING_STAFF_SOURCE);
  assert.equal(inbound.externalId, "person@example.com");
  assert.equal(inbound.email, "person@example.com");
});

test("resolveOnboardingStaffCreationDecision: rejects duplicate email match", () => {
  const decision = resolveOnboardingStaffCreationDecision({
    staffMemberId: EXISTING_MEMBER_ID,
    matchMethod: "email_exact",
    confidence: 1,
    requiresManualReview: false,
    conflictReason: null,
    shouldCreate: false,
    shouldUpdate: true,
  });
  assert.equal(decision.action, "reject");
  if (decision.action === "reject") {
    assert.match(decision.message, /already exists/i);
  }
});

test("resolveOnboardingStaffCreationDecision: rejects manual review conflicts", () => {
  const decision = resolveOnboardingStaffCreationDecision({
    staffMemberId: null,
    matchMethod: "manual_review",
    confidence: 0.5,
    requiresManualReview: true,
    conflictReason: "Multiple staff members share the inbound email.",
    shouldCreate: false,
    shouldUpdate: false,
  });
  assert.equal(decision.action, "reject");
  if (decision.action === "reject") {
    assert.match(decision.message, /Multiple staff members share the inbound email/);
  }
});

test("evaluateOnboardingStaffCreation: allows create when no active match", () => {
  const decision = evaluateOnboardingStaffCreation({
    tenantId: TENANT,
    email: "new-hire@example.com",
    fullName: "New Hire",
    staffMembers: [activeMember({ email: "other@example.com" })],
    identityLinks: [] as IdentityLinkSnapshot[],
  });
  assert.deepEqual(decision, { action: "create" });
});

test("evaluateOnboardingStaffCreation: rejects when email matches active member", () => {
  const decision = evaluateOnboardingStaffCreation({
    tenantId: TENANT,
    email: "existing@example.com",
    fullName: "Existing Staff",
    staffMembers: [activeMember()],
    identityLinks: [] as IdentityLinkSnapshot[],
  });
  assert.equal(decision.action, "reject");
});

type MockOp =
  | { kind: "insert"; table: string; payload: Record<string, unknown> }
  | { kind: "delete"; table: string; filters: Record<string, unknown> }
  | { kind: "update"; table: string; payload: Record<string, unknown> };

function makeCreateStaffMockClient(options: {
  staffMembers?: StaffMemberSnapshot[];
  reusableFiStaffId?: string | null;
  failMemberInsert?: boolean;
}): { client: SupabaseClient; ops: MockOp[] } {
  const ops: MockOp[] = [];
  let fiStaffInsertCount = 0;

  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let isDelete = false;
    let selectCols = "*";
    let countHead = false;

    async function resolveRead() {
      if (table === "fi_staff_members" && !pendingInsert && !pendingUpdate && !isDelete) {
        let rows = (options.staffMembers ?? []).map((m) => ({
          id: m.id,
          tenant_id: m.tenantId,
          full_name: m.fullName,
          email: m.email,
          phone: m.phone,
          role_code: m.roleCode,
          fi_staff_id: m.fiStaffId,
          source_external_id: m.sourceExternalId,
          iiohr_staff_record_id: m.iiohrStaffRecordId ?? null,
          source_system: m.sourceSystem ?? null,
          merged_into: m.mergedInto,
          archived_at: m.archivedAt,
        }));
        if (filters.id) {
          rows = rows.filter((row) => row.id === filters.id);
        }
        if (filters.fi_staff_id) {
          const hasMatch = rows.some((row) => row.fi_staff_id === filters.fi_staff_id);
          return { data: hasMatch ? rows[0] : null, error: null, count: hasMatch ? 1 : 0 };
        }
        if (countHead) {
          return { data: null, error: null, count: 0 };
        }
        return { data: rows, error: null, count: rows.length };
      }
      if (table === "fi_staff_identity_links") {
        return { data: [], error: null, count: 0 };
      }
      if (table === "fi_staff" && pendingUpdate) {
        ops.push({ kind: "update", table, payload: pendingUpdate });
        pendingUpdate = null;
        return { data: null, error: null, count: 0 };
      }
      if (table === "fi_staff" && filters.email) {
        if (options.reusableFiStaffId) {
          return { data: [{ id: options.reusableFiStaffId }], error: null, count: 1 };
        }
        return { data: [], error: null, count: 0 };
      }
      if (pendingInsert && table === "fi_staff_member_audit_events") {
        ops.push({ kind: "insert", table, payload: pendingInsert });
        pendingInsert = null;
        return { data: null, error: null, count: 0 };
      }
      if (pendingInsert && table === "fi_staff_onboarding_checklists") {
        ops.push({ kind: "insert", table, payload: pendingInsert });
        pendingInsert = null;
        return { data: null, error: null, count: 0 };
      }
      if (table === "fi_staff_onboarding_checklists" && pendingUpdate) {
        ops.push({ kind: "update", table, payload: pendingUpdate });
        pendingUpdate = null;
        return { data: null, error: null, count: 0 };
      }
      if (table === "fi_staff_onboarding_checklists" && filters.staff_member_id) {
        return { data: { id: "checklist-1" }, error: null, count: 1 };
      }
      return { data: null, error: null, count: 0 };
    }

    const api = {
      select(cols: string, opts?: { count?: string; head?: boolean }) {
        selectCols = cols;
        countHead = Boolean(opts?.head);
        return api;
      },
      insert(payload: Record<string, unknown>) {
        pendingInsert = payload;
        if (table === "fi_staff_member_audit_events" || table === "fi_staff_onboarding_checklists") {
          ops.push({ kind: "insert", table, payload });
          pendingInsert = null;
          return {
            then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
            },
          };
        }
        return {
          select: () => ({
            single: async () => {
              if (table === "fi_staff_members" && options.failMemberInsert) {
                ops.push({ kind: "insert", table, payload });
                pendingInsert = null;
                return { data: null, error: { message: "duplicate member" } };
              }
              const id =
                table === "fi_staff"
                  ? fiStaffInsertCount === 0
                    ? NEW_FI_STAFF_ID
                    : `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${++fiStaffInsertCount}`
                  : NEW_MEMBER_ID;
              if (table === "fi_staff") fiStaffInsertCount += 1;
              ops.push({ kind: "insert", table, payload });
              pendingInsert = null;
              return { data: { id, ...(table === "fi_staff" ? payload : {}) }, error: null };
            },
          }),
        };
      },
      update(payload: Record<string, unknown>) {
        pendingUpdate = payload;
        return api;
      },
      delete() {
        isDelete = true;
        return api;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        if (isDelete) {
          ops.push({ kind: "delete", table, filters: { ...filters } });
        }
        return api;
      },
      is(col: string, val: unknown) {
        if (val === null) filters[`${col}__is_null`] = true;
        else filters[col] = val;
        return api;
      },
      in() {
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      maybeSingle: async () => resolveRead(),
      single: async () => resolveRead(),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return resolveRead().then(onFulfilled, onRejected);
      },
    };

    void selectCols;
    return api;
  };

  return { client: { from } as unknown as SupabaseClient, ops };
}

test("createOnboardingStaffMember: rejects duplicate email before insert", async () => {
  const mock = makeCreateStaffMockClient({
    staffMembers: [activeMember({ email: "dup@example.com" })],
  });

  await assert.rejects(
    () =>
      createOnboardingStaffMember({
        tenantId: TENANT,
        data: {
          fullName: "Dup Person",
          email: "dup@example.com",
          roleCode: "consultant",
          clinicId: CLINIC_ID,
          employmentType: "full_time",
        },
        client: mock.client,
      }),
    /already exists/i
  );

  assert.equal(
    mock.ops.filter((op) => op.kind === "insert" && op.table === "fi_staff").length,
    0
  );
});

test("createOnboardingStaffMember: rolls back fi_staff when member insert fails", async () => {
  const mock = makeCreateStaffMockClient({ failMemberInsert: true });

  await assert.rejects(
    () =>
      createOnboardingStaffMember({
        tenantId: TENANT,
        data: {
          fullName: "Rollback Test",
          email: "rollback@example.com",
          roleCode: "consultant",
          clinicId: null,
          employmentType: "casual",
        },
        client: mock.client,
      }),
    /duplicate member/i
  );

  assert.ok(
    mock.ops.some((op) => op.kind === "insert" && op.table === "fi_staff"),
    "fi_staff insert attempted"
  );
  assert.ok(
    mock.ops.some((op) => op.kind === "delete" && op.table === "fi_staff"),
    "fi_staff rolled back after member failure"
  );
});

test("createOnboardingStaffMember: reuses orphan fi_staff row instead of creating duplicate", async () => {
  const reusableId = "44444444-4444-4444-8444-444444444444";
  const mock = makeCreateStaffMockClient({ reusableFiStaffId: reusableId });

  const result = await createOnboardingStaffMember({
    tenantId: TENANT,
    data: {
      fullName: "Reuse Person",
      email: "reuse@example.com",
      roleCode: "nurse",
      clinicId: null,
      employmentType: "part_time",
    },
    client: mock.client,
  });

  assert.equal(result.fiStaffId, reusableId);
  assert.equal(
    mock.ops.filter((op) => op.kind === "insert" && op.table === "fi_staff").length,
    0
  );
  assert.ok(
    mock.ops.some(
      (op) =>
        op.kind === "update" &&
        op.table === "fi_staff" &&
        op.payload.employment_status === "pending_onboarding"
    )
  );
});

test("createOnboardingStaffMember: writes staff_onboarding_created audit event", async () => {
  const mock = makeCreateStaffMockClient({});

  await createOnboardingStaffMember({
    tenantId: TENANT,
    data: {
      fullName: "Audit Person",
      email: "audit@example.com",
      roleCode: "consultant",
      clinicId: null,
      employmentType: "full_time",
    },
    actorFiUserId: "55555555-5555-4555-8555-555555555555",
    client: mock.client,
  });

  const auditInsert = mock.ops.find(
    (op) => op.kind === "insert" && op.table === "fi_staff_member_audit_events"
  );
  assert.ok(auditInsert);
  if (auditInsert?.kind === "insert") {
    assert.equal(auditInsert.payload.event_type, STAFF_LIFECYCLE_AUDIT_EVENTS.ONBOARDING_CREATED);
    assert.equal(auditInsert.payload.source, ONBOARDING_STAFF_SOURCE);
    const metadata = auditInsert.payload.metadata as Record<string, unknown>;
    assert.equal(metadata.created_via, ONBOARDING_STAFF_SOURCE);
  }
});

test("STAFF_LIFECYCLE_AUDIT_EVENTS: includes staff_onboarding_created", () => {
  assert.equal(STAFF_LIFECYCLE_AUDIT_EVENTS.ONBOARDING_CREATED, "staff_onboarding_created");
});
