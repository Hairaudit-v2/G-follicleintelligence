import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";
import { tryBuildOpenAiVisionGraftTrayEstimate } from "./graftTrayCountOpenAiProvider.server";
import { deriveTrayReviewStatuses } from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import { isGraftTrayCapture } from "./imagingGraftTrayBridgeCore";
import type { GraftTrayLinkRow } from "./imagingGraftTrayBridge.server";
import {
  buildStubGraftTrayCountEstimate,
  buildUnableToAssessEstimate,
  compareGraftTrayAiEstimate,
  parseGraftTrayAiFeatureFlags,
  resolveManualGraftCountFromEvents,
} from "./graftTrayCountProviderCore";
import {
  mapEstimateRowToSummary,
  parseGraftTrayAiEstimateRow,
} from "./graftTrayAiEstimateRowParser";
import type { ImagingAiJobStatus } from "./imagingAiAnalysisKinds";
import {
  parseGraftTrayReviewAuditTrail,
  type GraftTrayAiReviewAuditEntry,
} from "./graftTrayReviewUxCore";
import type {
  GraftTrayAiEstimateRow,
  GraftTrayAiEstimateSummary,
  GraftTrayCountEstimateResult,
  GraftTrayCountComparison,
  ManualGraftCountSnapshot,
} from "./graftTrayCountTypes";

export type { GraftTrayAiEstimateRow } from "./graftTrayCountTypes";
export { mapEstimateRowToSummary } from "./graftTrayAiEstimateRowParser";

async function loadGraftTrayLinkForImage(
  client: SupabaseClient,
  tenantId: string,
  imageId: string
): Promise<GraftTrayLinkRow | null> {
  const { data, error } = await client
    .from("fi_imaging_graft_tray_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("image_id", imageId)
    .neq("status", "superseded")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as GraftTrayLinkRow) : null;
}

async function resolveManualCountForLink(
  client: SupabaseClient,
  tenantId: string,
  link: GraftTrayLinkRow | null
): Promise<ManualGraftCountSnapshot> {
  if (!link?.graft_session_id) {
    return {
      manual_count: null,
      manual_count_source: "missing",
      graft_count_event_id: null,
      graft_session_id: link?.graft_session_id ?? null,
    };
  }

  const { data: session, error: sessionErr } = await client
    .from("fi_surgery_graft_sessions")
    .select("id, extracted_grafts")
    .eq("tenant_id", tenantId)
    .eq("id", link.graft_session_id)
    .maybeSingle();
  if (sessionErr) throw new Error(sessionErr.message);

  const { data: events, error: eventsErr } = await client
    .from("fi_surgery_graft_count_events")
    .select("id, event_type, note, created_at, singles, doubles, triples, multiples")
    .eq("tenant_id", tenantId)
    .eq("graft_session_id", link.graft_session_id)
    .order("created_at", { ascending: true });
  if (eventsErr) throw new Error(eventsErr.message);

  const reviewStatuses = deriveTrayReviewStatuses(
    (events ?? []).map((e) => ({
      id: String((e as { id: string }).id),
      eventType: String((e as { event_type: string }).event_type) as "tray_count",
      note: (e as { note: string | null }).note,
      createdAt: String((e as { created_at: string }).created_at),
    }))
  );

  return resolveManualGraftCountFromEvents({
    graftSessionId: link.graft_session_id,
    sessionExtractedGrafts:
      session?.extracted_grafts != null ? Number(session.extracted_grafts) : null,
    events: (events ?? []).map((e) => {
      const row = e as Record<string, unknown>;
      const id = String(row.id);
      const eventType = String(row.event_type);
      return {
        id,
        eventType,
        reviewStatus: eventType === "tray_count" ? (reviewStatuses.get(id) ?? "pending") : null,
        singles: row.singles != null ? Number(row.singles) : null,
        doubles: row.doubles != null ? Number(row.doubles) : null,
        triples: row.triples != null ? Number(row.triples) : null,
        multiples: row.multiples != null ? Number(row.multiples) : null,
        createdAt: String(row.created_at),
      };
    }),
  });
}

