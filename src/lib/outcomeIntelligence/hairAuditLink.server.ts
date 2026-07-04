import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildStructuredHairAuditLinkFromResolution,
  mergeAdditiveCaseHairAuditMetadata,
  resolveHairAuditLinkForSurgery,
  type HairAuditLinkResolution,
} from "./hairAuditLinkCore";

export type EnsureHairAuditLinkForSurgeryInput = {
  tenantId: string;
  surgeryId: string;
  caseId?: string | null;
  patientId?: string | null;
  dryRun?: boolean;
};

export type EnsureHairAuditLinkForSurgeryResult =
  | { action: "linked"; resolution: HairAuditLinkResolution; dryRun: boolean }
  | { action: "skipped_no_match"; resolution: HairAuditLinkResolution }
  | { action: "skipped_conflict"; resolution: HairAuditLinkResolution }
  | { action: "skipped_already_structured"; resolution: HairAuditLinkResolution };

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

async function loadGlobalHairAuditSourceIds(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string
): Promise<Array<{ source_system: string; source_case_id: string }>> {
  const { data, error } = await supabase
    .from("fi_global_cases")
    .select("source_system, source_case_id")
    .eq("tenant_id", tenantId.trim())
    .eq("fi_case_id", caseId.trim());
  if (error) return [];
  return (data ?? [])
    .map((row) => ({
      source_system: String((row as { source_system: string }).source_system),
      source_case_id: String((row as { source_case_id: string }).source_case_id),
    }))
    .filter((row) => row.source_system && row.source_case_id);
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
 * Mutation-only path: resolves and writes additive structured linkage when safe.
 * Never deletes legacy metadata or overwrites conflicting identifiers.
 */
export async function tryEnsureStructuredHairAuditLinkForSurgery(
  input: EnsureHairAuditLinkForSurgeryInput,
  deps?: { supabase?: SupabaseClient }
): Promise<EnsureHairAuditLinkForSurgeryResult> {
  const tid = assertNonEmptyUuid(input.tenantId.trim(), "tenantId");
  const surgeryId = assertNonEmptyUuid(input.surgeryId.trim(), "surgeryId");
  const caseId = input.caseId?.trim() ?? null;
  if (!caseId) {
    const empty = resolveHairAuditLinkForSurgery({
      tenantId: tid,
      surgeryId,
      caseId: null,
      patientId: input.patientId ?? null,
    });
    return { action: "skipped_no_match", resolution: empty };
  }

  const supabase = deps?.supabase ?? supabaseAdmin();
  const caseMetadata = await loadCaseMetadata(supabase, tid, caseId);
  const globalCaseSourceIds = await loadGlobalHairAuditSourceIds(supabase, tid, caseId);
  const fiReportId = await loadLatestFiReportId(supabase, tid, caseId);

  const resolution = resolveHairAuditLinkForSurgery({
    tenantId: tid,
    surgeryId,
    caseId,
    patientId: input.patientId ?? null,
    caseMetadata,
    globalCaseSourceIds,
    fiReportId,
  });

  const existingStructured = caseMetadata.hair_audit_link;
  if (
    existingStructured &&
    typeof existingStructured === "object" &&
    !Array.isArray(existingStructured)
  ) {
    if (resolution.linkage_conflict) {
      return { action: "skipped_conflict", resolution };
    }
    return { action: "skipped_already_structured", resolution };
  }

  if (resolution.linkage_conflict) {
    return { action: "skipped_conflict", resolution };
  }

  if (!resolution.hairaudit_case_id && !resolution.fi_report_id) {
    return { action: "skipped_no_match", resolution };
  }

  const structuredLink = buildStructuredHairAuditLinkFromResolution({
    resolution,
    surgeryId,
  });
  if (!structuredLink) {
    return { action: "skipped_no_match", resolution };
  }

  if (input.dryRun) {
    return { action: "linked", resolution, dryRun: true };
  }

  const nextMetadata = mergeAdditiveCaseHairAuditMetadata(caseMetadata, structuredLink);
  const { error } = await supabase
    .from("fi_cases")
    .update({ metadata: nextMetadata })
    .eq("tenant_id", tid)
    .eq("id", caseId);
  if (error) throw new Error(error.message);

  return { action: "linked", resolution, dryRun: false };
}