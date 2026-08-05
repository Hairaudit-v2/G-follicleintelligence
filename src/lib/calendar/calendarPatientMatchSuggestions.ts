/**
 * FI-CALENDAR-WRITEBACK-1A / FI-CALENDAR-PATIENT-LINK-1A —
 * patient match suggestions: exact email → normalised mobile → exact normalised name (low confidence).
 * Never auto-link on name alone.
 */

import { normalizeWhitespaceName } from "@/src/lib/fi/foundation/normalize";
import {
  normalizeCalendarIdentityPhone,
  verifiedCalendarIdentityEmail,
} from "@/src/lib/calendar/calendarPersonIdentityNormalize";

export type CalendarPatientMatchSignal =
  | "exact_email"
  | "exact_phone"
  | "verified_external_mapping"
  | "exact_normalised_name";

export type CalendarPatientMatchCandidate = {
  patientId: string;
  displayName: string | null;
  signals: CalendarPatientMatchSignal[];
  email: string | null;
  phone: string | null;
  /** Name-only matches are low confidence and must never auto-link. */
  confidence: "high" | "low";
};

export type CalendarPatientMatchSuggestionInput = {
  eventEmail?: string | null;
  eventPhone?: string | null;
  /** Display name from Google summary / attendee — used only for low-confidence suggestions. */
  eventDisplayName?: string | null;
  verifiedMappings?: Array<{
    externalId: string;
    patientId: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  patients: Array<{
    id: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  externalEventId?: string | null;
};

/**
 * Build optional safe match suggestions. Requires confirmation before linking.
 * Search order priority: email → phone → verified mapping → exact name (low confidence).
 * Name-only matches are never treated as automatic links.
 */
export function suggestCalendarPatientMatches(
  input: CalendarPatientMatchSuggestionInput
): CalendarPatientMatchCandidate[] {
  const eventEmail = verifiedCalendarIdentityEmail(input.eventEmail);
  const eventPhone = normalizeCalendarIdentityPhone(input.eventPhone);
  const eventName = normalizeWhitespaceName(input.eventDisplayName);
  const byId = new Map<string, CalendarPatientMatchCandidate>();

  const upsert = (
    patientId: string,
    signal: CalendarPatientMatchSignal,
    meta: { displayName?: string | null; email?: string | null; phone?: string | null }
  ) => {
    const confidence: "high" | "low" = signal === "exact_normalised_name" ? "low" : "high";
    const existing = byId.get(patientId);
    if (existing) {
      if (!existing.signals.includes(signal)) existing.signals.push(signal);
      if (confidence === "high") existing.confidence = "high";
      return;
    }
    byId.set(patientId, {
      patientId,
      displayName: meta.displayName?.trim() || null,
      signals: [signal],
      email: meta.email?.trim() || null,
      phone: meta.phone?.trim() || null,
      confidence,
    });
  };

  const extId = input.externalEventId?.trim();
  if (extId && input.verifiedMappings?.length) {
    for (const m of input.verifiedMappings) {
      if (m.externalId.trim() === extId) {
        upsert(m.patientId, "verified_external_mapping", m);
      }
    }
  }

  for (const p of input.patients) {
    const email = verifiedCalendarIdentityEmail(p.email);
    const phone = normalizeCalendarIdentityPhone(p.phone);
    if (eventEmail && email && eventEmail === email) {
      upsert(p.id, "exact_email", p);
    }
    if (eventPhone && phone && eventPhone === phone) {
      upsert(p.id, "exact_phone", p);
    }
  }

  // Name only after stronger signals — and never alone as auto-link.
  if (eventName) {
    for (const p of input.patients) {
      const name = normalizeWhitespaceName(p.displayName);
      if (name && name === eventName) {
        upsert(p.id, "exact_normalised_name", p);
      }
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    return b.signals.length - a.signals.length;
  });
}