export async function runGraftTrayCountEstimate(input: {
  tenantId: string;
  patientImageId: string;
  patientId?: string | null;
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  metadata?: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<{
  estimate: GraftTrayCountEstimateResult;
  manual: ManualGraftCountSnapshot;
  comparison: GraftTrayCountComparison;
  link: GraftTrayLinkRow | null;
  usedOpenAi: boolean;
}> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const imageId = input.patientImageId.trim();
  const flags = parseGraftTrayAiFeatureFlags(process.env);

  if (
    !isGraftTrayCapture({
      protocolSlotSlug: input.protocolSlotSlug,
      imageCategory: input.imageCategory,
      metadata: input.metadata,
    })
  ) {
    throw new Error("Graft tray count estimate only applies to graft_tray images.");
  }

  const link = await loadGraftTrayLinkForImage(client, tid, imageId);
  const manual = await resolveManualCountForLink(client, tid, link);

  if (!flags.enabled) {
    const estimate = buildUnableToAssessEstimate({
      provider: "unavailable",
      providerVersion: "graft_tray_disabled_v1",
      notes: [
        "Graft tray AI counting is disabled. Set FI_IMAGING_ENABLE_GRAFT_TRAY_AI_COUNT=true.",
      ],
    });
    const comparison = compareGraftTrayAiEstimate({
      estimate,
      manual,
      tolerancePercent: flags.tolerancePercent,
    });
    return { estimate, manual, comparison, link, usedOpenAi: false };
  }

  const classifierMode = resolveHairauditClassifierMode(process.env);
  const openAiOutcome = tryBuildOpenAiVisionGraftTrayEstimate({
    flags,
    classifierMode,
    imageId,
    manualCount: manual.manual_count,
  });
  const estimate =
    openAiOutcome?.estimate ??
    buildStubGraftTrayCountEstimate({ imageId, manualCount: manual.manual_count });
  const usedOpenAi = openAiOutcome?.usedOpenAi ?? false;

  const comparison = compareGraftTrayAiEstimate({
    estimate,
    manual,
    tolerancePercent: flags.tolerancePercent,
  });

  return { estimate, manual, comparison, link, usedOpenAi };
}

export async function persistGraftTrayAiEstimate(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  analysisJobId?: string | null;
  estimate: GraftTrayCountEstimateResult;
  manual: ManualGraftCountSnapshot;
  comparison: GraftTrayCountComparison;
  link: GraftTrayLinkRow | null;
  client?: SupabaseClient;
}): Promise<GraftTrayAiEstimateRow> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const now = new Date().toISOString();
  const link = input.link;

  const row = {
    id: randomUUID(),
    tenant_id: tid,
    patient_id: input.patientId.trim(),
    image_id: input.patientImageId.trim(),
    graft_tray_link_id: link?.id ?? null,
    surgery_id: link?.surgery_id ?? null,
    surgery_case_id: link?.surgery_case_id ?? null,
    booking_id: link?.booking_id ?? null,
    graft_session_id: input.manual.graft_session_id ?? link?.graft_session_id ?? null,
    graft_count_event_id: input.manual.graft_count_event_id,
    analysis_job_id: input.analysisJobId ?? null,
    estimated_graft_count: input.estimate.estimated_graft_count,
    manual_graft_count: input.manual.manual_count,
    manual_count_source: input.manual.manual_count_source,
    corrected_graft_count: null,
    delta: input.comparison.delta,
    tolerance_percent: input.comparison.tolerance_percent,
    mismatch_band: input.comparison.mismatch_band,
    confidence: input.estimate.confidence,
    confidence_band: input.estimate.confidence_band,
    image_quality: input.estimate.image_quality,
    assessable: input.estimate.assessable,
    review_status: "pending_review",
    reviewer_decision: null,
    reviewed_by_fi_user_id: null,
    reviewed_at: null,
    provider: input.estimate.provider,
    provider_version: input.estimate.provider_version,
    uncertainty_notes: input.estimate.uncertainty_notes,
    review_reasons: input.comparison.review_reasons,
    raw_provider_metadata: input.estimate.raw_provider_metadata,
    metadata: {
      bridge: "graft_tray_ai_estimate_v1",
      recommended_review_reason: input.estimate.recommended_review_reason,
    },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client
    .from("fi_imaging_graft_tray_ai_estimates")
    .upsert(row, { onConflict: "tenant_id,image_id", ignoreDuplicates: false })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const estimateRow = parseGraftTrayAiEstimateRow(data);

  const graftTrayMetaPatch = {
    graft_tray_ai_estimate_id: estimateRow.id,
    graft_tray_ai_estimate: mapEstimateRowToSummary(estimateRow),
    graft_tray_review_reasons: input.comparison.review_reasons,
  };

  const { data: imageRow } = await client
    .from("fi_patient_images")
    .select("metadata")
    .eq("tenant_id", tid)
    .eq("id", input.patientImageId)
    .maybeSingle();

  const existingMeta =
    imageRow?.metadata && typeof imageRow.metadata === "object"
      ? (imageRow.metadata as Record<string, unknown>)
      : {};

  await client
    .from("fi_patient_images")
    .update({
      metadata: { ...existingMeta, ...graftTrayMetaPatch },
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", input.patientImageId);

  if (link?.id) {
    const linkStatus =
      input.comparison.mismatch_band === "material_mismatch" ||
      input.comparison.mismatch_band === "minor_mismatch"
        ? "mismatch_flagged"
        : "review_required";
    await client
      .from("fi_imaging_graft_tray_links")
      .update({
        status: linkStatus,
        review_required: true,
        mismatch_reason:
          input.comparison.mismatch_band === "within_tolerance"
            ? null
            : `AI estimate mismatch band: ${input.comparison.mismatch_band}`,
        graft_count_event_id: input.manual.graft_count_event_id,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", link.id);
  }

  return estimateRow;
}

export type GraftTrayIntelligenceImageContext = {
  estimate: GraftTrayAiEstimateSummary;
  auditTrail: GraftTrayAiReviewAuditEntry[];
  estimateAnalysisJobStatus: ImagingAiJobStatus | null;
  hasNewerActiveJob: boolean;
};

export async function loadGraftTrayIntelligenceContextForImages(
  tenantId: string,
  imageIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, GraftTrayIntelligenceImageContext>> {
  const out = new Map<string, GraftTrayIntelligenceImageContext>();
  if (!imageIds.length) return out;
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const ids = imageIds as string[];

  const [estimateRes, imageRes, jobRes] = await Promise.all([
    supabase
      .from("fi_imaging_graft_tray_ai_estimates")
      .select("*")
      .eq("tenant_id", tid)
      .in("image_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("fi_patient_images").select("id, metadata").eq("tenant_id", tid).in("id", ids),
    supabase
      .from("fi_imaging_ai_analysis_jobs")
      .select("id, patient_image_id, status, created_at")
      .eq("tenant_id", tid)
      .eq("analysis_kind", "graft_tray_count_estimate")
      .in("patient_image_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (estimateRes.error) throw new Error(estimateRes.error.message);
  if (imageRes.error) throw new Error(imageRes.error.message);
  if (jobRes.error) throw new Error(jobRes.error.message);

  const metadataByImage = new Map<string, Record<string, unknown>>();
  for (const row of imageRes.data ?? []) {
    const r = row as { id: string; metadata: unknown };
    metadataByImage.set(
      r.id,
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {}
    );
  }

  const jobsByImage = new Map<string, Array<{ id: string; status: ImagingAiJobStatus }>>();
  for (const row of jobRes.data ?? []) {
    const r = row as { id: string; patient_image_id: string; status: string };
    const list = jobsByImage.get(r.patient_image_id) ?? [];
    list.push({
      id: r.id,
      status: r.status as ImagingAiJobStatus,
    });
    jobsByImage.set(r.patient_image_id, list);
  }

  const estimateByImage = new Map<string, ReturnType<typeof parseGraftTrayAiEstimateRow>>();
  for (const row of estimateRes.data ?? []) {
    const parsed = parseGraftTrayAiEstimateRow(row);
    if (!estimateByImage.has(parsed.image_id)) {
      estimateByImage.set(parsed.image_id, parsed);
    }
  }

  for (const imageId of ids) {
    const row = estimateByImage.get(imageId);
    if (!row) continue;
    const metadata = metadataByImage.get(imageId) ?? {};
    const imageJobs = jobsByImage.get(imageId) ?? [];
    const estimateJob = row.analysis_job_id
      ? imageJobs.find((j) => j.id === row.analysis_job_id)
      : null;
    const hasNewerActiveJob = imageJobs.some(
      (j) =>
        j.id !== row.analysis_job_id &&
        j.status !== "superseded" &&
        (j.status === "queued" || j.status === "running" || j.status === "completed")
    );

    out.set(imageId, {
      estimate: mapEstimateRowToSummary(row),
      auditTrail: parseGraftTrayReviewAuditTrail(metadata.graft_tray_ai_review_audit),
      estimateAnalysisJobStatus: estimateJob?.status ?? null,
      hasNewerActiveJob,
    });
  }

  return out;
}

export async function loadGraftTrayAiEstimatesForImages(
  tenantId: string,
  imageIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, GraftTrayAiEstimateSummary>> {
  const out = new Map<string, GraftTrayAiEstimateSummary>();
  if (!imageIds.length) return out;
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_imaging_graft_tray_ai_estimates")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .in("image_id", imageIds as string[])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = parseGraftTrayAiEstimateRow(row);
    if (!out.has(r.image_id)) {
      out.set(r.image_id, mapEstimateRowToSummary(r));
    }
  }
  return out;
}

export async function maybeEnqueueGraftTrayCountEstimateJob(input: {
  tenantId: string;
  patientImageId: string;
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  metadata?: Record<string, unknown>;
  graftTrayLinkId?: string | null;
  client?: SupabaseClient;
}): Promise<string | null> {
  const flags = parseGraftTrayAiFeatureFlags(process.env);
  if (!flags.enabled) return null;

  if (
    !isGraftTrayCapture({
      protocolSlotSlug: input.protocolSlotSlug,
      imageCategory: input.imageCategory,
      metadata: input.metadata,
    })
  ) {
    return null;
  }

  const { enqueueImagingAiAnalysisJob } = await import("./imagingAiAnalysisJobs.server");
  return enqueueImagingAiAnalysisJob({
    tenantId: input.tenantId,
    patientImageId: input.patientImageId,
    analysisKind: "graft_tray_count_estimate",
    requestPayload: {
      trigger: "graft_tray_capture",
      graft_tray_link_id: input.graftTrayLinkId ?? null,
    },
    client: input.client,
  });
}
