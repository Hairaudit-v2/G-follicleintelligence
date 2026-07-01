import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPatientPortalReleased } from "@/src/lib/patientImages/patientPortalReleaseStatus";
import { loadPatientImagesProfileBundle } from "@/src/lib/patientImages/patientImagesServer";
import type { PatientImageRow } from "@/src/lib/patientImages/patientImageTypes";
import { isPatientPortalImagingEnabled } from "@/src/lib/patientPortal/patientPortalImagingEnabled";
import {
  mapPatientImagesToSafeExportCards,
  type PatientSafeImagingExportCardWithPreview,
} from "./patientSafeImagingExportMapperCore";
import type { PatientSafeImagingExportCard } from "./patientSafeImagingExportCore";

/** Exported for unit tests — portal loader only surfaces explicitly released images. */
export function selectPatientPortalReleasedImages(images: PatientImageRow[]): PatientImageRow[] {
  return images.filter((img) => isPatientPortalReleased(img.patient_portal_release_status));
}

export type PatientSafeImagingExportBundle = {
  cards: PatientSafeImagingExportCardWithPreview[];
  patientId: string;
  tenantId: string;
};

export async function loadPatientSafeImagingExportCardsForPatient(input: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  limit?: number;
  includeSignedPreviews?: boolean;
  client?: SupabaseClient;
}): Promise<PatientSafeImagingExportBundle> {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();

  if (!isPatientPortalImagingEnabled()) {
    return { cards: [], patientId: pid, tenantId: tid };
  }

  const supabase = input.client ?? supabaseAdmin();
  const bundle = await loadPatientImagesProfileBundle(tid, pid, supabase);

  let images: PatientImageRow[] = selectPatientPortalReleasedImages(
    bundle.activeWithSignedUrls.map((t) => t.image)
  );
  if (input.caseId?.trim()) {
    const cid = input.caseId.trim();
    images = images.filter((img) => img.case_id === cid);
  }

  const sorted = [...images].sort((a, b) => {
    const ta = Date.parse(a.taken_at ?? a.created_at);
    const tb = Date.parse(b.taken_at ?? b.created_at);
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  const limit = input.limit ?? 40;
  const slice = sorted.slice(0, limit);
  const cards = mapPatientImagesToSafeExportCards(slice);

  const signedById = new Map(
    bundle.activeWithSignedUrls.map((t) => [t.image.id, t.signed.url] as const)
  );

  const withPreview: PatientSafeImagingExportCardWithPreview[] = cards.map((card) => ({
    ...card,
    preview_signed_url:
      input.includeSignedPreviews !== false ? (signedById.get(card.image_id) ?? null) : null,
  }));

  return { cards: withPreview, patientId: pid, tenantId: tid };
}

export function patientSafeImagingHandoutPdfInput(cards: PatientSafeImagingExportCard[]): {
  title: string;
  disclaimer: string;
  cards: PatientSafeImagingExportCard[];
} {
  return {
    title: "Clinical photography summary",
    disclaimer:
      "This handout contains redacted imaging status only. It is not a diagnosis or treatment recommendation.",
    cards,
  };
}