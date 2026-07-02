import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PathologyEmailRouteRow } from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import {
  buildEvolvedPathologyInboundEmail,
  EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL,
  EVOLVED_PATHOLOGY_EMAIL_TENANT_SLUG,
  normalizePathologyInboundEmail,
  readPathologyEmailInboundDomainFromEnv,
} from "@/src/lib/pathology/email/pathologyEmailRoutesCore";
import { createPathologyEmailRoute } from "@/src/lib/pathology/email/pathologyEmailRoutesMutations.server";

export type SeedEvolvedPathologyEmailRouteResult = {
  created: boolean;
  route: PathologyEmailRouteRow | null;
  skippedReason?: string;
};

async function resolveTenantIdBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("slug", slug.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return String((data as { id: string }).id);
}

async function findRouteByEmail(
  supabase: SupabaseClient,
  inboundEmail: string
): Promise<PathologyEmailRouteRow | null> {
  const normalized = normalizePathologyInboundEmail(inboundEmail);
  const { data, error } = await supabase
    .from("fi_pathology_email_routes")
    .select("*")
    .ilike("inbound_email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    inbound_email: String(row.inbound_email),
    route_status: String(row.route_status) as PathologyEmailRouteRow["route_status"],
    source_label: row.source_label != null ? String(row.source_label) : null,
    default_source_channel: String(
      row.default_source_channel ?? "email"
    ) as PathologyEmailRouteRow["default_source_channel"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Idempotent seed: resolves tenant by slug `evolved-hair`, never hard-codes tenant UUID. */
export async function seedEvolvedPathologyEmailRoute(options?: {
  inboundDomain?: string;
  client?: SupabaseClient;
}): Promise<SeedEvolvedPathologyEmailRouteResult> {
  const supabase = options?.client ?? supabaseAdmin();
  const tenantId = await resolveTenantIdBySlug(supabase, EVOLVED_PATHOLOGY_EMAIL_TENANT_SLUG);
  if (!tenantId) {
    return {
      created: false,
      route: null,
      skippedReason: `Tenant slug ${EVOLVED_PATHOLOGY_EMAIL_TENANT_SLUG} not found.`,
    };
  }

  const inboundDomain =
    options?.inboundDomain?.trim() || readPathologyEmailInboundDomainFromEnv();
  if (!inboundDomain) {
    return {
      created: false,
      route: null,
      skippedReason: "PATHOLOGY_EMAIL_INBOUND_DOMAIN is not configured.",
    };
  }

  const inboundEmail = buildEvolvedPathologyInboundEmail(inboundDomain);
  const existing = await findRouteByEmail(supabase, inboundEmail);
  if (existing) {
    return { created: false, route: existing };
  }

  const route = await createPathologyEmailRoute(
    {
      tenantId,
      inboundEmail,
      sourceLabel: EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL,
      routeStatus: "active",
    },
    supabase
  );

  return { created: true, route };
}
