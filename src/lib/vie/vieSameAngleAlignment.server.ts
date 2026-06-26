import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVieProtocol } from "./vieProtocolCatalog";
import {
  buildCaptureReferenceGuidance,
  buildCaptureStandardizationMetadata,
  buildPatientTwinAlignmentSummary,
  captureDistanceHintForSlot,
  captureGuideForSlot,
  deriveCaptureOrientation,
  evaluateSameAngleAlignment,
  isStandardizedEvidence,
  selectBestReferenceImage,
} from "./vieSameAngleAlignmentCore";
import {
  buildComparisonCaptureRecord,
  deriveSlotFamily,
  deriveSlotFraming,
} from "./vieLongitudinalComparisonCore";
import type {
  VieAlignmentCaptureInput,
  VieAlignmentReferenceCandidate,
  VieAlignmentResultRow,
  VieCaptureReferenceGuidance,
  VieComparisonPairAlignment,
  ViePatientTwinAlignmentSummary,
  VieSameAngleAlignmentResult,
} from "./vieAlignmentTypes";
function mapAlignmentRow(row: Record<string, unknown>): VieAlignmentResultRow {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    image_id: String(row.image_id),
    engine_version: "vie-alignment.v1",
    alignment_score: Number(row.alignment_score ?? 0),
    alignment_status: String(row.alignment_status) as VieAlignmentResultRow["alignment_status"],
    confidence_band: String(row.confidence_band ?? "medium") as VieAlignmentResultRow["confidence_band"],
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    reference_image_id: row.reference_image_id != null ? String(row.reference_image_id) : null,
    reference_captured_at:
      typeof metadata.reference_captured_at === "string" ? metadata.reference_captured_at : null,
    reference_slot_label:
      typeof metadata.reference_slot_label === "string" ? metadata.reference_slot_label : null,
    days_since_reference:
      typeof metadata.days_since_reference === "number" ? metadata.days_since_reference : null,
    angle_match_status: "pending_ai_vision",
    anatomical_region: String(row.anatomical_region),
    slot_family: String(row.slot_family),
    metadata,
    created_at: String(row.created_at),
  };
}

