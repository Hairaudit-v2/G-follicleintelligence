import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveFiOsPublicOrigin } from "@/src/lib/fiOs/fiOsPublicOrigin.server";

const OPEN_PAYMENT_REQUEST_STATUSES = ["draft", "sent", "viewed"] as const;

/** Resolve a public pay page URL for a manual payment record (via case invoice link). */
export async function resolvePaymentLinkForPaymentRecord(
  tenantId: string,
  paymentRecordId: string,
): Promise<string | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const pid = assertNonEmptyUuid(paymentRecordId, "paymentRecordId");
  const supabase = supabaseAdmin();

  const { data: record, error: recErr } = await supabase
    .from("fi_payment_records")
    .select("case_id, tenant_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (recErr) throw new Error(recErr.message);
  if (!record) return null;

  const caseId = record.case_id != null ? String(record.case_id).trim() : "";
  if (!caseId) return null;

  const { data: pr, error: prErr } = await supabase
    .from("fi_payment_requests")
    .select("public_token, status")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .in("status", [...OPEN_PAYMENT_REQUEST_STATUSES])
    .not("public_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prErr) throw new Error(prErr.message);
  if (!pr?.public_token) return null;

  const origin = (await resolveFiOsPublicOrigin()).replace(/\/+$/, "");
  return `${origin}/pay/${encodeURIComponent(String(pr.public_token))}`;
}

/** Batch-resolve payment links for outstanding deposit rows. */
export async function resolvePaymentLinksForPaymentRecords(
  tenantId: string,
  paymentRecordIds: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const id of paymentRecordIds) {
    const link = await resolvePaymentLinkForPaymentRecord(tenantId, id);
    if (link) map.set(id, link);
  }
  return map;
}
