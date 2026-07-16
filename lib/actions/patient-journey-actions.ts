"use server";

import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadPatientJourneyView } from "@/src/lib/patients/journey/patientJourney.server";
import type { PatientJourneyView } from "@/src/lib/patients/journey/patientJourneyTypes";

const tenantIdSchema = z.string().uuid();
const patientIdSchema = z.string().min(8).max(80);

export async function loadPatientJourneyAction(
  tenantId: string,
  patientId: string
): Promise<{ ok: true; journey: PatientJourneyView } | { ok: false; error: string }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const pid = patientIdSchema.parse(patientId);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    return loadPatientJourneyView(tid, pid);
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load patient journey.",
    };
  }
}
