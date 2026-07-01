import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildApprovedPatientVisualSummaryRecord,
  buildDraftPatientVisualSummaryRecord,
  buildExportedPatientVisualSummaryRecord,
  defaultPatientVisualSummaryApproval,
  mergePatientVisualSummaryApprovalMetadata,
  readPatientVisualSummaryApproval,
} from "./patientVisualSummaryApprovalCore";
import { mergeStaffRecordIntoCaseMetadata } from "./patientVisualSummaryRecordCore";
import type {
  PatientVisualSummaryApprovalRecord,
  PatientVisualSummaryReportType,
  PatientVisualSummaryStaffRecord,
} from "./patientVisualSummaryReportTypes";

async function loadCaseMetadata(caseId: string, tenantId: string): Promise<Record<string, unknown>> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_cases")
    .select("metadata, tenant_id")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found.");
  if (String(data.tenant_id) !== tenantId.trim()) throw new Error("Case tenant mismatch.");
  const meta = data.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return { ...(meta as Record<string, unknown>) };
  }
  return {};
}

async function saveCaseMetadata(
  caseId: string,
  tenantId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("fi_cases")
    .update({ metadata })
    .eq("id", caseId)
    .eq("tenant_id", tenantId.trim());
  if (error) throw new Error(error.message);
}

export async function approvePatientVisualSummaryReport(input: {
  tenantId: string;
  caseId: string;
  reportType: PatientVisualSummaryReportType;
  approvedByUserId: string;
  surgeryId?: string | null;
}): Promise<PatientVisualSummaryApprovalRecord> {
  const caseId = assertNonEmptyUuid(input.caseId, "caseId");
  const tid = input.tenantId.trim();
  const metadata = await loadCaseMetadata(caseId, tid);
  const existing =
    readPatientVisualSummaryApproval(metadata, input.reportType) ??
    defaultPatientVisualSummaryApproval(input.reportType, input.surgeryId);
  const record = buildApprovedPatientVisualSummaryRecord({
    existing,
    approvedByUserId: input.approvedByUserId,
  });
  await saveCaseMetadata(caseId, tid, mergePatientVisualSummaryApprovalMetadata(metadata, record));
  return record;
}

export async function markPatientVisualSummaryExported(input: {
  tenantId: string;
  caseId: string;
  reportType: PatientVisualSummaryReportType;
}): Promise<PatientVisualSummaryApprovalRecord> {
  const caseId = assertNonEmptyUuid(input.caseId, "caseId");
  const tid = input.tenantId.trim();
  const metadata = await loadCaseMetadata(caseId, tid);
  const existing = readPatientVisualSummaryApproval(metadata, input.reportType);
  if (!existing || existing.status !== "approved") {
    throw new Error("Report must be approved before export.");
  }
  const record = buildExportedPatientVisualSummaryRecord(existing);
  await saveCaseMetadata(caseId, tid, mergePatientVisualSummaryApprovalMetadata(metadata, record));
  return record;
}

export async function savePatientVisualSummaryStaffRecord(input: {
  tenantId: string;
  caseId: string;
  record: PatientVisualSummaryStaffRecord;
}): Promise<PatientVisualSummaryStaffRecord> {
  const caseId = assertNonEmptyUuid(input.caseId, "caseId");
  const tid = input.tenantId.trim();
  const metadata = await loadCaseMetadata(caseId, tid);
  const merged = mergeStaffRecordIntoCaseMetadata(metadata, input.record);
  await saveCaseMetadata(caseId, tid, merged);
  return input.record;
}

export async function regeneratePatientVisualSummaryDraft(input: {
  tenantId: string;
  caseId: string;
  reportType: PatientVisualSummaryReportType;
  surgeryId?: string | null;
}): Promise<PatientVisualSummaryApprovalRecord> {
  const caseId = assertNonEmptyUuid(input.caseId, "caseId");
  const tid = input.tenantId.trim();
  const metadata = await loadCaseMetadata(caseId, tid);
  const existing =
    readPatientVisualSummaryApproval(metadata, input.reportType) ??
    defaultPatientVisualSummaryApproval(input.reportType, input.surgeryId);
  const record = buildDraftPatientVisualSummaryRecord(existing);
  await saveCaseMetadata(caseId, tid, mergePatientVisualSummaryApprovalMetadata(metadata, record));
  return record;
}