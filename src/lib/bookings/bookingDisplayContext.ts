import {
  contactFallbackFromMetadata,
  getBookingDisplayName,
  type BookingDisplayNameContext,
} from "@/src/lib/bookings/bookingDisplayName";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type PatientDisplayRecord = {
  patientMeta: Record<string, unknown>;
  personMeta: Record<string, unknown> | null;
};

export type LeadDisplayRecord = {
  summary: string | null;
  personMeta: Record<string, unknown> | null;
};

export type BookingDisplayContextMaps = {
  patients: Map<string, PatientDisplayRecord>;
  leads: Map<string, LeadDisplayRecord>;
  persons: Map<string, Record<string, unknown>>;
};

export function bookingDisplayContextForRow(
  row: FiBookingRow,
  maps: BookingDisplayContextMaps
): BookingDisplayNameContext {
  const pid = row.patient_id?.trim();
  const lid = row.lead_id?.trim();
  const personId = row.person_id?.trim();

  const patient = pid ? maps.patients.get(pid) : undefined;
  const lead = lid ? maps.leads.get(lid) : undefined;
  const personMeta = personId ? maps.persons.get(personId) ?? null : null;

  return {
    patientPersonMeta: patient?.personMeta ?? null,
    patientMeta: patient?.patientMeta ?? null,
    leadSummary: lead?.summary ?? null,
    leadPersonMeta: lead?.personMeta ?? null,
    personMeta,
    bookingTitle: row.title,
    bookingType: row.booking_type,
  };
}

export function anchorLabelForBookingRow(row: FiBookingRow, maps: BookingDisplayContextMaps): string {
  return getBookingDisplayName(bookingDisplayContextForRow(row, maps));
}

export function patientContactForBookingRow(
  row: FiBookingRow,
  maps: BookingDisplayContextMaps
): { email: string | null; phone: string | null } {
  const ctx = bookingDisplayContextForRow(row, maps);
  const metas = [ctx.patientPersonMeta, ctx.personMeta, ctx.leadPersonMeta, ctx.patientMeta].filter(
    Boolean
  ) as Record<string, unknown>[];

  for (const meta of metas) {
    const phone = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
    if (phone) {
      const email =
        typeof meta.email === "string"
          ? meta.email.trim() || null
          : typeof meta.email_normalized === "string"
            ? meta.email_normalized.trim() || null
            : null;
      return { phone, email };
    }
  }

  for (const meta of metas) {
    const contact = contactFallbackFromMetadata(meta);
    if (contact?.includes("@")) return { email: contact, phone: null };
  }

  return { email: null, phone: null };
}
