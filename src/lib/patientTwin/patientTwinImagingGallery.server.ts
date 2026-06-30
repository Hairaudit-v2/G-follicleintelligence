import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPatientImageSignedUrls, mapRow } from "@/src/lib/patientImages/patientImagesServer";
import type {
  PatientTwinImagingGallerySection,
  PatientTwinImagingGalleryUiSection,
} from "@/src/lib/patientTwin/patientTwinTypes";
import {
  buildPatientJourneyGallery,
  buildTwinImagingUiSections,
  type PatientJourneyGalleryImageInput,
  type TwinImagingUiSection,
} from "@/src/lib/patientTwin/patientJourneyGallery";

async function loadProcedureYmdByCaseId(
  supabase: SupabaseClient,
  tenantId: string,
  caseIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (caseIds.length === 0) return out;
  const { data, error } = await supabase
    .from("fi_case_procedures")
    .select("case_id, procedure_date, updated_at")
    .eq("tenant_id", tenantId)
    .in("case_id", caseIds);
  if (error || !data) return out;
  const rows = data as { case_id: string; procedure_date: string | null; updated_at: string }[];
  const sorted = [...rows].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  for (const r of sorted) {
    const cid = String(r.case_id ?? "").trim();
    if (!cid || out.has(cid)) continue;
    const pd = r.procedure_date != null ? String(r.procedure_date).trim().slice(0, 10) : "";
    if (pd) out.set(cid, pd);
  }
  return out;
}

const GALLERY_LIMIT = 60;

function emptyGallerySection(): PatientTwinImagingGallerySection {
  const j = buildPatientJourneyGallery([]);
  const ui = buildTwinImagingUiSections(j);
  const ui_sections: PatientTwinImagingGalleryUiSection[] = ui.map((s) => ({
    key: s.key,
    title: s.title,
    items: [],
  }));
  return { items: [], ui_sections };
}

function mapUiSectionsToGalleryItems(
  uiMeta: TwinImagingUiSection<PatientJourneyGalleryImageInput>[],
  itemsById: Map<string, PatientTwinImagingGallerySection["items"][number]>
): PatientTwinImagingGalleryUiSection[] {
  return uiMeta.map((sec) => ({
    key: sec.key,
    title: sec.title,
    items: sec.items.map((j) => {
      const full = itemsById.get(j.id);
      if (!full) throw new Error(`Twin gallery item missing for id ${j.id}`);
      return full;
    }),
  }));
}

export async function loadPatientTwinImagingGallerySection(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientTwinImagingGallerySection> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data: rows, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("image_status", "active")
    .order("created_at", { ascending: false })
    .limit(GALLERY_LIMIT);

  if (error) {
    const m = error.message ?? "";
    if (m.includes("does not exist") || m.includes("schema cache")) {
      return emptyGallerySection();
    }
    throw new Error(error.message);
  }

  const mapped = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));
  if (mapped.length === 0) {
    return emptyGallerySection();
  }

  const caseIds = Array.from(
    new Set(mapped.map((m) => m.case_id).filter((x): x is string => Boolean(x)))
  );
  const procByCase = await loadProcedureYmdByCaseId(supabase, tid, caseIds);

  const signedMap = await createPatientImageSignedUrls(
    mapped.map((m) => ({
      id: m.id,
      storage_bucket: m.storage_bucket,
      storage_path: m.storage_path,
    })),
    supabase
  );

  const items: PatientTwinImagingGallerySection["items"] = mapped.flatMap((img) => {
    const s = signedMap.get(img.id);
    if (!s) return [];
    return [
      {
        id: img.id,
        thumbnail_url: s.url,
        signed_expires_at: s.expiresAtIso,
        taken_at: img.taken_at,
        created_at: img.created_at,
        ai_image_category: img.ai_image_category ?? null,
        ai_image_category_confidence: img.ai_image_category_confidence ?? null,
        ai_hair_state: img.ai_hair_state ?? null,
        ai_shave_state: img.ai_shave_state ?? null,
        ai_surgery_stage: img.ai_surgery_stage ?? null,
        ai_image_review_status: img.ai_image_review_status,
        ai_image_ai_notes: img.ai_image_ai_notes ?? null,
        ai_image_classified_at: img.ai_image_classified_at ?? null,
      },
    ];
  });

  if (items.length === 0) {
    return emptyGallerySection();
  }

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const signedIds = new Set(items.map((i) => i.id));

  const journeyInputs: PatientJourneyGalleryImageInput[] = mapped
    .filter((img) => signedIds.has(img.id))
    .map((img) => ({
      id: img.id,
      taken_at: img.taken_at,
      created_at: img.created_at,
      case_id: img.case_id,
      procedure_date_ymd: img.case_id ? (procByCase.get(img.case_id) ?? null) : null,
      ai_image_category: img.ai_image_category ?? null,
      ai_image_category_confidence: img.ai_image_category_confidence ?? null,
      ai_surgery_stage: img.ai_surgery_stage ?? null,
      ai_image_review_status: img.ai_image_review_status,
      ai_image_classified_at: img.ai_image_classified_at ?? null,
    }));

  const journey = buildPatientJourneyGallery(journeyInputs);
  const uiMeta = buildTwinImagingUiSections(journey);
  const ui_sections = mapUiSectionsToGalleryItems(uiMeta, itemsById);

  return { items, ui_sections };
}
