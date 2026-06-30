import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadVieCapturePolicyForTenant } from "./vieCapturePolicy.server";
import type {
  VieComparisonCaptureRecord,
  VieComparisonPair,
  VieComparisonPairRow,
  VieComparisonReviewStatus,
  VieProgressionTimeline,
} from "./vieComparisonTypes";
import {
  buildComparisonCaptureRecord,
  buildComparisonReadinessSummary,
  buildVieProgressionTimeline,
  generateVieComparisonPairs,
} from "./vieLongitudinalComparisonCore";
import {
  enrichComparisonPairWithAlignment,
  loadAlignmentResultsByImageIds,
} from "./vieSameAngleAlignment.server";

function mapPairRow(row: Record<string, unknown>): VieComparisonPairRow {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const comparisonId =
    typeof metadata.comparison_id === "string"
      ? metadata.comparison_id
      : `viecmp:${String(row.before_image_id)}:${String(row.after_image_id)}:${String(row.comparison_category)}`;

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    comparison_id: comparisonId,
    patient_id: String(row.patient_id),
    case_id: row.case_id != null ? String(row.case_id) : null,
    before_image_id: String(row.before_image_id),
    after_image_id: String(row.after_image_id),
    comparison_category: String(
      row.comparison_category
    ) as VieComparisonPairRow["comparison_category"],
    anatomical_region: String(row.anatomical_region),
    slot_family: String(row.slot_family),
    before_timepoint: String(row.before_timepoint) as VieComparisonPairRow["before_timepoint"],
    after_timepoint: String(row.after_timepoint) as VieComparisonPairRow["after_timepoint"],
    days_between: Number(row.days_between ?? 0),
    quality_match_score: Number(row.quality_match_score ?? 0),
    angle_match_status: "pending_ai",
    framing_match_status: String(
      row.framing_match_status ?? "unknown"
    ) as VieComparisonPairRow["framing_match_status"],
    confidence_band: String(
      row.confidence_band ?? "medium"
    ) as VieComparisonPairRow["confidence_band"],
    recommended_use: Array.isArray(row.recommended_use)
      ? (row.recommended_use as VieComparisonPairRow["recommended_use"])
      : [],
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    review_status: String(row.review_status ?? "suggested") as VieComparisonReviewStatus,
    metadata,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadVieComparisonCaptureRecords(
  tenantId: string,
  patientId: string,
  caseId?: string | null,
  client?: SupabaseClient
): Promise<VieComparisonCaptureRecord[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const intelQuery = supabase
    .from("fi_vie_capture_intelligence")
    .select(
      "patient_image_id, protocol_template_slug, protocol_slot_slug, quality_score, quality_band, clinically_usable, acceptance_status, created_at, accepted_at"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("acceptance_status", "accepted");

  const { data: intelRows, error: intelErr } = await intelQuery;
  if (intelErr) throw new Error(intelErr.message);
  if (!intelRows?.length) return [];

  const imageIds = intelRows.map((r) => String((r as Record<string, unknown>).patient_image_id));

  let imageQuery = supabase
    .from("fi_patient_images")
    .select(
      "id, patient_id, case_id, anatomical_region, imaging_library_axis, visit_type, follow_up_interval, taken_at, created_at, imaging_protocol_template_slug, imaging_protocol_slot_slug"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .in("id", imageIds)
    .eq("image_status", "active");

  if (caseId?.trim()) {
    imageQuery = imageQuery.eq("case_id", caseId.trim());
  }

  const { data: imageRows, error: imageErr } = await imageQuery;
  if (imageErr) throw new Error(imageErr.message);

  const imageById = new Map(
    (imageRows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return [String(r.id), r];
    })
  );

  const records: VieComparisonCaptureRecord[] = [];
  for (const intel of intelRows) {
    const ir = intel as Record<string, unknown>;
    const imageId = String(ir.patient_image_id);
    const image = imageById.get(imageId);
    if (!image) continue;

    const protocol =
      String(ir.protocol_template_slug ?? image.imaging_protocol_template_slug ?? "").trim() ||
      null;
    const slot =
      String(ir.protocol_slot_slug ?? image.imaging_protocol_slot_slug ?? "").trim() || null;

    const capturedAt = String(
      ir.accepted_at ?? ir.created_at ?? image.taken_at ?? image.created_at
    );

    const record = buildComparisonCaptureRecord({
      patient_image_id: imageId,
      patient_id: pid,
      case_id: image.case_id != null ? String(image.case_id) : null,
      anatomical_region: image.anatomical_region != null ? String(image.anatomical_region) : null,
      protocol_template_slug: protocol,
      protocol_slot_slug: slot,
      quality_score: Number(ir.quality_score ?? 0),
      quality_band: String(ir.quality_band ?? "acceptable"),
      clinically_usable: ir.clinically_usable !== false,
      acceptance_status: "accepted",
      captured_at: capturedAt,
      follow_up_interval:
        image.follow_up_interval != null ? String(image.follow_up_interval) : null,
      visit_type: image.visit_type != null ? String(image.visit_type) : null,
      imaging_library_axis: String(image.imaging_library_axis ?? "general_clinical"),
    });
    if (record) records.push(record);
  }

  return records;
}

async function upsertGeneratedPairs(
  tenantId: string,
  patientId: string,
  pairs: VieComparisonPair[],
  client: SupabaseClient
): Promise<void> {
  if (pairs.length === 0) return;
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const now = new Date().toISOString();

  const { data: existing, error: existingErr } = await client
    .from("fi_vie_comparison_pairs")
    .select("before_image_id, after_image_id, comparison_category, review_status")
    .eq("tenant_id", tid)
    .eq("patient_id", pid);
  if (existingErr) throw new Error(existingErr.message);

  const locked = new Set<string>();
  for (const row of existing ?? []) {
    const r = row as Record<string, unknown>;
    const status = String(r.review_status ?? "suggested");
    if (status === "accepted" || status === "dismissed") {
      locked.add(
        `${String(r.before_image_id)}:${String(r.after_image_id)}:${String(r.comparison_category)}`
      );
    }
  }

  const rows = pairs
    .filter((p) => !locked.has(`${p.before_image_id}:${p.after_image_id}:${p.comparison_category}`))
    .map((p) => ({
      tenant_id: tid,
      patient_id: pid,
      case_id: p.case_id,
      before_image_id: p.before_image_id,
      after_image_id: p.after_image_id,
      comparison_category: p.comparison_category,
      anatomical_region: p.anatomical_region,
      slot_family: p.slot_family,
      before_timepoint: p.before_timepoint,
      after_timepoint: p.after_timepoint,
      days_between: p.days_between,
      quality_match_score: p.quality_match_score,
      angle_match_status: p.angle_match_status,
      framing_match_status: p.framing_match_status,
      confidence_band: p.confidence_band,
      recommended_use: p.recommended_use,
      warnings: p.warnings,
      metadata: { comparison_id: p.comparison_id, engine_version: "vie-comparison.v1" },
      review_status: "suggested" as const,
      updated_at: now,
    }));

  if (rows.length === 0) return;

  const { error } = await client.from("fi_vie_comparison_pairs").upsert(rows, {
    onConflict: "tenant_id,before_image_id,after_image_id,comparison_category",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
}

async function pruneStaleSuggestedPairs(
  tenantId: string,
  patientId: string,
  currentPairs: VieComparisonPair[],
  client: SupabaseClient
): Promise<void> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const currentKeys = new Set(
    currentPairs.map((p) => `${p.before_image_id}:${p.after_image_id}:${p.comparison_category}`)
  );

  const { data: suggested, error } = await client
    .from("fi_vie_comparison_pairs")
    .select("id, before_image_id, after_image_id, comparison_category")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("review_status", "suggested");
  if (error) throw new Error(error.message);

  const staleIds = (suggested ?? [])
    .filter((row) => {
      const r = row as Record<string, unknown>;
      const key = `${String(r.before_image_id)}:${String(r.after_image_id)}:${String(r.comparison_category)}`;
      return !currentKeys.has(key);
    })
    .map((row) => String((row as Record<string, unknown>).id));

  if (staleIds.length === 0) return;
  const { error: delErr } = await client
    .from("fi_vie_comparison_pairs")
    .delete()
    .in("id", staleIds);
  if (delErr) throw new Error(delErr.message);
}

/** Best-effort regenerate comparison candidates for a patient (optionally scoped to case). */
export async function generateVieComparisonPairsForPatient(params: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  client?: SupabaseClient;
}): Promise<{ generated_count: number; pairs: VieComparisonPair[] }> {
  const supabase = params.client ?? supabaseAdmin();
  const policy = await loadVieCapturePolicyForTenant(params.tenantId, supabase);
  const records = await loadVieComparisonCaptureRecords(
    params.tenantId,
    params.patientId,
    params.caseId,
    supabase
  );
  const pairs = generateVieComparisonPairs(records, policy.minimum_capture_quality_score);
  await upsertGeneratedPairs(params.tenantId, params.patientId, pairs, supabase);
  await pruneStaleSuggestedPairs(params.tenantId, params.patientId, pairs, supabase);
  return { generated_count: pairs.length, pairs };
}

export async function loadVieComparisonPairsForPatient(
  tenantId: string,
  patientId: string,
  opts?: {
    caseId?: string | null;
    reviewStatus?: VieComparisonReviewStatus | "all";
    client?: SupabaseClient;
  }
): Promise<VieComparisonPairRow[]> {
  const supabase = opts?.client ?? supabaseAdmin();
  let query = supabase
    .from("fi_vie_comparison_pairs")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("quality_match_score", { ascending: false });

  if (opts?.caseId?.trim()) query = query.eq("case_id", opts.caseId.trim());
  if (opts?.reviewStatus && opts.reviewStatus !== "all") {
    query = query.eq("review_status", opts.reviewStatus);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapPairRow(row as Record<string, unknown>));

  const imageIds = [...new Set(rows.flatMap((p) => [p.before_image_id, p.after_image_id]))];
  const alignmentByImageId = await loadAlignmentResultsByImageIds(tenantId, imageIds, supabase);

  return rows.map((pair) => ({
    ...pair,
    alignment: enrichComparisonPairWithAlignment(pair, alignmentByImageId),
  }));
}

export async function loadVieComparisonTimelineForPatient(
  tenantId: string,
  patientId: string,
  caseId?: string | null,
  client?: SupabaseClient
): Promise<VieProgressionTimeline> {
  const records = await loadVieComparisonCaptureRecords(tenantId, patientId, caseId, client);
  return buildVieProgressionTimeline(records, patientId.trim());
}

export async function loadVieComparisonReadinessForPatient(
  tenantId: string,
  patientId: string,
  caseId?: string | null,
  client?: SupabaseClient
) {
  const supabase = client ?? supabaseAdmin();
  const policy = await loadVieCapturePolicyForTenant(tenantId, supabase);
  const records = await loadVieComparisonCaptureRecords(tenantId, patientId, caseId, supabase);
  const pairs = generateVieComparisonPairs(records, policy.minimum_capture_quality_score);
  const timeline = buildVieProgressionTimeline(records, patientId.trim());
  return buildComparisonReadinessSummary({
    pairs,
    timeline,
    minimumQualityScore: policy.minimum_capture_quality_score,
  });
}

export async function updateVieComparisonReviewStatus(params: {
  tenantId: string;
  patientId: string;
  pairId: string;
  reviewStatus: Extract<VieComparisonReviewStatus, "accepted" | "dismissed">;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = params.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_vie_comparison_pairs")
    .update({ review_status: params.reviewStatus, updated_at: now })
    .eq("tenant_id", params.tenantId.trim())
    .eq("patient_id", params.patientId.trim())
    .eq("id", params.pairId.trim());
  if (error) throw new Error(error.message);

  const { regenerateVieOutcomeSummaryBestEffort } = await import("./vieOutcomeIntelligence.server");
  await regenerateVieOutcomeSummaryBestEffort({
    tenantId: params.tenantId,
    patientId: params.patientId,
  });
}

/** Fire-and-forget helper for accept flow — never throws. */
export async function regenerateVieComparisonsBestEffort(params: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
}): Promise<void> {
  try {
    await generateVieComparisonPairsForPatient(params);
    const { regenerateVieOutcomeSummaryBestEffort } =
      await import("./vieOutcomeIntelligence.server");
    await regenerateVieOutcomeSummaryBestEffort(params);
  } catch {
    // best-effort — must not block capture accept
  }
}