async function loadReferenceCandidates(
  tenantId: string,
  patientId: string,
  excludeImageId: string | null,
  client: SupabaseClient
): Promise<VieAlignmentReferenceCandidate[]> {
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data: intelRows, error: intelErr } = await client
    .from("fi_vie_capture_intelligence")
    .select(
      "patient_image_id, protocol_template_slug, protocol_slot_slug, quality_score, acceptance_status, created_at, accepted_at"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("acceptance_status", "accepted");
  if (intelErr) throw new Error(intelErr.message);
  if (!intelRows?.length) return [];

  const imageIds = intelRows
    .map((r) => String((r as Record<string, unknown>).patient_image_id))
    .filter((id) => id !== excludeImageId);

  if (imageIds.length === 0) return [];

  const { data: imageRows, error: imageErr } = await client
    .from("fi_patient_images")
    .select(
      "id, patient_id, anatomical_region, imaging_library_axis, visit_type, follow_up_interval, taken_at, created_at, imaging_protocol_template_slug, imaging_protocol_slot_slug, image_width, image_height, metadata"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .in("id", imageIds)
    .eq("image_status", "active");
  if (imageErr) throw new Error(imageErr.message);

  const imageById = new Map(
    (imageRows ?? []).map((row) => [String((row as Record<string, unknown>).id), row as Record<string, unknown>])
  );

  const candidates: VieAlignmentReferenceCandidate[] = [];

  for (const intel of intelRows) {
    const ir = intel as Record<string, unknown>;
    const imageId = String(ir.patient_image_id);
    if (excludeImageId && imageId === excludeImageId) continue;

    const image = imageById.get(imageId);
    if (!image) continue;

    const protocol = String(ir.protocol_template_slug ?? image.imaging_protocol_template_slug ?? "").trim();
    const slot = String(ir.protocol_slot_slug ?? image.imaging_protocol_slot_slug ?? "").trim();
    if (!protocol || !slot) continue;

    const record = buildComparisonCaptureRecord({
      patient_image_id: imageId,
      patient_id: pid,
      case_id: null,
      anatomical_region: image.anatomical_region != null ? String(image.anatomical_region) : null,
      protocol_template_slug: protocol,
      protocol_slot_slug: slot,
      quality_score: Number(ir.quality_score ?? 0),
      quality_band: "acceptable",
      clinically_usable: true,
      acceptance_status: "accepted",
      captured_at: String(ir.accepted_at ?? ir.created_at ?? image.taken_at ?? image.created_at),
      follow_up_interval: image.follow_up_interval != null ? String(image.follow_up_interval) : null,
      visit_type: image.visit_type != null ? String(image.visit_type) : null,
      imaging_library_axis: String(image.imaging_library_axis ?? "general_clinical"),
    });
    if (!record) continue;

    const meta =
      image.metadata && typeof image.metadata === "object" && !Array.isArray(image.metadata)
        ? (image.metadata as Record<string, unknown>)
        : {};
    const std = meta.vie_capture_standardization;
    const stdObj =
      std && typeof std === "object" && !Array.isArray(std) ? (std as Record<string, unknown>) : null;

    const width = image.image_width != null ? Number(image.image_width) : null;
    const height = image.image_height != null ? Number(image.image_height) : null;

    candidates.push({
      image_id: imageId,
      patient_id: pid,
      anatomical_region: record.anatomical_region,
      slot_family: record.slot_family,
      framing: record.framing,
      protocol_template_slug: protocol,
      protocol_slot_slug: slot,
      quality_score: record.quality_score,
      captured_at: record.captured_at,
      visit_type: record.visit_type,
      image_width: Number.isFinite(width) ? width : null,
      image_height: Number.isFinite(height) ? height : null,
      orientation:
        stdObj?.orientation != null
          ? (String(stdObj.orientation) as VieAlignmentReferenceCandidate["orientation"])
          : deriveCaptureOrientation(width, height),
      capture_distance_hint:
        stdObj?.capture_distance_hint != null
          ? String(stdObj.capture_distance_hint)
          : captureDistanceHintForSlot(protocol, slot),
      capture_guide: captureGuideForSlot(protocol, slot),
      journey_stage: record.journey_stage,
    });
  }

  return candidates;
}

export async function buildAlignmentCaptureInput(params: {
  tenantId: string;
  patientId: string;
  imageId: string;
  client?: SupabaseClient;
}): Promise<VieAlignmentCaptureInput | null> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const imageId = params.imageId.trim();

  const { data: intel, error: intelErr } = await supabase
    .from("fi_vie_capture_intelligence")
    .select(
      "patient_image_id, protocol_template_slug, protocol_slot_slug, quality_score, acceptance_status, created_at, accepted_at"
    )
    .eq("tenant_id", tid)
    .eq("patient_image_id", imageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intelErr) throw new Error(intelErr.message);

  const { data: image, error: imageErr } = await supabase
    .from("fi_patient_images")
    .select(
      "id, patient_id, anatomical_region, imaging_library_axis, visit_type, follow_up_interval, taken_at, created_at, imaging_protocol_template_slug, imaging_protocol_slot_slug, image_width, image_height, metadata"
    )
    .eq("tenant_id", tid)
    .eq("id", imageId)
    .maybeSingle();
  if (imageErr) throw new Error(imageErr.message);
  if (!image) return null;

  const ir = (intel ?? {}) as Record<string, unknown>;
  const img = image as Record<string, unknown>;
  const protocol = String(ir.protocol_template_slug ?? img.imaging_protocol_template_slug ?? "").trim();
  const slot = String(ir.protocol_slot_slug ?? img.imaging_protocol_slot_slug ?? "").trim();
  if (!protocol || !slot) return null;

  const record = buildComparisonCaptureRecord({
    patient_image_id: imageId,
    patient_id: params.patientId.trim(),
    case_id: null,
    anatomical_region: img.anatomical_region != null ? String(img.anatomical_region) : null,
    protocol_template_slug: protocol,
    protocol_slot_slug: slot,
    quality_score: Number(ir.quality_score ?? 0),
    quality_band: "acceptable",
    clinically_usable: true,
    acceptance_status: String(ir.acceptance_status ?? "pending") as "accepted",
    captured_at: String(ir.accepted_at ?? ir.created_at ?? img.taken_at ?? img.created_at),
    follow_up_interval: img.follow_up_interval != null ? String(img.follow_up_interval) : null,
    visit_type: img.visit_type != null ? String(img.visit_type) : null,
    imaging_library_axis: String(img.imaging_library_axis ?? "general_clinical"),
  });
  if (!record) return null;

  const width = img.image_width != null ? Number(img.image_width) : null;
  const height = img.image_height != null ? Number(img.image_height) : null;

  return {
    image_id: imageId,
    patient_id: params.patientId.trim(),
    anatomical_region: record.anatomical_region,
    slot_family: record.slot_family,
    framing: record.framing,
    protocol_template_slug: protocol,
    protocol_slot_slug: slot,
    quality_score: record.quality_score,
    captured_at: record.captured_at,
    visit_type: record.visit_type,
    image_width: Number.isFinite(width) ? width : null,
    image_height: Number.isFinite(height) ? height : null,
    orientation: deriveCaptureOrientation(width, height),
    capture_distance_hint: captureDistanceHintForSlot(protocol, slot),
    capture_guide: captureGuideForSlot(protocol, slot),
    journey_stage: record.journey_stage,
  };
}

