/**
 * Pipeline orchestrator. Runs stages in order; each stage updates fi_model_runs.stage.
 * Fetches tenant config once for branding, feature flags, scoring weights.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantConfigResolved } from "./tenantConfig";
import { acquireJob, updateJobStage, failJob, completeJob } from "./jobRunner";
import {
  runBloodExtract,
  runImageExtract,
  runAndrogenAgeModel,
  runRiskScore,
  runReportCompose,
  runPdfRender,
} from "./stages";

const BLOOD_TYPES = ["blood_pdf", "blood_csv"];
const IMAGE_TYPES = [
  "scalp_preop_front",
  "scalp_sides_left",
  "scalp_sides_right",
  "scalp_crown",
  "donor_rear",
  "postop_day0",
];

export type PipelineOptions = {
  tenantId: string;
  caseId: string;
  jobId?: string;
  dryRun?: boolean;
};

export type PipelineResult = {
  ok: boolean;
  error?: string;
  jobId?: string;
  reportId?: string;
  storagePath?: string;
};

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { tenantId, caseId, jobId: inputJobId, dryRun } = options;
  const supabase = supabaseAdmin();
  let jobId = inputJobId;

  try {
    // Idempotent re-run: if case has complete job and no explicit jobId, return that report
    // Also: if case has queued/running job, do not create another (prevents duplicate execution)
    if (!inputJobId && !dryRun) {
      const { data: activeOrComplete } = await supabase
        .from("fi_model_runs")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("case_id", caseId)
        .in("status", ["complete", "queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeOrComplete) {
        if (activeOrComplete.status === "complete") {
          const { data: report } = await supabase
            .from("fi_reports")
            .select("id, storage_path")
            .eq("case_id", caseId)
            .eq("model_run_id", activeOrComplete.id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          if (report)
            return {
              ok: true,
              jobId: activeOrComplete.id,
              reportId: report.id,
              storagePath: report.storage_path ?? undefined,
            };
        } else {
          return {
            ok: false,
            error: `Case already has ${activeOrComplete.status} job. Wait for completion or use existing jobId.`,
          };
        }
      }
    }

    const acquired = await acquireJob(tenantId, caseId, jobId);
    if (!acquired.ok) return { ok: false, error: acquired.error };
    jobId = acquired.jobId;

    if (acquired.job.status === "complete" && !dryRun) {
      const { data: report } = await supabase
        .from("fi_reports")
        .select("id, storage_path")
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return {
        ok: true,
        jobId,
        reportId: report?.id,
        storagePath: report?.storage_path ?? undefined,
      };
    }

    const updateStage = (stage: string) => updateJobStage(jobId!, tenantId, stage);

    const ctx = {
      tenantId,
      caseId,
      modelRunId: jobId!,
      supabase,
      updateStage,
    };

    const { data: caseRow } = await supabase
      .from("fi_cases")
      .select("id, partner_id")
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .single();
    if (!caseRow) return { ok: false, error: "Case not found." };

    let partnerReferenceCode: string | null = null;
    if (caseRow.partner_id) {
      const { data: partner } = await supabase
        .from("fi_partners")
        .select("reference_code")
        .eq("id", caseRow.partner_id)
        .eq("tenant_id", tenantId)
        .single();
      if (partner) partnerReferenceCode = partner.reference_code;
    }

    const tenantConfig = await getTenantConfigResolved(supabase, tenantId);

    const { data: intakeRow } = await supabase
      .from("fi_intakes")
      .select("full_name, email, dob, sex, country, primary_concern, selections")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .single();

    const { data: files } = await supabase
      .from("fi_uploads")
      .select("id, type, filename, storage_path, mime_type")
      .eq("case_id", caseId)
      .in("type", [...BLOOD_TYPES, ...IMAGE_TYPES]);

    const uploads = files ?? [];

    await updateStage("blood_extract");
    const bloodResult = await runBloodExtract(ctx, { uploads }, dryRun);
    if (!bloodResult.ok) throw new Error(bloodResult.error);

    await updateStage("image_extract");
    const imageResult = await runImageExtract(
      ctx,
      { uploads, enableImageSignals: tenantConfig.feature_flags?.enable_image_signals !== false },
      dryRun
    );
    if (!imageResult.ok) throw new Error(imageResult.error);

    await updateStage("androgen_age_model");
    const androgenResult = await runAndrogenAgeModel(
      ctx,
      {
        bloodSignals: bloodResult.data,
        imageSignals: imageResult.data,
        intake: intakeRow ?? {},
        enableProgressionModel: tenantConfig.feature_flags?.enable_progression_model !== false,
      },
      dryRun
    );
    if (!androgenResult.ok) throw new Error(androgenResult.error);

    await updateStage("risk_score");
    const riskResult = await runRiskScore(ctx, { androgenOutput: androgenResult.data }, dryRun);
    if (!riskResult.ok) throw new Error(riskResult.error);

    await updateStage("report_compose");
    const reportResult = runReportCompose(ctx, {
      intake: {
        id: caseRow.id,
        full_name: intakeRow?.full_name ?? "",
        email: intakeRow?.email ?? "",
        dob: intakeRow?.dob ?? "",
        sex: intakeRow?.sex ?? "",
        country: intakeRow?.country ?? null,
        primary_concern: intakeRow?.primary_concern ?? null,
        selections: (intakeRow?.selections as Record<string, unknown>) ?? {},
      },
      bloodSignals: bloodResult.data,
      imageSignals: imageResult.data,
      scorecard: riskResult.data.scorecard,
      tenantConfig,
      partnerReferenceCode,
    });
    if (!reportResult.ok) throw new Error(reportResult.error);

    await updateStage("pdf_render");
    const pdfResult = await runPdfRender(ctx, { reportJson: reportResult.data }, dryRun);
    if (!pdfResult.ok) throw new Error(pdfResult.error);

    if (!dryRun) {
      await supabase
        .from("fi_cases")
        .update({
          status: "complete",
          latest_report_id: pdfResult.data.reportId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId)
        .eq("tenant_id", tenantId);

      await completeJob(jobId!, tenantId);

      return {
        ok: true,
        jobId,
        reportId: pdfResult.data.reportId,
        storagePath: pdfResult.data.storagePath,
      };
    }

    await completeJob(jobId!, tenantId);
    return {
      ok: true,
      jobId,
      storagePath: `[DRY RUN] ${pdfResult.data.storagePath}`,
    };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (jobId) await failJob(jobId, tenantId, errMsg);
    return { ok: false, error: errMsg, jobId };
  }
}
