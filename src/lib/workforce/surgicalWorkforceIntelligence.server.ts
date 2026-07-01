import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type SurgeryCaseLinkMap = Record<string, string | null>;

export async function loadSurgeryCaseLinks(
  tenantId: string,
  surgeryIds: string[],
  client?: SupabaseClient
): Promise<SurgeryCaseLinkMap> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const uniqueIds = Array.from(new Set(surgeryIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgeries")
    .select("id, case_id")
    .eq("tenant_id", tid)
    .in("id", uniqueIds);

  if (error) {
    if (error.message?.includes("does not exist")) return {};
    throw new Error(error.message);
  }

  const links: SurgeryCaseLinkMap = {};
  for (const row of data ?? []) {
    const id = String((row as { id: string }).id);
    const caseId = (row as { case_id: string | null }).case_id;
    links[id] = caseId != null ? String(caseId) : null;
  }
  return links;
}