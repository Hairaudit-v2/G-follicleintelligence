import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  patientVisualSummaryPatientAccessAllowed,
  readPatientVisualSummaryApproval,
} from "./patientVisualSummaryApprovalCore";
import {
  isReportVisibleInPatientPortal,
  sanitizeReportForPatientPortal,
  type PatientPortalVisualSummaryItem,
} from "./patientVisualSummaryPortalCore";
import { loadPatientVisualSummaryReport } from "./patientVisualSummaryReportLoad.server";
import {
  PATIENT_VISUAL_SUMMARY_REPORT_TYPES,
  type PatientVisualSummaryReportType,
} from "./patientVisualSummaryReportTypes";

export type PatientPortalVisualSummaryBundle = {
  items: PatientPortalVisualSummaryItem[];
};

function parseCaseMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function loadApprovedPatientVisualSummariesForPortal(input: {
  tenantId: string;
  patientId: string;
}): Promise<PatientPortalVisualSummaryBundle> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const supabase = supabaseAdmin();

  const { data: cases, error } = await supabase
    .from("fi_cases")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .or(`patient_id.eq.${pid},foundation_patient_id.eq.${pid}`)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  const items: PatientPortalVisualSummaryItem[] = [];

  for (const row of cases ?? []) {
    const caseId = String((row as { id: string }).id);
    const metadata = parseCaseMetadata((row as { metadata: unknown }).metadata);

    for (const reportType of PATIENT_VISUAL_SUMMARY_REPORT_TYPES) {
      const approval = readPatientVisualSummaryApproval(metadata, reportType);
      if (!approval || !patientVisualSummaryPatientAccessAllowed(approval)) continue;

      const surgeryId =
        typeof approval.surgery_id === "string" ? approval.surgery_id : null;

      const report = await loadPatientVisualSummaryReport({
        tenantId: tid,
        patientId: pid,
        reportType: reportType as PatientVisualSummaryReportType,
        caseId,
        surgeryId,
        useInitials: false,
      });

      if (!isReportVisibleInPatientPortal(report)) continue;

      items.push({
        caseId,
        reportType: report.reportType,
        report: sanitizeReportForPatientPortal(report),
      });
    }
  }

  return { items };
}