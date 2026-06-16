import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type CaseCrmQuoteRow = {
  id: string;
  tenant_id: string;
  consultation_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  status: string;
  line_items_snapshot: unknown;
  metadata: Record<string, unknown>;
  valid_until: string | null;
  sent_at: string | null;
  responded_at: string | null;
  subtotal_amount: number | null;
  total_amount: number | null;
  updated_at: string;
};

export async function loadCrmQuotesForCase(tenantId: string, caseId: string, client?: SupabaseClient): Promise<CaseCrmQuoteRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data, error } = await supabase
    .from("fi_crm_quotes")
    .select(
      "id, tenant_id, consultation_id, lead_id, case_id, status, line_items_snapshot, metadata, valid_until, sent_at, responded_at, subtotal_amount, total_amount, updated_at"
    )
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const meta = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      consultation_id: r.consultation_id != null ? String(r.consultation_id) : null,
      lead_id: r.lead_id != null ? String(r.lead_id) : null,
      case_id: r.case_id != null ? String(r.case_id) : null,
      status: String(r.status ?? ""),
      line_items_snapshot: r.line_items_snapshot,
      metadata: meta,
      valid_until: r.valid_until != null ? String(r.valid_until) : null,
      sent_at: r.sent_at != null ? String(r.sent_at) : null,
      responded_at: r.responded_at != null ? String(r.responded_at) : null,
      subtotal_amount: r.subtotal_amount != null && Number.isFinite(Number(r.subtotal_amount)) ? Number(r.subtotal_amount) : null,
      total_amount: r.total_amount != null && Number.isFinite(Number(r.total_amount)) ? Number(r.total_amount) : null,
      updated_at: String(r.updated_at ?? ""),
    };
  });
}