export async function previewVieSameAngleAlignment(params: {
  tenantId: string;
  patientId: string;
  imageId: string;
  client?: SupabaseClient;
}): Promise<VieSameAngleAlignmentResult> {
  const supabase = params.client ?? supabaseAdmin();
  const capture = await buildAlignmentCaptureInput(params);
  if (!capture) {
    return evaluateSameAngleAlignment(
      {
        image_id: params.imageId,
        patient_id: params.patientId.trim(),
        anatomical_region: "unknown",
        slot_family: "unknown",
        framing: "overview",
        protocol_template_slug: "",
        protocol_slot_slug: "",
        quality_score: 0,
        captured_at: new Date().toISOString(),
        visit_type: null,
        image_width: null,
        image_height: null,
        orientation: "unknown",
        capture_distance_hint: null,
        capture_guide: null,
        journey_stage: "consultation",
      },
      null
    );
  }

  const candidates = await loadReferenceCandidates(
    params.tenantId,
    params.patientId,
    params.imageId,
    supabase
  );
  const reference = selectBestReferenceImage(candidates, capture);
  return evaluateSameAngleAlignment(capture, reference);
}

export async function loadVieCaptureReferenceGuidance(params: {
  tenantId: string;
  patientId: string;
  protocolTemplateSlug: string;
  protocolSlotSlug: string;
  client?: SupabaseClient;
}): Promise<VieCaptureReferenceGuidance> {
  const supabase = params.client ?? supabaseAdmin();
  const protocol = params.protocolTemplateSlug.trim();
  const slot = params.protocolSlotSlug.trim();
  const framing = deriveSlotFraming(slot, protocol);
  const slotFamily = deriveSlotFamily(slot);
  const region =
    getVieProtocolSlotRegion(protocol, slot) ?? "unknown";

  const candidates = await loadReferenceCandidates(params.tenantId, params.patientId, null, supabase);
  const pseudoCapture: VieAlignmentCaptureInput = {
    image_id: "__preview__",
    patient_id: params.patientId.trim(),
    anatomical_region: region,
    slot_family: slotFamily,
    framing,
    protocol_template_slug: protocol,
    protocol_slot_slug: slot,
    quality_score: 0,
    captured_at: new Date().toISOString(),
    visit_type: null,
    image_width: null,
    image_height: null,
    orientation: "unknown",
    capture_distance_hint: captureDistanceHintForSlot(protocol, slot),
    capture_guide: captureGuideForSlot(protocol, slot),
    journey_stage: "consultation",
  };

  const reference = selectBestReferenceImage(candidates, pseudoCapture);
  return buildCaptureReferenceGuidance(reference);
}

