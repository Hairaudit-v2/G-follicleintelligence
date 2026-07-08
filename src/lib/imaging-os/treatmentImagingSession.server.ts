import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PROGRESS_META_KEY } from "@/src/lib/imaging-os/protocolSlotVocabulary";
import { loadResolvedProtocol } from "@/src/lib/imaging-os/protocolCatalogResolver.server";
import { buildProtocolCatalogCaptureMetadata } from "@/src/lib/imaging-os/protocolCaptureMetadataCore";
import {
  buildTreatmentImagingCompletionState,
  requiresTreatmentPhotosChecklist,
  resolveTreatmentTypeLabel,
  TREATMENT_IMAGING_CAPTURE_SOURCE,
  TREATMENT_IMAGING_CLINICAL_CONTEXT,
  TREATMENT_IMAGING_PROTOCOL_SLUG,
  type TreatmentImagingBookingHints,
} from "@/src/lib/imaging-os/treatmentImagingProtocol";
import {
  parseTreatmentImagingClinicSettings,
  type TreatmentImagingClinicSettings,
} from "@/src/lib/imaging-os/treatmentImagingClinicSettings";
import { evaluateTreatmentImagingCompletionPolicy } from "@/src/lib/imaging-os/treatmentImagingCompletionPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type TreatmentImagingChecklistPayload = {
  applies: boolean;
  sessionId: string | null;
  protocolSlug: typeof TREATMENT_IMAGING_PROTOCOL_SLUG;
  imageContext: typeof TREATMENT_IMAGING_CLINICAL_CONTEXT;
  treatmentType: string;
  completion: ReturnType<typeof buildTreatmentImagingCompletionState>;
  clinicSettings: TreatmentImagingClinicSettings;
  completionPolicy: ReturnType<typeof evaluateTreatmentImagingCompletionPolicy>;
};

function bookingHints(booking: FiBookingRow): TreatmentImagingBookingHints {
  return {
    title: booking.title,
    description: booking.description,
    metadata: booking.metadata,
  };
}

function sessionBookingId(progress: Record<string, unknown>): string | null {
  const meta = progress[PROGRESS_META_KEY];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const treatment = (meta as { treatment_context?: { booking_id?: unknown } }).treatment_context;
  if (treatment && typeof treatment === "object" && !Array.isArray(treatment)) {
    const bid = treatment.booking_id;
    if (typeof bid === "string" && bid.trim()) return bid.trim();
  }
  const surgery = (meta as { surgery_context?: { booking_id?: unknown } }).surgery_context;
  if (surgery && typeof surgery === "object" && !Array.isArray(surgery)) {
    const bid = surgery.booking_id;
    if (typeof bid === "string" && bid.trim()) return bid.trim();
  }
  return null;
}

async function findActiveTreatmentSessionForBooking(
  client: SupabaseClient,
  tenantId: string,
  patientId: string,
  bookingId: string
): Promise<{ id: string; progress: Record<string, unknown> } | null> {
  const { data, error } = await client
    .from("fi_imaging_protocol_sessions")
    .select("id, progress")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("template_slug", TREATMENT_IMAGING_PROTOCOL_SLUG)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const progress =
      r.progress && typeof r.progress === "object" && !Array.isArray(r.progress)
        ? (r.progress as Record<string, unknown>)
        : {};
    const meta = progress[PROGRESS_META_KEY];
    const status =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? String((meta as { status?: string }).status ?? "")
        : "";
    if (status === "completed") continue;
    if (sessionBookingId(progress) === bookingId) {
      return { id: String(r.id), progress };
    }
  }
  return null;
}

