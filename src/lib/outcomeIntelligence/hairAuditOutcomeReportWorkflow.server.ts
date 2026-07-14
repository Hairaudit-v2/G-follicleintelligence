import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveHairAuditLinkForSurgery } from "./hairAuditLinkCore";
import {
  planHairAuditOutcomeReportLink,
  type PlanHairAuditOutcomeReportLinkOutcome,
} from "./hairAuditOutcomeReportWorkflowCore";

export type LinkHairAuditOutcomeReportInput = {
  tenantId: string;
  surgeryId: string;
  caseId: string;
  dryRun?: boolean;
  sendToReview?: boolean;
};

export type LinkHairAuditOutcomeReportResult = {
  outcome: PlanHairAuditOutcomeReportLinkOutcome;
  dryRun: boolean;
};

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

async function loadLatestFiReportId(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_reports")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

/**
 * Explicit operator mutation: link HairAudit outcome report metadata additively.
 * Never overwrites legacy report IDs. Idempotent when already linked.
 */
export async function linkHairAuditOutcomeReportForSurgery(
  input: LinkHairAuditOutcomeReportInput,
  deps?: { supabase?: SupabaseClient }
): Promise<LinkHairAuditOutcomeReportResult> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const surgeryId = assertNonEmptyUuid(input.surgeryId.trim(), "surgeryId");
  const caseId = assertNonEmptyUuid(input.caseId.trim(), "caseId");
  const dryRun = input.dryRun ?? false;

  const supabase = deps?.supabase ?? supabaseAdmin();
  const caseMetadata = await loadCaseMetadata(supabase, tid, caseId);
  const fiReportId = await loadLatestFiReportId(supabase, tid, caseId);

  const hairAuditLink = resolveHairAuditLinkForSurgery({
    tenantId: tid,
    surgeryId,
    caseId,
    caseMetadata,
    fiReportId,
  });

  const planned = planHairAuditOutcomeReportLink({
    tenantId: tid,
    surgeryId,
    caseId,
    caseMetadata,
    hairAuditLink,
    fiReportId,
    dryRun,
    sendToReview: input.sendToReview,
  });

  if (planned.outcome.kind === "linked" && !dryRun && planned.nextMetadata) {
    const { error } = await supabase
      .from("fi_cases")
      .update({ metadata: planned.nextMetadata })
      .eq("tenant_id", tid)
      .eq("id", caseId);
    if (error) throw new Error(error.message);
  }

  return { outcome: planned.outcome, dryRun };
}