function getVieProtocolSlotRegion(protocolSlug: string, slotSlug: string): string | null {
  const slot = getVieProtocol(protocolSlug)?.slots.find((s) => s.slug === slotSlug);
  return slot?.suggested_region ?? null;
}

async function persistAlignmentResult(
  tenantId: string,
  patientId: string,
  capture: VieAlignmentCaptureInput,
  alignment: VieSameAngleAlignmentResult,
  client: SupabaseClient
): Promise<void> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const now = new Date().toISOString();

  const row = {
    tenant_id: tid,
    patient_id: pid,
    image_id: capture.image_id,
    reference_image_id: alignment.reference_image_id,
    anatomical_region: capture.anatomical_region,
    slot_family: capture.slot_family,
    alignment_score: alignment.alignment_score,
    alignment_status: alignment.alignment_status,
    confidence_band: alignment.confidence_band,
    warnings: alignment.warnings,
    metadata: {
      ...alignment.metadata,
      engine_version: alignment.engine_version,
      angle_match_status: alignment.angle_match_status,
      reference_captured_at: alignment.reference_captured_at,
      reference_slot_label: alignment.reference_slot_label,
      days_since_reference: alignment.days_since_reference,
      protocol_template_slug: capture.protocol_template_slug,
      protocol_slot_slug: capture.protocol_slot_slug,
    },
    created_at: now,
  };

  const { error } = await client.from("fi_vie_alignment_results").upsert(row, {
    onConflict: "tenant_id,image_id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
}

async function persistCaptureStandardizationMetadata(
  tenantId: string,
  imageId: string,
  capture: VieAlignmentCaptureInput,
  alignment: VieSameAngleAlignmentResult,
  client: SupabaseClient
): Promise<void> {
  const { data: image, error: fetchErr } = await client
    .from("fi_patient_images")
    .select("metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("id", imageId.trim())
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!image) return;

  const existing =
    image.metadata && typeof image.metadata === "object" && !Array.isArray(image.metadata)
      ? (image.metadata as Record<string, unknown>)
      : {};

  const standardization = buildCaptureStandardizationMetadata(capture, alignment);
  const merged = {
    ...existing,
    vie_capture_standardization: standardization,
  };

  const { error: updateErr } = await client
    .from("fi_patient_images")
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId.trim())
    .eq("id", imageId.trim());
  if (updateErr) throw new Error(updateErr.message);
}

/** Evaluate and persist alignment for an accepted capture. */
export async function evaluateAndPersistVieAlignment(params: {
  tenantId: string;
  patientId: string;
  imageId: string;
  client?: SupabaseClient;
}): Promise<VieSameAngleAlignmentResult> {
  const supabase = params.client ?? supabaseAdmin();
  const capture = await buildAlignmentCaptureInput(params);
  if (!capture) {
    const empty = evaluateSameAngleAlignment(
      {
        image_id: params.imageId,
        patient_id: params.patientId.trim(),
        anatomical_region: "unknown",
        slot_family: "unknown",
        framing: "overview",
        protocol_template_slug: "",
        protocol_slot_slug: "",
        quality_score: 0,
        captured_at: new Date().toISOString(),
        visit_type: null,
        image_width: null,
        image_height: null,
        orientation: "unknown",
        capture_distance_hint: null,
        capture_guide: null,
        journey_stage: "consultation",
      },
      null
    );
    await persistAlignmentResult(params.tenantId, params.patientId, {
      ...empty,
      image_id: params.imageId,
      patient_id: params.patientId.trim(),
      anatomical_region: "unknown",
      slot_family: "unknown",
      framing: "overview",
      protocol_template_slug: "",
      protocol_slot_slug: "",
      quality_score: 0,
      captured_at: new Date().toISOString(),
      visit_type: null,
      image_width: null,
      image_height: null,
      orientation: "unknown",
      capture_distance_hint: null,
      capture_guide: null,
      journey_stage: "consultation",
    } as VieAlignmentCaptureInput, empty, supabase);
    return empty;
  }

  const candidates = await loadReferenceCandidates(
    params.tenantId,
    params.patientId,
    capture.image_id,
    supabase
  );
  const reference = selectBestReferenceImage(candidates, capture);
  const alignment = evaluateSameAngleAlignment(capture, reference);

  await persistAlignmentResult(params.tenantId, params.patientId, capture, alignment, supabase);
  await persistCaptureStandardizationMetadata(params.tenantId, capture.image_id, capture, alignment, supabase);

  return alignment;
}

