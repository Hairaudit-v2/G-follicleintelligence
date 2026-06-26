import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiBookingRow } from "@/src/lib/bookings/types";

import {
  type BookingDisplayContextMaps,
  type LeadDisplayRecord,
  type PatientDisplayRecord,
} from "./bookingDisplayContext";

function asMeta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function loadPersonMetaMap(tenantId: string, personIds: string[]): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  const ids = Array.from(new Set(personIds.map((x) => x.trim()).filter(Boolean)));
  if (!ids.length) return out;

  const { data, error } = await supabaseAdmin()
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as { id: string; metadata: unknown };
    out.set(String(r.id), asMeta(r.metadata));
  }
  return out;
}

/** Load patient, lead, and person metadata needed for calendar anchor labels. */
export async function loadBookingDisplayContextMaps(
  tenantId: string,
  bookings: FiBookingRow[]
): Promise<BookingDisplayContextMaps> {
  const tid = tenantId.trim();
  const patientIds = Array.from(
    new Set(bookings.map((b) => b.patient_id?.trim()).filter((x): x is string => Boolean(x)))
  );
  const leadIds = Array.from(
    new Set(bookings.map((b) => b.lead_id?.trim()).filter((x): x is string => Boolean(x)))
  );
  const directPersonIds = Array.from(
    new Set(bookings.map((b) => b.person_id?.trim()).filter((x): x is string => Boolean(x)))
  );

  const patients = new Map<string, PatientDisplayRecord>();
  const leads = new Map<string, LeadDisplayRecord>();
  const patientPersonByPatientId = new Map<string, string>();
  const leadPersonByLeadId = new Map<string, string>();
  const personIds = new Set<string>(directPersonIds);

  const [patientsRes, leadsRes] = await Promise.all([
    patientIds.length
      ? supabaseAdmin()
          .from("fi_patients")
          .select("id, person_id, metadata")
          .eq("tenant_id", tid)
          .in("id", patientIds)
      : Promise.resolve({ data: [], error: null }),
    leadIds.length
      ? supabaseAdmin()
          .from("fi_crm_leads")
          .select("id, summary, person_id")
          .eq("tenant_id", tid)
          .in("id", leadIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (patientsRes.error) throw new Error(patientsRes.error.message);
  if (leadsRes.error) throw new Error(leadsRes.error.message);

  for (const raw of patientsRes.data ?? []) {
    const r = raw as { id: string; person_id: string | null; metadata: unknown };
    const patientId = String(r.id);
    const personId = r.person_id?.trim();
    if (personId) {
      personIds.add(personId);
      patientPersonByPatientId.set(patientId, personId);
    }
    patients.set(patientId, {
      patientMeta: asMeta(r.metadata),
      personMeta: null,
    });
  }

  for (const raw of leadsRes.data ?? []) {
    const r = raw as { id: string; summary: string | null; person_id: string | null };
    const leadId = String(r.id);
    const personId = r.person_id?.trim();
    if (personId) {
      personIds.add(personId);
      leadPersonByLeadId.set(leadId, personId);
    }
    leads.set(leadId, {
      summary: r.summary?.trim() || null,
      personMeta: null,
    });
  }

  const persons = await loadPersonMetaMap(tid, Array.from(personIds));

  for (const [patientId, record] of Array.from(patients.entries())) {
    const personId = patientPersonByPatientId.get(patientId);
    patients.set(patientId, {
      ...record,
      personMeta: personId ? persons.get(personId) ?? null : null,
    });
  }

  for (const [leadId, record] of Array.from(leads.entries())) {
    const personId = leadPersonByLeadId.get(leadId);
    leads.set(leadId, {
      ...record,
      personMeta: personId ? persons.get(personId) ?? null : null,
    });
  }

  return { patients, leads, persons };
}
