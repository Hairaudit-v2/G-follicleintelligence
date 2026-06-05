import "server-only";

import { loadCrmLeadById } from "@/src/lib/crm/server";
import type { AppointmentCreatePrefill } from "./appointmentCreateTypes";
import { buildAppointmentCreatePrefillFromLead } from "./bookingLeadPrefillShared";

/** Enrich URL/create prefill with lead anchors and title (server). */
export async function enrichCreatePrefillFromLead(
  tenantId: string,
  prefill: AppointmentCreatePrefill
): Promise<AppointmentCreatePrefill> {
  const lid = prefill.leadId?.trim();
  if (!lid) return prefill;
  const lead = await loadCrmLeadById(lid, tenantId);
  if (!lead) return prefill;
  const partial = buildAppointmentCreatePrefillFromLead({
    lead,
    bookingType: prefill.bookingType,
    startIso: prefill.startIso,
    endIso: prefill.endIso,
  });
  return {
    ...prefill,
    personId: prefill.personId ?? partial.personId ?? null,
    patientId: prefill.patientId ?? partial.patientId ?? null,
    caseId: prefill.caseId ?? partial.caseId ?? null,
    bookingType: partial.bookingType ?? prefill.bookingType,
    title: prefill.title ?? partial.title ?? null,
    assignedUserId: prefill.assignedUserId ?? partial.assignedUserId ?? null,
    clinicId: prefill.clinicId ?? partial.clinicId ?? null,
  };
}