/** Fire-and-forget helper for accept flow — never throws. */
export async function evaluateVieAlignmentBestEffort(params: {
  tenantId: string;
  patientId: string;
  imageId: string;
}): Promise<void> {
  try {
    await evaluateAndPersistVieAlignment(params);
  } catch {
    // best-effort — must not block capture accept
  }
}

export async function loadVieAlignmentResultsForPatient(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<VieAlignmentResultRow[]> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_vie_alignment_results")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAlignmentRow(row as Record<string, unknown>));
}

export async function loadVieAlignmentResultForImage(
  tenantId: string,
  imageId: string,
  client?: SupabaseClient
): Promise<VieAlignmentResultRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_vie_alignment_results")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("image_id", imageId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAlignmentRow(data as Record<string, unknown>) : null;
}

export function enrichComparisonPairWithAlignment(
  pair: { before_image_id: string; after_image_id: string },
  alignmentByImageId: Map<string, VieAlignmentResultRow>
): VieComparisonPairAlignment {
  const afterAlignment = alignmentByImageId.get(pair.after_image_id);
  const direct =
    afterAlignment?.reference_image_id === pair.before_image_id ? afterAlignment : null;

  if (!direct) {
    const fallback = afterAlignment;
    if (!fallback || fallback.alignment_status === "no_reference_available") {
      return {
        alignment_score: null,
        alignment_status: null,
        confidence_band: null,
        is_standardized_evidence: false,
      };
    }
    return {
      alignment_score: fallback.alignment_score,
      alignment_status: fallback.alignment_status,
      confidence_band: fallback.confidence_band,
      is_standardized_evidence: isStandardizedEvidence(fallback.alignment_status, fallback.alignment_score),
    };
  }

  return {
    alignment_score: direct.alignment_score,
    alignment_status: direct.alignment_status,
    confidence_band: direct.confidence_band,
    is_standardized_evidence: isStandardizedEvidence(direct.alignment_status, direct.alignment_score),
  };
}

export async function loadPatientTwinAlignmentSummary(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<ViePatientTwinAlignmentSummary> {
  const results = await loadVieAlignmentResultsForPatient(tenantId, patientId, client);
  return buildPatientTwinAlignmentSummary(
    results.map((r) => ({
      anatomical_region: r.anatomical_region,
      slot_family: r.slot_family,
      alignment_score: r.alignment_score,
      alignment_status: r.alignment_status,
      protocol_slot_slug:
        typeof r.metadata.protocol_slot_slug === "string" ? r.metadata.protocol_slot_slug : undefined,
      protocol_template_slug:
        typeof r.metadata.protocol_template_slug === "string" ? r.metadata.protocol_template_slug : undefined,
    }))
  );
}

export async function loadAlignmentResultsByImageIds(
  tenantId: string,
  imageIds: string[],
  client?: SupabaseClient
): Promise<Map<string, VieAlignmentResultRow>> {
  if (imageIds.length === 0) return new Map();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_vie_alignment_results")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .in("image_id", imageIds);
  if (error) throw new Error(error.message);

  const map = new Map<string, VieAlignmentResultRow>();
  for (const row of data ?? []) {
    const mapped = mapAlignmentRow(row as Record<string, unknown>);
    map.set(mapped.image_id, mapped);
  }
  return map;
}
