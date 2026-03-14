/**
 * pdf_render: writes PDF, stores to storage, updates fi_reports.
 * Consumes report_json only. Idempotent: upserts report by (case_id, model_run_id).
 */
import type { StageContext, StageResult } from "./types";
import type { ReportJson } from "../reportSchema";
import { renderReportPdf } from "../pdf/renderReportPdf";

const BUCKET = process.env.FI_STORAGE_BUCKET_INTAKES || "fi-intakes";

export type PdfRenderInput = {
  reportJson: ReportJson;
};

export type PdfRenderOutput = {
  reportId: string;
  storagePath: string;
};

export async function runPdfRender(
  ctx: StageContext,
  input: PdfRenderInput,
  dryRun?: boolean
): Promise<StageResult<PdfRenderOutput>> {
  const { tenantId, caseId, modelRunId, supabase } = ctx;

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const storagePath = `tenants/${tenantId}/cases/${caseId}/reports/fi-report-${modelRunId}-${timestamp}.pdf`;

  if (dryRun) {
    return { ok: true, data: { reportId: "[dry-run]", storagePath } };
  }

  const pdfBytes = Buffer.from(await renderReportPdf(input.reportJson));

  await supabase.storage.from(BUCKET).upload(storagePath, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { data: existing } = await supabase
    .from("fi_reports")
    .select("id")
    .eq("case_id", caseId)
    .eq("model_run_id", modelRunId)
    .single();

  let reportId: string;

  if (existing) {
    await supabase
      .from("fi_reports")
      .update({
        report_json: input.reportJson,
        storage_path: storagePath,
        version: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    reportId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("fi_reports")
      .insert({
        tenant_id: tenantId,
        case_id: caseId,
        model_run_id: modelRunId,
        version: 1,
        report_json: input.reportJson,
        status: "draft",
        storage_path: storagePath,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    reportId = inserted!.id;
  }

  return { ok: true, data: { reportId, storagePath } };
}
