import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FiNexusExternalProfessionalRow,
  FiNexusRoleAssignmentRow,
  FiNexusStaffProfileRow,
  FiNexusTenantMembershipRow,
} from "@/src/lib/nexus/nexusProvisioningTypes";

type AuditRow = {
  id: string;
  global_professional_id: string;
  action_type: string;
  payload: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  result: string;
  failure_reason: string | null;
  created_at: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export type NexusTestStore = {
  tenants: Set<string>;
  clinics: Map<string, { tenant_id: string }>;
  professionals: Map<string, FiNexusExternalProfessionalRow>;
  memberships: Map<string, FiNexusTenantMembershipRow>;
  staffProfiles: Map<string, FiNexusStaffProfileRow>;
  roles: Map<string, FiNexusRoleAssignmentRow>;
  audits: AuditRow[];
  client: SupabaseClient;
};

function membershipKey(globalId: string, tenantId: string): string {
  return `${globalId}::${tenantId}`;
}

function staffKey(globalId: string, tenantId: string): string {
  return `${globalId}::${tenantId}`;
}

function roleKey(globalId: string, tenantId: string, roleCode: string): string {
  return `${globalId}::${tenantId}::${roleCode}`;
}

export function createNexusTestStore(tenantId: string, siteId?: string): NexusTestStore {
  const store: NexusTestStore = {
    tenants: new Set([tenantId]),
    clinics: new Map(siteId ? [[siteId, { tenant_id: tenantId }]] : []),
    professionals: new Map(),
    memberships: new Map(),
    staffProfiles: new Map(),
    roles: new Map(),
    audits: [],
    client: null as unknown as SupabaseClient,
  };

  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let opts: { count?: string; head?: boolean } | undefined;
    let pendingUpdate: Record<string, unknown> | null = null;
    let queryMode: "select" | "update" = "select";

    const api = {
      select(_cols: string, selectOpts?: { count?: string; head?: boolean }) {
        queryMode = "select";
        opts = selectOpts;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        return api;
      },
      maybeSingle: async () => {
        const result = resolveOne(table, filters);
        filters.length = 0;
        queryMode = "select";
        pendingUpdate = null;
        return result;
      },
      single: async () => {
        const result = resolveOne(table, filters);
        filters.length = 0;
        queryMode = "select";
        pendingUpdate = null;
        if (result.error) return result;
        if (!result.data) return { data: null, error: { message: "not found" } };
        return result;
      },
      insert: async (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(row) ? row : [row];
        for (const r of rows) {
          insertRow(table, r);
        }
        filters.length = 0;
        return { data: rows, error: null };
      },
      upsert: async (row: Record<string, unknown>, onConflictOpts?: { onConflict?: string }) => {
        upsertRow(table, row, onConflictOpts?.onConflict ?? "");
        filters.length = 0;
        return { data: row, error: null };
      },
      update(patch: Record<string, unknown>) {
        pendingUpdate = patch;
        queryMode = "update";
        return api;
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        if (queryMode === "update" && pendingUpdate) {
          updateRows(table, filters, pendingUpdate);
          filters.length = 0;
          pendingUpdate = null;
          queryMode = "select";
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        }
        return Promise.resolve(resolveMany(table, filters, opts)).then(onFulfilled, onRejected);
      },
    };

    return api;
  };

  function resolveOne(table: string, filters: [string, unknown][]) {
    if (table === "fi_tenants") {
      const id = filters.find(([c]) => c === "id")?.[1] as string;
      return store.tenants.has(id) ? { data: { id }, error: null } : { data: null, error: null };
    }
    if (table === "fi_clinics") {
      const id = filters.find(([c]) => c === "id")?.[1] as string;
      const tenant_id = filters.find(([c]) => c === "tenant_id")?.[1] as string;
      const clinic = store.clinics.get(id);
      if (clinic && clinic.tenant_id === tenant_id) return { data: { id }, error: null };
      return { data: null, error: null };
    }
    if (table === "fi_nexus_external_professionals") {
      const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string;
      const row = store.professionals.get(gid) ?? null;
      return { data: row, error: null };
    }
    if (table === "fi_nexus_tenant_memberships") {
      const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string;
      const tenant_id = filters.find(([c]) => c === "tenant_id")?.[1] as string | undefined;
      if (tenant_id) {
        return { data: store.memberships.get(membershipKey(gid, tenant_id)) ?? null, error: null };
      }
    }
    if (table === "fi_nexus_staff_profiles") {
      const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string;
      const tenant_id = filters.find(([c]) => c === "tenant_id")?.[1] as string | undefined;
      if (tenant_id) {
        return { data: store.staffProfiles.get(staffKey(gid, tenant_id)) ?? null, error: null };
      }
    }
    if (table === "fi_nexus_role_assignments") {
      const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string;
      const tenant_id = filters.find(([c]) => c === "tenant_id")?.[1] as string | undefined;
      const role_code = filters.find(([c]) => c === "role_code")?.[1] as string | undefined;
      if (gid && tenant_id && role_code) {
        return { data: store.roles.get(roleKey(gid, tenant_id, role_code)) ?? null, error: null };
      }
    }
    return { data: null, error: null };
  }

  function resolveMany(table: string, filters: [string, unknown][], selectOpts?: { count?: string; head?: boolean }) {
    if (table === "fi_nexus_provisioning_audit" && selectOpts?.head) {
      const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string;
      const count = store.audits.filter((a) => a.global_professional_id === gid).length;
      return { count, error: null };
    }

    const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string | undefined;
    const active = filters.find(([c]) => c === "active")?.[1];

    if (table === "fi_nexus_tenant_memberships" && gid) {
      const rows = [...store.memberships.values()].filter((r) => r.global_professional_id === gid);
      return { data: rows, error: null };
    }
    if (table === "fi_nexus_staff_profiles" && gid) {
      const rows = [...store.staffProfiles.values()].filter((r) => r.global_professional_id === gid);
      return { data: rows, error: null };
    }
    if (table === "fi_nexus_role_assignments" && gid) {
      let rows = [...store.roles.values()].filter((r) => r.global_professional_id === gid);
      if (active !== undefined) rows = rows.filter((r) => r.active === active);
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  }

  function insertRow(table: string, row: Record<string, unknown>) {
    if (table === "fi_nexus_role_assignments") {
      const gid = String(row.global_professional_id);
      const tenant_id = String(row.tenant_id);
      const role_code = String(row.role_code);
      const id = newId();
      const created: FiNexusRoleAssignmentRow = {
        id,
        global_professional_id: gid,
        tenant_id,
        role_code,
        assigned_by: String(row.assigned_by ?? "nexus"),
        active: Boolean(row.active ?? true),
        nexus_created: Boolean(row.nexus_created ?? true),
        created_at: nowIso(),
        revoked_at: (row.revoked_at as string | null) ?? null,
      };
      store.roles.set(roleKey(gid, tenant_id, role_code), created);
    }
    if (table === "fi_nexus_provisioning_audit") {
      store.audits.push({
        id: newId(),
        global_professional_id: String(row.global_professional_id),
        action_type: String(row.action_type),
        payload: (row.payload as Record<string, unknown>) ?? null,
        before_state: (row.before_state as Record<string, unknown>) ?? null,
        after_state: (row.after_state as Record<string, unknown>) ?? null,
        result: String(row.result),
        failure_reason: (row.failure_reason as string | null) ?? null,
        created_at: nowIso(),
      });
    }
  }

  function upsertRow(table: string, row: Record<string, unknown>, onConflict: string) {
    const ts = nowIso();
    if (table === "fi_nexus_external_professionals") {
      const gid = String(row.global_professional_id);
      const existing = store.professionals.get(gid);
      const next: FiNexusExternalProfessionalRow = {
        id: existing?.id ?? newId(),
        global_professional_id: gid,
        source_system: String(row.source_system ?? "iiohr"),
        email: String(row.email),
        name: (row.name as string | null) ?? null,
        professional_type: String(row.professional_type),
        certification_level: (row.certification_level as string | null) ?? null,
        deployment_ready: Boolean(row.deployment_ready ?? false),
        nexus_created: Boolean(row.nexus_created ?? true),
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.professionals.set(gid, next);
    }
    if (table === "fi_nexus_tenant_memberships") {
      const gid = String(row.global_professional_id);
      const tenant_id = String(row.tenant_id);
      const key = membershipKey(gid, tenant_id);
      const existing = store.memberships.get(key);
      const next: FiNexusTenantMembershipRow = {
        id: existing?.id ?? newId(),
        global_professional_id: gid,
        tenant_id,
        site_id: (row.site_id as string | null) ?? null,
        membership_status: String(row.membership_status ?? "pending"),
        nexus_created: Boolean(row.nexus_created ?? true),
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.memberships.set(key, next);
    }
    if (table === "fi_nexus_staff_profiles") {
      const gid = String(row.global_professional_id);
      const tenant_id = String(row.tenant_id);
      const key = staffKey(gid, tenant_id);
      const existing = store.staffProfiles.get(key);
      const next: FiNexusStaffProfileRow = {
        id: existing?.id ?? newId(),
        global_professional_id: gid,
        tenant_id,
        site_id: (row.site_id as string | null) ?? null,
        staff_type: String(row.staff_type),
        display_name: (row.display_name as string | null) ?? null,
        email: String(row.email),
        active: row.active !== undefined ? Boolean(row.active) : (existing?.active ?? false),
        nexus_created: Boolean(row.nexus_created ?? true),
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.staffProfiles.set(key, next);
    }
    void onConflict;
  }

  function updateRows(table: string, filters: [string, unknown][], patch: Record<string, unknown>) {
    const gid = filters.find(([c]) => c === "global_professional_id")?.[1] as string | undefined;
    const tenant_id = filters.find(([c]) => c === "tenant_id")?.[1] as string | undefined;
    const row_id = filters.find(([c]) => c === "id")?.[1] as string | undefined;
    const nexus_created = filters.find(([c]) => c === "nexus_created")?.[1];
    const activeFilter = filters.find(([c]) => c === "active")?.[1];

    if (table === "fi_nexus_role_assignments") {
      for (const [key, row] of store.roles) {
        if (row_id && row.id !== row_id) continue;
        if (gid && row.global_professional_id !== gid) continue;
        if (tenant_id && row.tenant_id !== tenant_id) continue;
        if (nexus_created !== undefined && row.nexus_created !== nexus_created) continue;
        if (activeFilter !== undefined && row.active !== activeFilter) continue;
        store.roles.set(key, {
          ...row,
          active: patch.active !== undefined ? Boolean(patch.active) : row.active,
          revoked_at: (patch.revoked_at as string | null) ?? row.revoked_at,
        });
      }
    }
    if (table === "fi_nexus_staff_profiles" && tenant_id && gid) {
      const key = staffKey(gid, tenant_id);
      const row = store.staffProfiles.get(key);
      if (row && (nexus_created === undefined || row.nexus_created === nexus_created)) {
        store.staffProfiles.set(key, {
          ...row,
          active: patch.active !== undefined ? Boolean(patch.active) : row.active,
          updated_at: nowIso(),
        });
      }
    }
    if (table === "fi_nexus_tenant_memberships" && tenant_id && gid) {
      const key = membershipKey(gid, tenant_id);
      const row = store.memberships.get(key);
      if (row && (nexus_created === undefined || row.nexus_created === nexus_created)) {
        store.memberships.set(key, {
          ...row,
          membership_status: String(patch.membership_status ?? row.membership_status),
          updated_at: nowIso(),
        });
      }
    }
    return 1;
  }

  store.client = { from } as unknown as SupabaseClient;
  return store;
}

export function nexusTestDeps(store: NexusTestStore) {
  return {
    assertTenantExists: async (tenantId: string) => store.tenants.has(tenantId),
    assertSiteBelongsToTenant: async (siteId: string, tenantId: string) => {
      const clinic = store.clinics.get(siteId);
      return Boolean(clinic && clinic.tenant_id === tenantId);
    },
  };
}
