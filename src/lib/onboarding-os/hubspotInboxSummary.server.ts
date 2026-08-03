import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type HubspotInboxSummary = {
  isConnected: boolean;
  pendingCount: number;
  integrationId: string | null;
};

/**
 * Lightweight HubSpot connection + approved-staging pending count for Settings cards and nav badges.
 * Does not run full import previews / duplicate checks.
 */
export async function loadHubspotInboxSummary(tenantId: string): Promise<HubspotInboxSummary> {
  const tid = tenantId.trim();
  if (!tid) {
    return { isConnected: false, pendingCount: 0, integrationId: null };
  }

  try {
    const supabase = supabaseAdmin();
    const { data: integration, error: ie } = await supabase
      .from("fi_tenant_external_integrations")
      .select("id")
      .eq("tenant_id", tid)
      .eq("provider", "hubspot")
      .neq("status", "disabled")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ie || !integration) {
      return { isConnected: false, pendingCount: 0, integrationId: null };
    }

    const iid = String((integration as { id: string }).id);

    const [contacts, deals] = await Promise.all([
      supabase
        .from("fi_external_hubspot_contact_staging")
        .select("id", { count: "exact", head: true })
        .eq("integration_id", iid)
        .eq("tenant_id", tid)
        .eq("import_status", "approved"),
      supabase
        .from("fi_external_hubspot_deal_staging")
        .select("id", { count: "exact", head: true })
        .eq("integration_id", iid)
        .eq("tenant_id", tid)
        .eq("import_status", "approved"),
    ]);

    const pendingCount = (contacts.count ?? 0) + (deals.count ?? 0);
    return { isConnected: true, pendingCount, integrationId: iid };
  } catch (e) {
    console.error("[loadHubspotInboxSummary]", e);
    return { isConnected: false, pendingCount: 0, integrationId: null };
  }
}
