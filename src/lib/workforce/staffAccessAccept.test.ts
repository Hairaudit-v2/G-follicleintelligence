import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { acceptStaffAccessInvitation } from "@/src/lib/workforce/staffAccessAccept.server";
import {
  assessStaffTenantLinkIntegrity,
  resolveStaffAccessAcceptAuditKind,
} from "@/src/lib/workforce/staffAccessAcceptCore";
import { STAFF_ACCESS_INVITE_ERRORS } from "@/src/lib/workforce/staffAccessInviteCore";
import { hashStaffAccessInviteToken } from "@/src/lib/workforce/staffAccessInviteCore";
import { revokeStaffLoginAccess } from "@/src/lib/workforce/staffAccessCentre.server";
import { STAFF_ACCESS_AUDIT_EVENTS } from "@/src/lib/workforce/staffAccessInviteAudit.server";

const TENANT = "22222222-2222-4222-8222-222222222222";
const STAFF_MEMBER = "33333333-3333-4333-8333-333333333333";
const FI_STAFF = "44444444-4444-4444-8444-444444444444";
const FI_USER = "55555555-5555-4555-8555-555555555555";
const INVITATION = "66666666-6666-4666-8666-666666666666";
const INVITE_TOKEN = "88888888-8888-4888-8888-888888888888";
const EMAIL = "staff@example.com";

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(state: TableState): SupabaseClient {
  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    let pendingInsert: Record<string, unknown>[] | null = null;

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
      select(_cols: string) {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      neq(col: string, val: unknown) {
        filters.push((row) => row[col] !== val);
        return api;
      },
      ilike(col: string, val: unknown) {
        const needle = String(val).toLowerCase();
        filters.push((row) => String(row[col] ?? "").toLowerCase() === needle);
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col]));
        return api;
      },
      is(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
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
        const matched = rows();
        return Promise.resolve({ data: matched[0] ?? null, error: null });
      },
      single() {
        applyPendingMutation();
        const matched = rows();
        return Promise.resolve({
          data: matched[0] ?? null,
          error: matched.length ? null : { message: "not found" },
        });
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        pendingInsert = Array.isArray(row) ? row : [row];
        return {
          select: () => ({
            single: () => {
              const created = applyPendingMutation();
              const first = created?.[0] ?? null;
              return Promise.resolve({
                data: first,
                error: first ? null : { message: "Could not create row." },
              });
            },
          }),
          then: (resolve: (value: { error: null }) => void) => {
            applyPendingMutation();
            resolve({ error: null });
          },
        };
      },
      update(next: Record<string, unknown>) {
        patch = next;
        return api;
      },
      then(
        resolve: (value: { data: unknown; error: null; count?: number }) => void,
        reject?: (reason?: unknown) => void
      ) {
        try {
          applyPendingMutation();
          resolve({ data: rows(), error: null });
        } catch (error) {
          reject?.(error);
        }
      },
    };
    return api;
  };

  return {
    from,
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: null }, error: null }),
        updateUserById: async () => ({ data: { user: null }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
        generateLink: async () => ({
          data: {
            user: { id: "auth-user" },
            properties: { action_link: "https://auth.example.com/magic" },
          },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;
}

function baseInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITATION,
    tenant_id: TENANT,
    staff_member_id: STAFF_MEMBER,
    fi_staff_id: FI_STAFF,
    fi_user_id: null,
    invite_email: EMAIL,
    invite_token_hash: hashStaffAccessInviteToken(INVITE_TOKEN),
    status: "sent",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    auth_invite_link: "https://auth.example.com/invite",
    accepted_at: null,
    ...overrides,
  };
}

function baseMember() {
  return {
    id: STAFF_MEMBER,
    tenant_id: TENANT,
    full_name: "Alex Staff",
    email: EMAIL,
    fi_staff_id: FI_STAFF,
    role_code: "consultant",
    employment_status: "active",
    system_access_revoked: false,
  };
}

function baseStaff(fiUserId: string | null = null) {
  return {
    id: FI_STAFF,
    tenant_id: TENANT,
    fi_user_id: fiUserId,
    email: EMAIL,
    full_name: "Alex Staff",
    staff_role: "consultant",
    is_active: true,
    employment_status: "active",
  };
}

test("assessStaffTenantLinkIntegrity requires fi_staff fi_user_id", () => {
  assert.equal(
    assessStaffTenantLinkIntegrity({
      staffMemberFiStaffId: FI_STAFF,
      fiStaffFiUserId: null,
      invitationFiStaffId: FI_STAFF,
      invitationFiUserId: FI_USER,
    }).valid,
    false
  );
  assert.equal(
    assessStaffTenantLinkIntegrity({
      staffMemberFiStaffId: FI_STAFF,
      fiStaffFiUserId: FI_USER,
      invitationFiStaffId: FI_STAFF,
      invitationFiUserId: FI_USER,
    }).valid,
    true
  );
});

test("resolveStaffAccessAcceptAuditKind distinguishes new vs repaired vs idempotent", () => {
  assert.equal(
    resolveStaffAccessAcceptAuditKind({
      alreadyAccepted: false,
      linkageValidBeforeRepair: false,
      repaired: true,
    }),
    "newly_accepted"
  );
  assert.equal(
    resolveStaffAccessAcceptAuditKind({
      alreadyAccepted: true,
      linkageValidBeforeRepair: true,
      repaired: false,
    }),
    "idempotent"
  );
  assert.equal(
    resolveStaffAccessAcceptAuditKind({
      alreadyAccepted: true,
      linkageValidBeforeRepair: false,
      repaired: true,
    }),
    "repaired_after_accepted"
  );
});

test("repair failure does not commit accepted status", async () => {
  const state: TableState = {
    fi_staff_members: [baseMember()],
    fi_staff: [],
    fi_users: [],
    fi_staff_login_invitations: [baseInvitation()],
    fi_staff_member_audit_events: [],
  };
  const client = makeMockClient(state);

  await assert.rejects(
    () =>
      acceptStaffAccessInvitation({
        tenantId: TENANT,
        inviteToken: INVITE_TOKEN,
        client,
      }),
    /Staff member not found|not found|belong to the tenant/i
  );

  const invite = state.fi_staff_login_invitations?.[0];
  assert.equal(invite?.status, "sent");
  assert.equal(invite?.accepted_at, null);
  assert.equal((state.fi_staff_member_audit_events ?? []).length, 0);
});

test("accepted invite with broken linkage can be repaired on retry", async () => {
  const state: TableState = {
    fi_staff_members: [baseMember()],
    fi_staff: [baseStaff(null)],
    fi_users: [],
    fi_staff_login_invitations: [
      baseInvitation({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      }),
    ],
    fi_staff_member_audit_events: [],
  };
  const client = makeMockClient(state);

  const result = await acceptStaffAccessInvitation({
    tenantId: TENANT,
    inviteToken: INVITE_TOKEN,
    client,
  });

  assert.equal(result.staffMemberId, STAFF_MEMBER);
  const staff = state.fi_staff?.[0];
  assert.ok(staff?.fi_user_id);
  const audit = state.fi_staff_member_audit_events ?? [];
  assert.equal(audit.length, 1);
  assert.equal(audit[0]?.event_type, STAFF_ACCESS_AUDIT_EVENTS.INVITE_LINK_REPAIRED);
});

test("accepted invite with valid linkage is idempotent", async () => {
  const state: TableState = {
    fi_staff_members: [baseMember()],
    fi_staff: [baseStaff(FI_USER)],
    fi_users: [
      {
        id: FI_USER,
        tenant_id: TENANT,
        email: EMAIL,
        auth_user_id: null,
      },
    ],
    fi_staff_login_invitations: [
      baseInvitation({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        fi_user_id: FI_USER,
      }),
    ],
    fi_staff_member_audit_events: [],
  };
  const client = makeMockClient(state);

  await acceptStaffAccessInvitation({
    tenantId: TENANT,
    inviteToken: INVITE_TOKEN,
    client,
  });

  assert.equal((state.fi_staff_member_audit_events ?? []).length, 0);
});

test("new acceptance repairs linkage before marking accepted", async () => {
  const state: TableState = {
    fi_staff_members: [baseMember()],
    fi_staff: [baseStaff(null)],
    fi_users: [],
    fi_staff_login_invitations: [baseInvitation()],
    fi_staff_member_audit_events: [],
  };
  const client = makeMockClient(state);

  await acceptStaffAccessInvitation({
    tenantId: TENANT,
    inviteToken: INVITE_TOKEN,
    client,
  });

  const invite = state.fi_staff_login_invitations?.[0];
  assert.equal(invite?.status, "accepted");
  assert.ok(invite?.accepted_at);
  assert.ok(state.fi_staff?.[0]?.fi_user_id);
  const audit = state.fi_staff_member_audit_events ?? [];
  assert.equal(audit.length, 1);
  assert.equal(audit[0]?.event_type, STAFF_ACCESS_AUDIT_EVENTS.INVITE_ACCEPTED);
});

test("already accepted with broken linkage does not throw ALREADY_ACCEPTED", async () => {
  const state: TableState = {
    fi_staff_members: [baseMember()],
    fi_staff: [baseStaff(null)],
    fi_users: [],
    fi_staff_login_invitations: [
      baseInvitation({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      }),
    ],
    fi_staff_member_audit_events: [],
  };
  const client = makeMockClient(state);

  await assert.doesNotReject(() =>
    acceptStaffAccessInvitation({
      tenantId: TENANT,
      inviteToken: INVITE_TOKEN,
      client,
    })
  );
});

test("revokeStaffLoginAccess revokes sent invites", async () => {
  const state: TableState = {
    fi_staff_members: [
      {
        id: STAFF_MEMBER,
        tenant_id: TENANT,
        fi_staff_id: FI_STAFF,
      },
    ],
    fi_staff: [baseStaff(FI_USER)],
    fi_staff_login_invitations: [
      {
        id: INVITATION,
        tenant_id: TENANT,
        staff_member_id: STAFF_MEMBER,
        status: "sent",
      },
    ],
    fi_staff_access_grants: [],
  };
  const client = makeMockClient(state);

  await revokeStaffLoginAccess({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    client,
  });

  assert.equal(state.fi_staff_login_invitations?.[0]?.status, "revoked");
  assert.ok(state.fi_staff_login_invitations?.[0]?.revoked_at);
});

test("STAFF_ACCESS_INVITE_ERRORS still documents ALREADY_ACCEPTED for legacy callers", () => {
  assert.match(STAFF_ACCESS_INVITE_ERRORS.ALREADY_ACCEPTED, /already been accepted/i);
});
