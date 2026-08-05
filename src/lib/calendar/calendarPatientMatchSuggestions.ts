/**
 * FI-CALENDAR-WRITEBACK-1A — patient match suggestions (exact email / phone / verified mapping).
 * Never auto-link on name alone.
 */

export type CalendarPatientMatchSignal = "exact_email" | "exact_phone" | "verified_external_mapping";

export type CalendarPatientMatchCandidate = {
  patientId: string;
  displayName: string | null;
  signals: CalendarPatientMatchSignal[];
  email: string | null;
  phone: string | null;
};

export type CalendarPatientMatchSuggestionInput = {
  eventEmail?: string | null;
  eventPhone?: string | null;
  /** Patients with verified external id → FiOS patient mappings. */
  verifiedMappings?: Array<{
    externalId: string;
    patientId: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  /** Candidate patients to score (already scoped to tenant). */
  patients: Array<{
    id: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  /** Google / mirror external event id for mapping lookup. */
  externalEventId?: string | null;
};

function normEmail(v: string | null | undefined): string | null {
  const t = v?.trim().toLowerCase();
  return t || null;
}

function normPhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Build optional safe match suggestions. Requires confirmation before linking.
 * Name-only matches are never suggested.
 */
export function suggestCalendarPatientMatches(
  input: CalendarPatientMatchSuggestionInput
): CalendarPatientMatchCandidate[] {
  const eventEmail = normEmail(input.eventEmail);
  const eventPhone = normPhone(input.eventPhone);
  const byId = new Map<string, CalendarPatientMatchCandidate>();

  const upsert = (
    patientId: string,
    signal: CalendarPatientMatchSignal,
    meta: { displayName?: string | null; email?: string | null; phone?: string | null }
  ) => {
    const existing = byId.get(patientId);
    if (existing) {
      if (!existing.signals.includes(signal)) existing.signals.push(signal);
      return;
    }
    byId.set(patientId, {
      patientId,
      displayName: meta.displayName?.trim() || null,
      signals: [signal],
      email: meta.email?.trim() || null,
      phone: meta.phone?.trim() || null,
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
    const email = normEmail(p.email);
    const phone = normPhone(p.phone);
    if (eventEmail && email && eventEmail === email) {
      upsert(p.id, "exact_email", p);
    }
    if (eventPhone && phone && eventPhone === phone) {
      upsert(p.id, "exact_phone", p);
    }
  }

  return [...byId.values()].sort((a, b) => b.signals.length - a.signals.length);
}
