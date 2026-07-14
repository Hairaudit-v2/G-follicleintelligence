import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildGraftTrayImageMetadataPatch,
  buildGraftTrayLinkInsertRow,
  isGraftTrayLinkEligible,
  mergeGraftTrayImageMetadata,
  resolveGraftTrayCaptureContext,
  type FlatGraftTrayLinkInput,
  type GraftTrayCaptureContext,
} from "./graftTrayCaptureContext";
import type { GraftTrayLinkStatus } from "./imagingGraftTrayBridgeCore";

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
  surgeryContext: GraftTrayCaptureContext["surgeryContext"]
): Promise<string | null> {
  const explicit = surgeryContext.surgeryId?.trim();
  if (explicit) return explicit;

  const caseId = surgeryContext.caseId?.trim();
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

  const bookingId = surgeryContext.bookingId?.trim();
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

export async function linkGraftTrayImageAfterCapture(
  input: FlatGraftTrayLinkInput | GraftTrayCaptureContext
): Promise<GraftTrayLinkRow | null> {
  const ctx = resolveGraftTrayCaptureContext(input);
  if (!isGraftTrayLinkEligible(ctx)) {
    return null;
  }

  const client = !isGroupedContext(input) && input.client ? input.client : supabaseAdmin();

  const surgeryId = await resolveSurgeryIdForContext(client, ctx.tenantId, ctx.surgeryContext);
  const graftSessionId = await resolveGraftSessionId(client, ctx.tenantId, surgeryId);

  const linkId = randomUUID();
  const now = new Date().toISOString();
  const insertRow = buildGraftTrayLinkInsertRow(ctx, {
    surgeryId,
    graftSessionId,
    linkId,
    capturedAt: now,
  });

  const row = {
    id: linkId,
    ...insertRow,
    captured_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client
    .from("fi_imaging_graft_tray_links")
    .upsert(row, { onConflict: "tenant_id,image_id", ignoreDuplicates: false })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const metaPatch = buildGraftTrayImageMetadataPatch(ctx, linkId);
  await client
    .from("fi_patient_images")
    .update({
      metadata: mergeGraftTrayImageMetadata(ctx.capture.metadata, metaPatch),
      updated_at: now,
    })
    .eq("tenant_id", ctx.tenantId)
    .eq("id", ctx.imageId);

  return data as GraftTrayLinkRow;
}

function isGroupedContext(
  input: FlatGraftTrayLinkInput | GraftTrayCaptureContext
): input is GraftTrayCaptureContext {
  return "slot" in input && "surgeryContext" in input && "capture" in input;
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
