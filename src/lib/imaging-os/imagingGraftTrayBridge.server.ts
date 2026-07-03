import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildGraftTrayLinkMetadata,
  deriveGraftTrayReviewReasons,
  isGraftTrayCapture,
  type GraftTrayLinkStatus,
} from "./imagingGraftTrayBridgeCore";

export type GraftTrayLinkRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  image_id: string;
  surgery_case_id: string | null;
  surgery_id: string | null;
  booking_id: string | null;
  graft_session_id: string | null;
  graft_count_event_id: string | null;
  protocol_session_id: string | null;
  protocol_slot_slug: string;
  captured_at: string;
  captured_by_staff_id: string | null;
  status: GraftTrayLinkStatus;
  review_required: boolean;
  mismatch_reason: string | null;
  metadata: Record<string, unknown>;
};

async function resolveSurgeryIdForContext(
  client: SupabaseClient,
  tenantId: string,
  input: {
    surgeryId?: string | null;
    caseId?: string | null;
    bookingId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  const explicit = input.surgeryId?.trim();
  if (explicit) return explicit;

  const meta = input.metadata ?? {};
  const surgeryContext =
    meta.surgery_context && typeof meta.surgery_context === "object"
      ? (meta.surgery_context as Record<string, unknown>)
      : null;
  const fromMeta = surgeryContext?.surgery_id;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();

  const caseId = input.caseId?.trim();
  if (caseId) {
    const { data } = await client
      .from("fi_surgeries")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  const bookingId = input.bookingId?.trim();
  if (bookingId) {
    const { data } = await client
      .from("fi_surgeries")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  return null;
}

async function resolveGraftSessionId(
  client: SupabaseClient,
  tenantId: string,
  surgeryId: string | null
): Promise<string | null> {
  if (!surgeryId) return null;
  const { data, error } = await client
    .from("fi_surgery_graft_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("surgery_id", surgeryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

export async function linkGraftTrayImageAfterCapture(input: {
  tenantId: string;
  patientId: string;
  imageId: string;
  protocolSessionId?: string | null;
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  surgeryId?: string | null;
  capturedByStaffId?: string | null;
  captureSource?: string | null;
  metadata?: Record<string, unknown>;
  qualityNeedsReview?: boolean;
  client?: SupabaseClient;
}): Promise<GraftTrayLinkRow | null> {
  if (
    !isGraftTrayCapture({
      protocolSlotSlug: input.protocolSlotSlug,
      imageCategory: input.imageCategory,
      anatomicalRegion: input.anatomicalRegion,
      metadata: input.metadata,
    })
  ) {
    return null;
  }

  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const imageId = input.imageId.trim();

  const surgeryId = await resolveSurgeryIdForContext(client, tid, {
    surgeryId: input.surgeryId,
    caseId: input.caseId,
    bookingId: input.bookingId,
    metadata: input.metadata,
  });
  const graftSessionId = await resolveGraftSessionId(client, tid, surgeryId);

  const reviewReasons = deriveGraftTrayReviewReasons({
    reviewRequired: true,
    reconciliationEvidenceRequired: true,
    qualityNeedsReview: input.qualityNeedsReview === true,
    missingProtocolSlot: !input.protocolSlotSlug?.trim(),
  });

  const now = new Date().toISOString();
  const linkMetadata = buildGraftTrayLinkMetadata({
    captureSource: input.captureSource?.trim() || "surgery_os",
    protocolSessionId: input.protocolSessionId,
    surgeryContext:
      input.metadata?.surgery_context && typeof input.metadata.surgery_context === "object"
        ? (input.metadata.surgery_context as Record<string, unknown>)
        : null,
  });

  const row = {
    id: randomUUID(),
    tenant_id: tid,
    patient_id: pid,
    image_id: imageId,
    surgery_case_id: input.caseId?.trim() || null,
    surgery_id: surgeryId,
    booking_id: input.bookingId?.trim() || null,
    graft_session_id: graftSessionId,
    graft_count_event_id: null,
    protocol_session_id: input.protocolSessionId?.trim() || null,
    protocol_slot_slug: input.protocolSlotSlug?.trim() || "graft_tray",
    captured_at: now,
    captured_by_staff_id: input.capturedByStaffId?.trim() || null,
    status: (input.qualityNeedsReview ? "review_required" : "linked") as GraftTrayLinkStatus,
    review_required: true,
    mismatch_reason: null,
    metadata: {
      ...linkMetadata,
      review_reasons: reviewReasons,
    },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client
    .from("fi_imaging_graft_tray_links")
    .upsert(row, { onConflict: "tenant_id,image_id", ignoreDuplicates: false })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const graftTrayMetaPatch = {
    graft_tray_link_id: row.id,
    graft_tray_review_reasons: reviewReasons,
    graft_tray_reconciliation_evidence: true,
  };

  const existingMeta =
    input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  await client
    .from("fi_patient_images")
    .update({
      metadata: { ...existingMeta, ...graftTrayMetaPatch },
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", imageId);

  return data as GraftTrayLinkRow;
}

export async function countGraftTrayLinksForSurgery(
  tenantId: string,
  surgeryId: string,
  client?: SupabaseClient
): Promise<number> {
  const supabase = client ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_imaging_graft_tray_links")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .eq("surgery_id", surgeryId.trim())
    .neq("status", "superseded");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadGraftTrayLinksForSurgeries(
  tenantId: string,
  surgeryIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, GraftTrayLinkRow[]>> {
  const out = new Map<string, GraftTrayLinkRow[]>();
  if (!surgeryIds.length) return out;
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_imaging_graft_tray_links")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .in("surgery_id", surgeryIds as string[])
    .neq("status", "superseded")
    .order("captured_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as GraftTrayLinkRow;
    const sid = r.surgery_id;
    if (!sid) continue;
    const list = out.get(sid) ?? [];
    list.push(r);
    out.set(sid, list);
  }
  return out;
}