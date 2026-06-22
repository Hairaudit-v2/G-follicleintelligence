import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import { loadStaffCompetencyProjections } from "./academyCompetencyReceiver.server";
import {
  buildAcademyCompetencySignalsFromProjections,
  type AcademyCompetencySignals,
} from "@/src/lib/academy-os/academyWorkforceSignalAdapter";

/**
 * Loads AcademyOS competency projections and builds WorkforceOS readiness signals.
 */
export async function buildAcademyCompetencySignals(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient,
  now?: Date
): Promise<AcademyCompetencySignals> {
  const projections = await loadStaffCompetencyProjections(tenantId, staffId, client);
  return buildAcademyCompetencySignalsFromProjections(projections, now);
}

/** Convenience loader when tenant + staff are already validated. */
export async function buildAcademyCompetencySignalsForStaff(
  staffId: string,
  tenantId: string,
  now?: Date
): Promise<AcademyCompetencySignals> {
  assertNonEmptyUuid(tenantId, "tenantId");
  assertNonEmptyUuid(staffId, "staffId");
  return buildAcademyCompetencySignals(tenantId, staffId, supabaseAdmin(), now);
}
