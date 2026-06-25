import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFiImageTimelineEntry,
  inferFiImageProcedureStage,
  mapToFiImageAttributionType,
  sortFiImageTimelineEntries,
} from "./fiImageAttributionCore";
import type { FiImageTimelineEntry } from "./fiImageAttributionTypes";
import { loadPatientImages } from "./patientImagesServer";

export async function buildPatientImageJourneyTimeline(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<FiImageTimelineEntry[]> {
  const rows = await loadPatientImages(tenantId, patientId, client);
  const entries = rows
    .filter((r) => r.image_status === "active")
    .map((row) => {
      const stored = row.metadata?.fi_image_timeline;
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        return stored as FiImageTimelineEntry;
      }
      return buildFiImageTimelineEntry({
        image_id: row.id,
        capture_timestamp: row.taken_at ?? row.created_at,
        procedure_stage: inferFiImageProcedureStage({
          visit_type: row.visit_type,
          imaging_protocol_template_slug: row.imaging_protocol_template_slug,
          image_category: row.image_category,
          follow_up_interval: row.follow_up_interval,
          imaging_library_axis: row.imaging_library_axis,
        }),
        visit_type: row.visit_type,
        follow_up_interval: row.follow_up_interval,
        image_type: mapToFiImageAttributionType({
          ai_category: row.ai_image_category,
          anatomical_region: row.anatomical_region,
          image_category: row.image_category,
          protocol_slot_slug: row.imaging_protocol_slot_slug,
        }),
      });
    });
  return sortFiImageTimelineEntries(entries);
}
