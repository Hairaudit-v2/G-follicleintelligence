import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadConsultationLinkSearchResults } from "@/src/lib/consultations/consultationLinkSearchLoader.server";

const MAX = 20;

export type ExpenseLinkLeadHit = {
  id: string;
  name: string;
  stageLabel: string;
  email: string | null;
};

export type ExpenseLinkCaseHit = {
  id: string;
  label: string;
  status: string;
  treatment_type: string | null;
};

export type ExpenseEntitySearchPayload = {
  leads: ExpenseLinkLeadHit[];
  cases: ExpenseLinkCaseHit[];
  campaign_keys: string[];
};

function uuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

/**
 * Tenant-scoped search for linking expenses to leads/cases + campaign key suggestions.
 */
export async function searchExpenseLinkEntities(
  tenantId: string,
  queryRaw: string
): Promise<ExpenseEntitySearchPayload> {
  const tid = tenantId.trim();
  const query = queryRaw.trim().slice(0, 120);
  if (!tid) {
    return { leads: [], cases: [], campaign_keys: [] };
  }

  const supabase = supabaseAdmin();

  // Campaign suggestions: recent distinct non-empty keys (optionally filtered).
  const { data: campRows, error: campErr } = await supabase
    .from("fi_expenses")
    .select("campaign_key")
    .eq("tenant_id", tid)
    .not("campaign_key", "is", null)
    .neq("campaign_key", "")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (campErr) throw new Error(campErr.message);

  const campaignSet = new Set<string>();
  for (const raw of campRows ?? []) {
    const k = String((raw as { campaign_key?: string | null }).campaign_key ?? "").trim();
    if (!k) continue;
    if (query && !k.toLowerCase().includes(query.toLowerCase())) continue;
    campaignSet.add(k);
    if (campaignSet.size >= MAX) break;
  }
  const campaign_keys = [...campaignSet];

  if (!query) {
    return { leads: [], cases: [], campaign_keys };
  }

  // Leads via existing consultation link search (CRM access aware).
  const linkSearch = await loadConsultationLinkSearchResults(tid, query);
  const leads: ExpenseLinkLeadHit[] = linkSearch.leads.slice(0, MAX).map((l) => ({
    id: l.id,
    name: l.name,
    stageLabel: l.stageLabel,
    email: l.email,
  }));

  // Cases: exact UUID match, else filter recent rows in memory (safe for short search UX).
  let cases: ExpenseLinkCaseHit[] = [];
  if (uuidLike(query)) {
    const { data, error } = await supabase
      .from("fi_cases")
      .select("id, status, treatment_type, external_id")
      .eq("tenant_id", tid)
      .eq("id", query.trim())
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const r = data as {
        id: string;
        status: string | null;
        treatment_type: string | null;
        external_id: string | null;
      };
      cases = [
        {
          id: String(r.id),
          label: r.external_id?.trim() || r.treatment_type?.trim() || String(r.id).slice(0, 8),
          status: String(r.status ?? ""),
          treatment_type: r.treatment_type?.trim() || null,
        },
      ];
    }
  } else {
    const recent = await supabase
      .from("fi_cases")
      .select("id, status, treatment_type, external_id")
      .eq("tenant_id", tid)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(120);
    if (recent.error) throw new Error(recent.error.message);
    const qLower = query.toLowerCase();
    cases = (recent.data ?? [])
      .map((raw) => {
        const r = raw as {
          id: string;
          status: string | null;
          treatment_type: string | null;
          external_id: string | null;
        };
        const treatment = r.treatment_type?.trim() || null;
        const external = r.external_id?.trim() || null;
        const hay = `${treatment ?? ""} ${external ?? ""} ${r.id}`.toLowerCase();
        if (!hay.includes(qLower)) return null;
        return {
          id: String(r.id),
          label: external || treatment || String(r.id).slice(0, 8),
          status: String(r.status ?? ""),
          treatment_type: treatment,
        } satisfies ExpenseLinkCaseHit;
      })
      .filter((x): x is ExpenseLinkCaseHit => x != null)
      .slice(0, MAX);
  }

  return { leads, cases, campaign_keys };
}

/** Load recent campaign keys without a search query (for datalist). */
export async function loadRecentExpenseCampaignKeys(
  tenantId: string,
  limit = 30
): Promise<string[]> {
  const tid = tenantId.trim();
  if (!tid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_expenses")
    .select("campaign_key")
    .eq("tenant_id", tid)
    .not("campaign_key", "is", null)
    .neq("campaign_key", "")
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit * 3, 30), 120));
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  for (const raw of data ?? []) {
    const k = String((raw as { campaign_key?: string | null }).campaign_key ?? "").trim();
    if (k) seen.add(k);
    if (seen.size >= limit) break;
  }
  return [...seen];
}
