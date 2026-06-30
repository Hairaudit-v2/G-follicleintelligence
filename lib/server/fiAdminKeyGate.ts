import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiAdminApiKeyMatch } from "@/src/lib/crm/crmFiAdminApiKeyMatch";

/** UUID v4-style validation (aligned with FI configuration actions). */
export const FI_ADMIN_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isFiAdminUuid(v: string): boolean {
  return FI_ADMIN_UUID_RE.test(v.trim());
}

export function requireFiAdminKey(adminKey: string): { ok: true } | { ok: false; error: string } {
  const expected = process.env.FI_ADMIN_API_KEY?.trim();
  if (!expected) {
    return { ok: false, error: "FI_ADMIN_API_KEY is not configured on the server." };
  }
  if (!isFiAdminApiKeyMatch(adminKey, expected)) {
    return { ok: false, error: "Invalid or missing admin key." };
  }
  return { ok: true };
}

export async function assertFiTenantExists(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tid)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not verify tenant." };
  if (!data) return { ok: false, error: "Tenant not found." };
  return { ok: true };
}
