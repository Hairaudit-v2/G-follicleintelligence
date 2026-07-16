/**
 * Load Patient Visual Journey from profile foundation data (tenant-scoped).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadPatientProfile } from "@/src/lib/patients/patientProfileLoader";
import { journeyViewFromProfileData } from "./patientJourneyFromProfile";
import type { PatientJourneyView } from "./patientJourneyTypes";

export { journeyViewFromProfileData } from "./patientJourneyFromProfile";

export async function loadPatientJourneyView(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<{ ok: true; journey: PatientJourneyView } | { ok: false; error: string }> {
  try {
    const supabase = client ?? supabaseAdmin();
    const loaded = await loadPatientProfile(tenantId, patientId, supabase, {
      viewerCanReadClinicalPhi: false,
    });
    if (!loaded.ok || loaded.mode !== "foundation") {
      return { ok: false, error: "Patient not found for this clinic." };
    }
    return { ok: true, journey: journeyViewFromProfileData(loaded.data) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load patient journey.",
    };
  }
}
