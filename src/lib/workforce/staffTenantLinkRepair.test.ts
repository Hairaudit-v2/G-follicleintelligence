import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { acceptStaffAccessInvitation } from "@/src/lib/workforce/staffAccessAccept.server";
import {
  blocksStaffAccessLoginForEmploymentStatus,
  extractTenantIdFromFiAdminPath,
  formatCrossTenantInviteWarning,
  isBareFiAdminTenantHomePath,
  resolvePostLoginDestination,
  resolvePreferredLoginTenantId,
  shouldPreferMembershipOverMetadata,
} from "@/src/lib/workforce/staffTenantLinkRepairCore";
import {
  loadCrossTenantInviteWarning,
  provisionStaffAuthInviteLink,
  repairStaffTenantLinkFromInvitation,
  repairStaffTenantLinkOnAuthConfirm,
} from "@/src/lib/workforce/staffTenantLinkRepair.server";
import { hashStaffAccessInviteToken } from "@/src/lib/workforce/staffAccessInviteCore";

const DEMO_TENANT = "11111111-1111-4111-8111-111111111111";
const EVOLVED_TENANT = "22222222-2222-4222-8222-222222222222";
const STAFF_MEMBER = "33333333-3333-4333-8333-333333333333";
const FI_STAFF = "44444444-4444-4444-8444-444444444444";
const FI_USER = "55555555-5555-4555-8555-555555555555";
const INVITATION = "66666666-6666-4666-8666-666666666666";
const AUTH_USER = "77777777-7777-4777-8777-777777777777";
const INVITE_TOKEN = "88888888-8888-4888-8888-888888888888";
const EMAIL = "staff@example.com";

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(
  state: TableState,
  authUsers: Record<string, unknown>[] = [],
  rpcHandlers: Record<
    string,
    (
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: null } | { data: null; error: { message: string } }>
  > = {}
): SupabaseClient {
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
    rpc(name: string, args: Record<string, unknown>) {
      const handler = rpcHandlers[name];
      if (!handler) {
        return Promise.resolve({ data: null, error: { message: `Unhandled RPC: ${name}` } });
      }
      return handler(args);
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: {
            user: authUsers.find((u) => u.id === id) ?? null,
          },
          error: null,
        }),
        updateUserById: async (
          id: string,
          payload: { user_metadata?: Record<string, unknown> }
        ) => {
          const user = authUsers.find((u) => u.id === id);
          if (user && payload.user_metadata) {
            user.user_metadata = payload.user_metadata;
          }
          return { data: { user }, error: null };
        },
        listUsers: async () => {
          throw new Error("listUsers must not be used for staff auth email lookup");
        },
        generateLink: async () => ({
          data: {
            user: { id: AUTH_USER },
            properties: { action_link: "https://auth.example.com/magic" },
          },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;
}

test("extractTenantIdFromFiAdminPath reads tenant from next path", () => {
  assert.equal(extractTenantIdFromFiAdminPath(`/fi-admin/${EVOLVED_TENANT}/cases`), EVOLVED_TENANT);
});

test("resolvePreferredLoginTenantId prefers FI membership over stale metadata", () => {
  assert.equal(
    resolvePreferredLoginTenantId({
      nextPathTenantId: DEMO_TENANT,
      metadataTenantId: DEMO_TENANT,
      membershipTenantIds: [EVOLVED_TENANT],
    }),
    EVOLVED_TENANT
  );
});

test("resolvePreferredLoginTenantId honors invite tenant when membership exists there", () => {
  assert.equal(
    resolvePreferredLoginTenantId({
      nextPathTenantId: EVOLVED_TENANT,
      metadataTenantId: DEMO_TENANT,
      membershipTenantIds: [EVOLVED_TENANT, DEMO_TENANT],
    }),
    EVOLVED_TENANT
  );
});

test("shouldPreferMembershipOverMetadata detects stale metadata tenant", () => {
  assert.equal(
    shouldPreferMembershipOverMetadata({
      metadataTenantId: DEMO_TENANT,
      membershipTenantIds: [EVOLVED_TENANT],
    }),
    true
  );
});

test("resolvePostLoginDestination sends multi-tenant users to tenant picker", () => {
  assert.equal(
    resolvePostLoginDestination({
      explicitNext: null,
      membershipTenantIds: [DEMO_TENANT, EVOLVED_TENANT],
      metadataTenantId: DEMO_TENANT,
    }),
    "/fi-admin"
  );
});

test("formatCrossTenantInviteWarning explains existing tenant access", () => {
  const warning = formatCrossTenantInviteWarning({
    email: EMAIL,
    inviteTenantName: "Evolved Clinic",
    otherTenantNames: ["Demo Clinic"],
  });
  assert.match(warning ?? "", /already has Follicle Intelligence access/i);
  assert.match(warning ?? "", /Evolved Clinic/);
});

test("pending_onboarding does not block Staff Access Centre login eligibility", () => {
  assert.equal(blocksStaffAccessLoginForEmploymentStatus("pending_onboarding"), false);
  assert.equal(blocksStaffAccessLoginForEmploymentStatus("terminated"), true);
});

test("repairStaffTenantLinkFromInvitation links fi_staff.fi_user_id for invite tenant", async () => {
  const state: TableState = {
    fi_staff_members: [
      {
        id: STAFF_MEMBER,
        tenant_id: EVOLVED_TENANT,
        full_name: "Alex Staff",
        email: EMAIL,
        fi_staff_id: FI_STAFF,
        role_code: "consultant",
        employment_status: "active",
      },
    ],
    fi_staff: [
      {
        id: FI_STAFF,
        tenant_id: EVOLVED_TENANT,
        fi_user_id: null,
        email: EMAIL,
      },
    ],
    fi_users: [
      {
        id: FI_USER,
        tenant_id: DEMO_TENANT,
        email: EMAIL,
        auth_user_id: AUTH_USER,
      },
    ],
    fi_staff_login_invitations: [
      {
        id: INVITATION,
        tenant_id: EVOLVED_TENANT,
        staff_member_id: STAFF_MEMBER,
        fi_staff_id: FI_STAFF,
        invite_email: EMAIL,
      },
    ],
  };

  const client = makeMockClient(state, [
    {
      id: AUTH_USER,
      email: EMAIL,
      user_metadata: { fi_tenant_id: DEMO_TENANT },
    },
  ]);

  const result = await repairStaffTenantLinkFromInvitation({
    tenantId: EVOLVED_TENANT,
    staffMemberId: STAFF_MEMBER,
    inviteEmail: EMAIL,
    invitationId: INVITATION,
    fiStaffId: FI_STAFF,
    authUserId: AUTH_USER,
    client,
  });

  assert.equal(result.fiStaffId, FI_STAFF);
  const evolvedUser = (state.fi_users ?? []).find((row) => row.tenant_id === EVOLVED_TENANT);
  assert.ok(evolvedUser);
  assert.equal(evolvedUser?.auth_user_id, AUTH_USER);
  const staff = (state.fi_staff ?? []).find((row) => row.id === FI_STAFF);
  assert.equal(staff?.fi_user_id, evolvedUser?.id);
});

test("acceptStaffAccessInvitation repairs tenant linkage from invite token tenant", async () => {
  const tokenHash = hashStaffAccessInviteToken(INVITE_TOKEN);
  const state: TableState = {
    fi_staff_members: [
      {
        id: STAFF_MEMBER,
        tenant_id: EVOLVED_TENANT,
        full_name: "Alex Staff",
        email: EMAIL,
        fi_staff_id: FI_STAFF,
        role_code: "consultant",
        employment_status: "active",
        system_access_revoked: false,
      },
    ],
    fi_staff: [
      {
        id: FI_STAFF,
        tenant_id: EVOLVED_TENANT,
        fi_user_id: null,
        email: EMAIL,
      },
    ],
    fi_users: [],
    fi_staff_login_invitations: [
      {
        id: INVITATION,
        tenant_id: EVOLVED_TENANT,
        staff_member_id: STAFF_MEMBER,
        fi_staff_id: FI_STAFF,
        invite_email: EMAIL,
        invite_token_hash: tokenHash,
        status: "sent",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        auth_invite_link: "https://auth.example.com/invite",
        accepted_at: null,
      },
    ],
    fi_staff_member_audit_events: [],
  };

  const client = makeMockClient(state);

  await acceptStaffAccessInvitation({
    tenantId: EVOLVED_TENANT,
    inviteToken: INVITE_TOKEN,
    client,
  });

  const staff = (state.fi_staff ?? []).find((row) => row.id === FI_STAFF);
  assert.ok(staff?.fi_user_id);
  const evolvedUser = (state.fi_users ?? []).find((row) => row.tenant_id === EVOLVED_TENANT);
  assert.equal(evolvedUser?.email, EMAIL);
  assert.equal(staff?.fi_user_id, evolvedUser?.id);
});

test("repairStaffTenantLinkOnAuthConfirm links existing demo auth user to Evolved invite tenant", async () => {
  const state: TableState = {
    fi_staff_members: [
      {
        id: STAFF_MEMBER,
        tenant_id: EVOLVED_TENANT,
        full_name: "Alex Staff",
        email: EMAIL,
        fi_staff_id: FI_STAFF,
        role_code: "consultant",
        employment_status: "active",
      },
    ],
    fi_staff: [
      {
        id: FI_STAFF,
        tenant_id: EVOLVED_TENANT,
        fi_user_id: null,
        email: EMAIL,
      },
    ],
    fi_users: [
      {
        id: FI_USER,
        tenant_id: DEMO_TENANT,
        email: EMAIL,
        auth_user_id: AUTH_USER,
      },
    ],
    fi_staff_login_invitations: [
      {
        id: INVITATION,
        tenant_id: EVOLVED_TENANT,
        staff_member_id: STAFF_MEMBER,
        fi_staff_id: FI_STAFF,
        invite_email: EMAIL,
        status: "accepted",
        invited_at: new Date().toISOString(),
      },
    ],
  };

  const client = makeMockClient(state, [
    {
      id: AUTH_USER,
      email: EMAIL,
      user_metadata: { fi_tenant_id: DEMO_TENANT },
    },
  ]);

  const result = await repairStaffTenantLinkOnAuthConfirm({
    authUserId: AUTH_USER,
    email: EMAIL,
    nextPath: `/fi-admin/${EVOLVED_TENANT}/cases`,
    client,
  });

  assert.equal(result.repaired, true);
  assert.equal(result.tenantId, EVOLVED_TENANT);
  const evolvedUser = (state.fi_users ?? []).find((row) => row.tenant_id === EVOLVED_TENANT);
  assert.equal(evolvedUser?.auth_user_id, AUTH_USER);
  const staff = (state.fi_staff ?? []).find((row) => row.id === FI_STAFF);
  assert.equal(staff?.fi_user_id, evolvedUser?.id);
});

test("active staff with valid fi_user_id resolves to tenant Today path by default", () => {
  const dest = resolvePostLoginDestination({
    explicitNext: null,
    membershipTenantIds: [EVOLVED_TENANT],
    metadataTenantId: DEMO_TENANT,
  });
  assert.equal(dest, `/fi-admin/${EVOLVED_TENANT}`);
});

test("role home suffix lands reception on Front desk", () => {
  const dest = resolvePostLoginDestination({
    explicitNext: null,
    membershipTenantIds: [EVOLVED_TENANT],
    metadataTenantId: null,
    defaultTenantHomeSuffix: "/front-desk",
  });
  assert.equal(dest, `/fi-admin/${EVOLVED_TENANT}/front-desk`);
});

test("bare tenant explicit next still applies role home suffix", () => {
  const dest = resolvePostLoginDestination({
    explicitNext: `/fi-admin/${EVOLVED_TENANT}`,
    membershipTenantIds: [EVOLVED_TENANT],
    metadataTenantId: null,
    defaultTenantHomeSuffix: "/crm",
  });
  assert.equal(dest, `/fi-admin/${EVOLVED_TENANT}/crm`);
});

test("isBareFiAdminTenantHomePath detects tenant Today only", () => {
  assert.equal(isBareFiAdminTenantHomePath(`/fi-admin/${EVOLVED_TENANT}`), true);
  assert.equal(isBareFiAdminTenantHomePath(`/fi-admin/${EVOLVED_TENANT}/`), true);
  assert.equal(isBareFiAdminTenantHomePath(`/fi-admin/${EVOLVED_TENANT}/crm`), false);
});

test("provisionStaffAuthInviteLink finds existing auth user via RPC", async () => {
  const client = makeMockClient({}, [], {
    fi_admin_lookup_auth_user_id_by_email: async (args) => ({
      data: args._email === EMAIL ? AUTH_USER : null,
      error: null,
    }),
  });

  const result = await provisionStaffAuthInviteLink({
    tenantId: EVOLVED_TENANT,
    email: EMAIL,
    origin: "https://app.example.com",
    client,
  });

  assert.equal(result.authUserId, AUTH_USER);
  assert.equal(result.reusedExistingAuthUser, true);
});

test("provisionStaffAuthInviteLink treats missing RPC auth user as new invite", async () => {
  const client = makeMockClient({}, [], {
    fi_admin_lookup_auth_user_id_by_email: async () => ({
      data: null,
      error: null,
    }),
  });

  const result = await provisionStaffAuthInviteLink({
    tenantId: EVOLVED_TENANT,
    email: EMAIL,
    origin: "https://app.example.com",
    client,
  });

  assert.equal(result.authUserId, AUTH_USER);
  assert.equal(result.reusedExistingAuthUser, false);
});

test("provisionStaffAuthInviteLink rejects RPC failure without creating tenant links", async () => {
  const client = makeMockClient({}, [], {
    fi_admin_lookup_auth_user_id_by_email: async () => ({
      data: null,
      error: { message: "lookup failed" },
    }),
  });

  await assert.rejects(
    () =>
      provisionStaffAuthInviteLink({
        tenantId: EVOLVED_TENANT,
        email: EMAIL,
        origin: "https://app.example.com",
        client,
      }),
    /lookup failed/
  );
});

test("loadCrossTenantInviteWarning resolves auth user through RPC", async () => {
  const state: TableState = {
    fi_users: [
      {
        id: FI_USER,
        tenant_id: DEMO_TENANT,
        email: EMAIL,
        auth_user_id: AUTH_USER,
      },
    ],
    fi_tenants: [
      { id: DEMO_TENANT, name: "Demo Clinic" },
      { id: EVOLVED_TENANT, name: "Evolved Clinic" },
    ],
  };

  const client = makeMockClient(state, [], {
    fi_admin_lookup_auth_user_id_by_email: async (args) => ({
      data: args._email === EMAIL ? AUTH_USER : null,
      error: null,
    }),
  });

  const warning = await loadCrossTenantInviteWarning({
    tenantId: EVOLVED_TENANT,
    email: EMAIL,
    client,
  });

  assert.match(warning ?? "", /already has Follicle Intelligence access/i);
});
