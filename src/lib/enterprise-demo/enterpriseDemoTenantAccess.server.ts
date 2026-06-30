import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  ENTERPRISE_DEMO_TENANT_SLUG,
  isEnterpriseDemoTenantMetadata,
} from "./enterpriseDemoConstants";

export type ResolvedEnterpriseDemoTenant = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

async function loadTenantSettingsMetadata(
  tenantId: string
): Promise<Record<string, unknown> | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const raw = (data as { metadata?: unknown } | null)?.metadata;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * Resolves the IHRG enterprise demo tenant by UUID or slug.
 * Returns null when the tenant does not exist or is not the demo tenant.
 */
export async function resolveEnterpriseDemoTenant(
  tenantIdOrSlug: string
): Promise<ResolvedEnterpriseDemoTenant | null> {
  const key = tenantIdOrSlug.trim();
  if (!key) return null;

  const supabase = supabaseAdmin();
  const query = isNonEmptyUuid(key)
    ? supabase.from("fi_tenants").select("id, name, slug").eq("id", key).maybeSingle()
    : supabase.from("fi_tenants").select("id, name, slug").eq("slug", key).maybeSingle();

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as { id: string; name: string; slug: string };
  const tenantId = String(row.id);
  const tenantSlug = String(row.slug ?? "").trim();
  const tenantName = String(row.name ?? "").trim() || ENTERPRISE_DEMO_TENANT_SLUG;

  if (tenantSlug !== ENTERPRISE_DEMO_TENANT_SLUG) return null;

  const metadata = await loadTenantSettingsMetadata(tenantId);
  if (!isEnterpriseDemoTenantMetadata(metadata)) return null;

  return { tenantId, tenantSlug, tenantName };
}
