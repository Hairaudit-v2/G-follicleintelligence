import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type FiPartnerCreateSuccess = {
  ok: true;
  partner: {
    id: string;
    name: string;
    reference_code: string;
    created_at: string;
  };
};

export type FiPartnerCreateFailure = {
  ok: false;
  status: number;
  error: string;
};

export type FiPartnerCreateResult = FiPartnerCreateSuccess | FiPartnerCreateFailure;

/**
 * Shared create-partner logic for legacy `/api/fi/partners` and signed `/api/ingest/[tenantId]/partners`.
 */
export async function createFiPartnerFromBody(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<FiPartnerCreateResult> {
  const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id.trim() : null;
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const reference_code = typeof body.reference_code === "string" ? body.reference_code.trim() : null;

  if (!tenant_id || !name || !reference_code) {
    return {
      ok: false,
      status: 400,
      error: "tenant_id, name, and reference_code are required.",
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(reference_code)) {
    return {
      ok: false,
      status: 400,
      error: "reference_code must be alphanumeric, underscore, or hyphen.",
    };
  }

  const { data: tenant } = await supabase.from("fi_tenants").select("id").eq("id", tenant_id).single();
  if (!tenant) {
    return { ok: false, status: 404, error: "Tenant not found." };
  }

  const slug =
    typeof body.slug === "string" ? body.slug.trim() || null : body.slug === null || body.slug === undefined ? null : null;
  const metadata =
    body.metadata !== undefined && body.metadata !== null && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  const { data: partner, error } = await supabase
    .from("fi_partners")
    .insert({
      tenant_id,
      name,
      reference_code,
      slug,
      metadata,
    })
    .select("id, name, reference_code, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        status: 409,
        error: "Partner with this reference_code already exists for tenant.",
      };
    }
    return { ok: false, status: 500, error: error.message };
  }

  if (!partner) {
    return { ok: false, status: 500, error: "Failed to create partner." };
  }

  return {
    ok: true,
    partner: {
      id: partner.id,
      name: partner.name,
      reference_code: partner.reference_code,
      created_at: partner.created_at,
    },
  };
}
