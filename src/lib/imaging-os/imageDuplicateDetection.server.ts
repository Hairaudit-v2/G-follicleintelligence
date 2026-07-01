import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  detectDuplicateInSessionFingerprints,
  type SessionImageFingerprint,
} from "./imageDuplicateDetectionCore";

function readMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadSessionImageFingerprints(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  protocolSessionId: string
): Promise<SessionImageFingerprint[]> {
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("id, storage_path, imaging_protocol_slot_slug, metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .eq("image_status", "active");

  if (error) throw new Error(error.message);

  const out: SessionImageFingerprint[] = [];
  for (const row of data ?? []) {
    const meta = readMetadataObject((row as { metadata?: unknown }).metadata);
    const sessionId = String(meta.protocol_session_id ?? "").trim();
    if (sessionId !== protocolSessionId.trim()) continue;
    const imagingQuality =
      meta.imaging_quality && typeof meta.imaging_quality === "object"
        ? (meta.imaging_quality as Record<string, unknown>)
        : {};
    out.push({
      image_id: String((row as { id: string }).id),
      storage_path: String((row as { storage_path?: string }).storage_path ?? "") || null,
      protocol_slot_slug:
        (row as { imaging_protocol_slot_slug?: string | null }).imaging_protocol_slot_slug ?? null,
      content_hash:
        typeof imagingQuality.content_hash === "string" ? imagingQuality.content_hash : null,
      perceptual_hash:
        typeof imagingQuality.perceptual_hash === "string" ? imagingQuality.perceptual_hash : null,
    });
  }
  return out;
}

export async function detectDuplicateInProtocolSession(input: {
  tenantId: string;
  patientId: string;
  protocolSessionId: string | null | undefined;
  content_hash?: string | null;
  perceptual_hash?: string | null;
  protocol_slot_slug?: string | null;
  storage_path?: string | null;
  client?: SupabaseClient;
}) {
  const sessionId = input.protocolSessionId?.trim();
  if (!sessionId) {
    return { duplicate_status: "unique" as const, matched_image_id: null };
  }

  const supabase = input.client ?? supabaseAdmin();
  const sessionImages = await loadSessionImageFingerprints(
    supabase,
    input.tenantId,
    input.patientId,
    sessionId
  );

  return detectDuplicateInSessionFingerprints({
    candidate: {
      content_hash: input.content_hash,
      perceptual_hash: input.perceptual_hash,
      protocol_slot_slug: input.protocol_slot_slug,
      storage_path: input.storage_path,
    },
    session_images: sessionImages,
  });
}