export async function ensureTreatmentImagingSession(
  input: {
    tenantId: string;
    patientId: string;
    booking: FiBookingRow;
    client?: SupabaseClient;
  }
): Promise<{ sessionId: string; created: boolean; progress: Record<string, unknown> }> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const bookingId = input.booking.id.trim();
  const hints = bookingHints(input.booking);

  const existing = await findActiveTreatmentSessionForBooking(client, tid, pid, bookingId);
  if (existing) {
    return { sessionId: existing.id, created: false, progress: existing.progress };
  }

  const resolved = await loadResolvedProtocol(tid, TREATMENT_IMAGING_PROTOCOL_SLUG, client);
  const catalogMeta = buildProtocolCatalogCaptureMetadata(resolved);
  const treatmentType = resolveTreatmentTypeLabel(input.booking.booking_type, hints);
  const now = new Date().toISOString();
  const progressMeta: Record<string, unknown> = {
    status: "active" as const,
    capture_source: TREATMENT_IMAGING_CAPTURE_SOURCE,
    image_context: TREATMENT_IMAGING_CLINICAL_CONTEXT,
    treatment_context: {
      booking_id: bookingId,
      treatment_type: treatmentType,
      image_context: TREATMENT_IMAGING_CLINICAL_CONTEXT,
      protocol_slug: TREATMENT_IMAGING_PROTOCOL_SLUG,
    },
    ...catalogMeta,
  };

  const { data: ins, error } = await client
    .from("fi_imaging_protocol_sessions")
    .insert({
      id: randomUUID(),
      tenant_id: tid,
      patient_id: pid,
      case_id: input.booking.case_id?.trim() || null,
      consultation_id: null,
      template_slug: TREATMENT_IMAGING_PROTOCOL_SLUG,
      progress: { [PROGRESS_META_KEY]: progressMeta },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    sessionId: String((ins as { id: string }).id),
    created: true,
    progress: { [PROGRESS_META_KEY]: progressMeta },
  };
}

async function loadClinicImagingSettings(
  client: SupabaseClient,
  tenantId: string,
  clinicId: string | null
): Promise<TreatmentImagingClinicSettings> {
  if (!clinicId?.trim()) return parseTreatmentImagingClinicSettings(null);
  const { data, error } = await client
    .from("fi_clinic_settings")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const metadata =
    data && typeof data === "object" && !Array.isArray(data)
      ? ((data as { metadata?: unknown }).metadata as Record<string, unknown> | null)
      : null;
  return parseTreatmentImagingClinicSettings(metadata);
}

export async function loadTreatmentImagingChecklistForBooking(
  input: {
    tenantId: string;
    booking: FiBookingRow;
    client?: SupabaseClient;
  }
): Promise<TreatmentImagingChecklistPayload> {
  const hints = bookingHints(input.booking);
  const applies = requiresTreatmentPhotosChecklist(input.booking.booking_type, hints);
  const emptyCompletion = buildTreatmentImagingCompletionState({});
  const client = input.client ?? supabaseAdmin();
  const clinicSettings = await loadClinicImagingSettings(
    client,
    input.tenantId.trim(),
    input.booking.clinic_id
  );

  if (!applies || !input.booking.patient_id?.trim()) {
    return {
      applies,
      sessionId: null,
      protocolSlug: TREATMENT_IMAGING_PROTOCOL_SLUG,
      imageContext: TREATMENT_IMAGING_CLINICAL_CONTEXT,
      treatmentType: resolveTreatmentTypeLabel(input.booking.booking_type, hints),
      completion: emptyCompletion,
      clinicSettings,
      completionPolicy: evaluateTreatmentImagingCompletionPolicy({
        applies,
        completion: emptyCompletion,
        clinicSettings,
      }),
    };
  }

  const session = await findActiveTreatmentSessionForBooking(
    client,
    input.tenantId.trim(),
    input.booking.patient_id.trim(),
    input.booking.id.trim()
  );
  const progress = session?.progress ?? {};
  const completion = buildTreatmentImagingCompletionState(progress);

  return {
    applies,
    sessionId: session?.id ?? null,
    protocolSlug: TREATMENT_IMAGING_PROTOCOL_SLUG,
    imageContext: TREATMENT_IMAGING_CLINICAL_CONTEXT,
    treatmentType: resolveTreatmentTypeLabel(input.booking.booking_type, hints),
    completion,
    clinicSettings,
    completionPolicy: evaluateTreatmentImagingCompletionPolicy({
      applies,
      completion,
      clinicSettings,
    }),
  };
}

export async function validateTreatmentPhotosForBookingCompletion(
  input: {
    tenantId: string;
    booking: FiBookingRow;
    client?: SupabaseClient;
  }
): Promise<ReturnType<typeof evaluateTreatmentImagingCompletionPolicy>> {
  const checklist = await loadTreatmentImagingChecklistForBooking(input);
  return checklist.completionPolicy;
}
