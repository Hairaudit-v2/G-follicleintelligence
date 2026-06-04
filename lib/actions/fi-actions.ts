"use server";

/**
 * Server actions for Follicle Intelligence.
 * Use for form submissions and client-triggered mutations.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { backfillFoundationFromProcessedEvents } from "@/src/lib/fi/foundation/backfillFoundation";

export async function getTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin()
    .from("fi_tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Admin-only: replay foundation dual-write for a batch of processed fi_events
 * that have no fi_timeline_events row with matching fi_event_id.
 * Requires env `FI_ADMIN_API_KEY`; pass the same value as `adminKey` from the admin UI.
 */
export async function backfillFoundationFromProcessedEventsAction(
  tenantId: string,
  adminKey: string
): Promise<
  | { ok: true; scanned: number; attempted: number; succeeded: number; skipped: number; failed: number; errors: string[] }
  | { ok: false; error: string }
> {
  const expected = process.env.FI_ADMIN_API_KEY?.trim();
  if (!expected) {
    return { ok: false, error: "FI_ADMIN_API_KEY is not configured on the server." };
  }
  if (!adminKey || adminKey.trim() !== expected) {
    return { ok: false, error: "Invalid or missing admin key." };
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId.trim()).maybeSingle();
  if (te) return { ok: false, error: te.message };
  if (!tenant) return { ok: false, error: "Tenant not found." };

  try {
    const result = await backfillFoundationFromProcessedEvents({ tenantId: tenantId.trim(), batchSize: 50, client: supabase });
    return { ok: true, ...result };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Backfill failed." };
  }
}

