import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  aggregateHairAuditLinkBackfillSummary,
  planHairAuditLinkBackfillItem,
  type HairAuditLinkBackfillItemOutcome,
  type HairAuditLinkBackfillSummary,
} from "./hairAuditLinkBackfillCore";

export type HairAuditLinkBackfillScope = {
  caseId?: string | null;
  surgeryId?: string | null;
};

export type HairAuditLinkBackfillInput = HairAuditLinkBackfillScope & {
  tenantId: string;
  dryRun: boolean;
};

export type HairAuditLinkBackfillResult = {
  summary: HairAuditLinkBackfillSummary;
  outcomes: HairAuditLinkBackfillItemOutcome[];
};

type SurgeryBackfillRow = {
  id: string;
  case_id: string | null;
};

async function loadSurgeryRows(
  supabase: SupabaseClient,
  tenantId: string,
  scope: HairAuditLinkBackfillScope
): Promise<SurgeryBackfillRow[]> {
  const tid = tenantId.trim();
  if (scope.surgeryId?.trim()) {
    const { data, error } = await supabase
      .from("fi_surgeries")
      .select("id, case_id")
      .eq("tenant_id", tid)
      .eq("id", scope.surgeryId.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? [{ id: String(data.id), case_id: data.case_id ? String(data.case_id) : null }]
      : [];
  }

  if (scope.caseId?.trim()) {
    const { data, error } = await supabase
      .from("fi_surgeries")
      .select("id, case_id")
      .eq("tenant_id", tid)
      .eq("case_id", scope.caseId.trim())
      .order("scheduled_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: String((row as { id: string }).id),
      case_id: (row as { case_id: string | null }).case_id
        ? String((row as { case_id: string }).case_id)
        : null,
    }));
  }

  return [];
}

async function loadCaseMetadata(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("id", caseId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const metadata = (data as { metadata?: unknown } | null)?.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

export async function runHairAuditLinkBackfill(
  input: HairAuditLinkBackfillInput,
  deps?: { supabase?: SupabaseClient }
): Promise<HairAuditLinkBackfillResult> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const supabase = deps?.supabase ?? supabaseAdmin();
  const surgeries = await loadSurgeryRows(supabase, tid, input);

  const outcomes: HairAuditLinkBackfillItemOutcome[] = [];

  for (const surgery of surgeries) {
    if (!surgery.case_id) continue;
    const caseMetadata = await loadCaseMetadata(supabase, tid, surgery.case_id);
    const planned = planHairAuditLinkBackfillItem({
      caseId: surgery.case_id,
      surgeryId: surgery.id,
      caseMetadata,
      dryRun: input.dryRun,
    });
    outcomes.push(planned.outcome);

    if (!input.dryRun && planned.outcome.kind === "copied_legacy" && planned.nextMetadata) {
      const { error } = await supabase
        .from("fi_cases")
        .update({ metadata: planned.nextMetadata })
        .eq("tenant_id", tid)
        .eq("id", surgery.case_id);
      if (error) throw new Error(error.message);
    }
  }

  return {
    outcomes,
    summary: aggregateHairAuditLinkBackfillSummary(outcomes, input.dryRun),
  };
}
