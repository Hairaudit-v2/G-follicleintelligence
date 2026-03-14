"use server";

/**
 * Server actions for Follicle Intelligence.
 * Use for form submissions and client-triggered mutations.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin()
    .from("fi_tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
