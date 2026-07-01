import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildAutoRegenMetadata,
  mergeAutoRegenMetadata,
  shouldAutoRegenerateVisualSummary,
  type PatientVisualSummaryAutoRegenTrigger,
} from "./patientVisualSummaryAutoRegenCore";
import {
  defaultPatientVisualSummaryApproval,
  readPatientVisualSummaryApproval,
} from "./patientVisualSummaryApprovalCore";
import {
  regeneratePatientVisualSummaryDraft,
} from "./patientVisualSummaryReportMutations.server";
import type { PatientVisualSummaryReportType } from "./patientVisualSummaryReportTypes";

export type TriggerPatientVisualSummaryAutoRegenResult = {
  ok: boolean;
  regenerated: boolean;
  reason?: string;
};

async function loadAndSaveAutoRegenMetadata(input: {
  tenantId: string;
  caseId: string;
  trigger: PatientVisualSummaryAutoRegenTrigger;
  source: string;
  regenerated: boolean;
  preservedApproved?: boolean;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_cases")
    .select("metadata")
    .eq("id", input.caseId)
    .eq("tenant_id", input.tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;

  const meta =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};

  const regenMeta = buildAutoRegenMetadata({
    trigger: input.trigger,
    source: input.source,
    regenerated: input.regenerated,
    preservedApproved: input.preservedApproved,
  });

  const merged = mergeAutoRegenMetadata(meta, regenMeta);
  const { error: upErr } = await supabase
    .from("fi_cases")
    .update({ metadata: merged })
    .eq("id", input.caseId)
    .eq("tenant_id", input.tenantId.trim());
  if (upErr) throw new Error(upErr.message);
}

export async function triggerPatientVisualSummaryAutoRegen(input: {
  tenantId: string;
  caseId: string | null | undefined;
  surgeryId?: string | null;
  reportType?: PatientVisualSummaryReportType;
  trigger: PatientVisualSummaryAutoRegenTrigger;
  source: string;
}): Promise<TriggerPatientVisualSummaryAutoRegenResult> {
  const tid = input.tenantId.trim();
  const caseIdRaw = input.caseId?.trim();
  if (!caseIdRaw) {
    return { ok: false, regenerated: false, reason: "missing_case" };
  }

  let caseId: string;
  try {
    caseId = assertNonEmptyUuid(caseIdRaw, "caseId");
  } catch {
    return { ok: false, regenerated: false, reason: "invalid_case" };
  }

  const reportType = input.reportType ?? "surgery_post_op_summary";
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_cases")
    .select("metadata, tenant_id")
    .eq("id", caseId)
    .maybeSingle();
  if (error) return { ok: false, regenerated: false, reason: error.message };
  if (!data || String(data.tenant_id) !== tid) {
    return { ok: false, regenerated: false, reason: "case_not_found" };
  }

  const metadata =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};

  const approval =
    readPatientVisualSummaryApproval(metadata, reportType) ??
    defaultPatientVisualSummaryApproval(reportType, input.surgeryId ?? null);

  if (!shouldAutoRegenerateVisualSummary(approval)) {
    await loadAndSaveAutoRegenMetadata({
      tenantId: tid,
      caseId,
      trigger: input.trigger,
      source: input.source,
      regenerated: false,
      preservedApproved: true,
    });
    return { ok: true, regenerated: false, reason: "approved_preserved" };
  }

  await regeneratePatientVisualSummaryDraft({
    tenantId: tid,
    caseId,
    reportType,
    surgeryId: input.surgeryId ?? null,
  });

  await loadAndSaveAutoRegenMetadata({
    tenantId: tid,
    caseId,
    trigger: input.trigger,
    source: input.source,
    regenerated: true,
  });

  return { ok: true, regenerated: true };
}