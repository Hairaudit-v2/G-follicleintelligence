import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PatientTwinImagingGalleryItem,
  PatientTwinPhotoProtocolSection,
} from "@/src/lib/patientTwin/patientTwinTypes";
import { calculatePhotoProtocolCompliance } from "./protocolCompliance";
import { resolveDefaultTemplateSlugForClinicalContext } from "./protocolTemplates";
import { canCompleteRequiredSessionSlots } from "./protocolSessionRules";
import {
  loadLatestActivePhotoSessionForPatient,
  loadTemplateWithSlotsBySlug,
  loadTemplateWithSlotsByTemplateId,
} from "./protocolSession.server";
import type { HliPhotoProtocolClinicalContext } from "./types";

function galleryToComplianceImages(items: PatientTwinImagingGalleryItem[]) {
  return items.map((i) => ({
    id: i.id,
    ai_image_category: i.ai_image_category,
    ai_image_category_confidence: i.ai_image_category_confidence,
    ai_hair_state: i.ai_hair_state,
    ai_shave_state: i.ai_shave_state,
    ai_surgery_stage: i.ai_surgery_stage,
    ai_image_review_status: i.ai_image_review_status,
  }));
}

export async function loadPatientTwinPhotoProtocolSection(params: {
  tenantId: string;
  patientId: string;
  galleryItems: PatientTwinImagingGalleryItem[];
  clinicalContext?: HliPhotoProtocolClinicalContext;
  client?: SupabaseClient;
}): Promise<PatientTwinPhotoProtocolSection | null> {
  const supabase = params.client ?? supabaseAdmin();
  const ctx: HliPhotoProtocolClinicalContext = params.clinicalContext ?? "consultation";
  const slugDefault = resolveDefaultTemplateSlugForClinicalContext(ctx);

  const active = await loadLatestActivePhotoSessionForPatient(
    params.tenantId,
    params.patientId,
    supabase
  );
  let loaded = await loadTemplateWithSlotsBySlug(slugDefault, supabase);
  if (active) {
    const byId = await loadTemplateWithSlotsByTemplateId(
      active.session.protocol_template_id,
      supabase
    );
    if (byId) loaded = byId;
  }
  if (!loaded) return null;

  const images = galleryToComplianceImages(params.galleryItems);
  const compliance = calculatePhotoProtocolCompliance({
    template: loaded.template,
    slots: loaded.slots,
    images,
  });

  const unclassified_image_ids = params.galleryItems
    .filter((i) => {
      const cat = (i.ai_image_category ?? "").trim().toLowerCase();
      const noRun = !i.ai_image_classified_at?.trim();
      return noRun || !cat || cat === "unknown";
    })
    .map((i) => i.id);

  let checklist: PatientTwinPhotoProtocolSection["checklist"] = [];
  if (active) {
    const slotById = active.slotsById;
    checklist = active.sessionSlots
      .slice()
      .sort((a, b) => {
        const sa = slotById.get(a.slot_id)?.sort_order ?? 0;
        const sb = slotById.get(b.slot_id)?.sort_order ?? 0;
        return sa - sb;
      })
      .map((ss) => {
        const def = slotById.get(ss.slot_id);
        return {
          session_slot_id: ss.id,
          slot_id: ss.slot_id,
          slot_slug: def?.slot_slug ?? "",
          label: def?.label ?? ss.slot_id,
          is_required: def?.is_required ?? true,
          capture_guidance: def?.capture_guidance ?? null,
          quality_guidance: def?.quality_guidance ?? null,
          status: ss.status,
          patient_image_id: ss.patient_image_id,
          ai_match_confidence: ss.ai_match_confidence,
          staff_note: ss.staff_note,
        };
      });
  } else {
    checklist = loaded.slots.map((sl) => ({
      session_slot_id: "",
      slot_id: sl.id,
      slot_slug: sl.slot_slug,
      label: sl.label,
      is_required: sl.is_required,
      capture_guidance: sl.capture_guidance,
      quality_guidance: sl.quality_guidance,
      status: "missing",
      patient_image_id: null,
      ai_match_confidence: null,
      staff_note: null,
    }));
  }

  const can_complete_session = active
    ? canCompleteRequiredSessionSlots({
        sessionSlots: active.sessionSlots,
        slotsById: active.slotsById,
      })
    : false;

  return {
    clinical_context: ctx,
    template_slug: loaded.template.slug,
    template_name: loaded.template.name,
    active_session_id: active?.session.id ?? null,
    active_session_status: active?.session.status ?? null,
    can_complete_session,
    compliance,
    checklist,
    unclassified_image_ids,
  };
}
