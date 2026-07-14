import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "./platformTenantProvisionGate";
import { insertFiPlatformTenantAuditEvent } from "./platformTenantAudit.server";
import {
  canArchiveTenant,
  filterPlatformTenantList,
  groupPlatformTenantsForAdminUi,
  shouldShowTenantHomeLink,
  type FiPlatformTenantLifecycleRow,
} from "./platformTenantLifecycleCore";
import { PRODUCTION_TENANT_SLUG } from "./platformTenantLifecycleConstants";

const EVOLVED_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const DEMO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OLD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function row(
  partial: Partial<FiPlatformTenantLifecycleRow> & Pick<FiPlatformTenantLifecycleRow, "id" | "slug">
): FiPlatformTenantLifecycleRow {
  return {
    name: partial.name ?? partial.slug,
    created_at: "2026-01-01",
    archived_at: null,
    archived_by: null,
    archive_reason: null,
    is_demo: false,
    is_production_visible: true,
    ...partial,
  };
}

const ACTIVE_PRODUCTION = row({
  id: EVOLVED_ID,
  slug: PRODUCTION_TENANT_SLUG,
  name: "Evolved Hair Restoration",
});

const DEMO = row({
  id: DEMO_ID,
  slug: "acme-demo",
  name: "Demo Clinic",
  is_demo: true,
  is_production_visible: false,
});

const ARCHIVED = row({
  id: OLD_ID,
  slug: "evolved",
  name: "Evolved Hair Clinics",
  archived_at: "2026-06-01T00:00:00Z",
  archive_reason: "Superseded by evolved-hair",
  is_production_visible: false,
});

test("filterPlatformTenantList: hides archived by default", () => {
  const filtered = filterPlatformTenantList([ACTIVE_PRODUCTION, DEMO, ARCHIVED]);
  assert.deepEqual(
    filtered.map((t) => t.slug),
    [PRODUCTION_TENANT_SLUG]
  );
});

test("filterPlatformTenantList: includeArchived=true shows archived tenants", () => {
  const filtered = filterPlatformTenantList([ACTIVE_PRODUCTION, ARCHIVED], {
    includeArchived: true,
    includeDemo: true,
    includeHidden: true,
  });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.some((t) => t.slug === "evolved"));
});

test("filterPlatformTenantList: demo tenants grouped/hidden correctly", () => {
  const withoutDemo = filterPlatformTenantList([ACTIVE_PRODUCTION, DEMO]);
  assert.deepEqual(
    withoutDemo.map((t) => t.slug),
    [PRODUCTION_TENANT_SLUG]
  );

  const withDemo = filterPlatformTenantList([ACTIVE_PRODUCTION, DEMO], {
    includeDemo: true,
    includeHidden: true,
  });
  assert.equal(withDemo.length, 2);
});

test("filterPlatformTenantList: production-visible showcase demos appear even when includeDemo=false", () => {
  const showcaseDemo = row({
    id: DEMO_ID,
    slug: "ihrg-global",
    name: "International Hair Restoration Group",
    is_demo: true,
    is_production_visible: true,
  });
  const filtered = filterPlatformTenantList([ACTIVE_PRODUCTION, showcaseDemo], {
    includeDemo: false,
    includeHidden: false,
  });
  assert.deepEqual(
    filtered.map((t) => t.slug).sort(),
    [PRODUCTION_TENANT_SLUG, "ihrg-global"].sort()
  );
});

test("groupPlatformTenantsForAdminUi: separates production, demo, archived", () => {
  const groups = groupPlatformTenantsForAdminUi([ACTIVE_PRODUCTION, DEMO, ARCHIVED]);
  assert.equal(groups.production.length, 1);
  assert.equal(groups.demo.length, 1);
  assert.equal(groups.archived.length, 1);
});

test("shouldShowTenantHomeLink: not shown for archived or hidden demo tenant", () => {
  assert.equal(shouldShowTenantHomeLink(ARCHIVED), false);
  assert.equal(shouldShowTenantHomeLink(ACTIVE_PRODUCTION), true);
  assert.equal(shouldShowTenantHomeLink(DEMO), false);
});

test("canArchiveTenant: active production tenant cannot be archived accidentally", () => {
  const gate = canArchiveTenant({
    tenant: ACTIVE_PRODUCTION,
    actorActiveTenantIds: [EVOLVED_ID, DEMO_ID],
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) assert.match(gate.reason, /protected/i);
});

test("canArchiveTenant: blocks only active session tenant", () => {
  const gate = canArchiveTenant({
    tenant: DEMO,
    actorActiveTenantIds: [DEMO_ID],
    sessionActiveTenantId: DEMO_ID,
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) assert.match(gate.reason, /only active tenant/i);
});

test("canArchiveTenant: allows demo archive when not sole session tenant", () => {
  const gate = canArchiveTenant({
    tenant: DEMO,
    actorActiveTenantIds: [EVOLVED_ID, DEMO_ID],
    sessionActiveTenantId: EVOLVED_ID,
  });
  assert.equal(gate.ok, true);
});

test("archive action requires platform admin role", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_platform_admin"), true);
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_admin"), false);
});

test("restore action requires platform admin role", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_auditor"), false);
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_platform_admin"), true);
});

test("insertFiPlatformTenantAuditEvent: writes tenant.archived audit log", async () => {
  const inserts: Record<string, unknown>[] = [];
  const mock = {
    from(table: string) {
      assert.equal(table, "fi_platform_tenant_audit_events");
      return {
        insert(row: Record<string, unknown>) {
          inserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;

  const res = await insertFiPlatformTenantAuditEvent(
    {
      tenantId: DEMO_ID,
      eventKind: "tenant.archived",
      actorAuthUserId: "auth-platform-admin",
      detail: { slug: "acme-demo", reason: "Demo cleanup" },
    },
    { supabaseClientForTests: mock }
  );

  assert.equal(res.ok, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]?.event_kind, "tenant.archived");
  assert.equal(inserts[0]?.tenant_id, DEMO_ID);
});
