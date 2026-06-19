import "server-only";

import { notFound } from "next/navigation";

import { ENTERPRISE_DEMO_TENANT_SLUG } from "./enterpriseDemoConstants";
import { loadGlobalCommandCentrePayload } from "./enterpriseDemoGlobalCommandCentreLoader.server";
import { resolveEnterpriseDemoTenant } from "./enterpriseDemoTenantAccess.server";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { isNonEmptyUuid } from "@/src/lib/crm/validation";

export type GlobalCommandCentrePageResult =
  | { ok: true; tenantKey: string; data: Awaited<ReturnType<typeof loadGlobalCommandCentrePayload>> }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "misconfigured" }
  | { ok: false; kind: "load_failed"; message: string };

export async function resolveGlobalCommandCentrePage(tenantId: string): Promise<GlobalCommandCentrePageResult> {
  const key = tenantId?.trim();
  if (!key) return { ok: false, kind: "not_found" };

  if (!isNonEmptyUuid(key) && key !== ENTERPRISE_DEMO_TENANT_SLUG) {
    return { ok: false, kind: "not_found" };
  }

  if (key === ENTERPRISE_DEMO_TENANT_SLUG) {
    return { ok: false, kind: "not_found" };
  }

  await assertFiTenantPortalAccessUnlessStaffPinSession(key);

  const demoTenant = await resolveEnterpriseDemoTenant(key);
  if (!demoTenant) return { ok: false, kind: "not_found" };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { ok: false, kind: "misconfigured" };
  }

  try {
    const data = await loadGlobalCommandCentrePayload(key, new Date());
    return { ok: true, tenantKey: key, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") return { ok: false, kind: "not_found" };
    console.error("[resolveGlobalCommandCentrePage]", msg || "load failed");
    return { ok: false, kind: "load_failed", message: msg || "load failed" };
  }
}

export function assertGlobalCommandCentrePage(result: GlobalCommandCentrePageResult): asserts result is {
  ok: true;
  tenantKey: string;
  data: Awaited<ReturnType<typeof loadGlobalCommandCentrePayload>>;
} {
  if (result.ok) return;
  if (result.kind === "not_found") notFound();
  throw new Error(result.kind === "load_failed" ? result.message : "Global Command Centre unavailable");
}
