/**
 * FI-CALENDAR-CONVERSION-UX-1B — suggest a canonical FiOS clinic from Google free-text location.
 *
 * Never commits the suggestion: callers must require operator confirmation before persisting clinicId.
 * Google location remains display-only and is never treated as the canonical assignment.
 */

export type ClinicSuggestionCandidate = {
  id: string;
  display_name: string;
};

export type SuggestClinicFromGoogleLocationResult =
  | {
      ok: true;
      suggestedClinicId: string;
      suggestedClinicName: string;
      googleLocation: string;
      suggestionLabel: "Suggested from Google location";
      /** True until the operator confirms; never auto-commit. */
      requiresConfirmation: true;
    }
  | {
      ok: false;
      reason: "empty_location" | "no_clinics" | "no_match";
      googleLocation: string | null;
    };

function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristic match: Google free-text → FiOS clinic.
 * Known fixture: "South Perth Evolved Surgery" → Evolved Perth.
 */
export function scoreClinicAgainstGoogleLocation(
  clinicName: string,
  googleLocation: string
): number {
  const loc = normalizeLocationText(googleLocation);
  const name = normalizeLocationText(clinicName);
  if (!loc || !name) return 0;

  let score = 0;

  // South Perth Evolved Surgery ↔ Evolved Perth
  if (loc.includes("south perth") && name.includes("perth")) score += 40;
  if (loc.includes("evolved") && name.includes("evolved")) score += 50;
  if (loc.includes("perth") && name.includes("perth")) score += 30;

  const locTokens = new Set(loc.split(" ").filter((t) => t.length > 2));
  const nameTokens = name.split(" ").filter((t) => t.length > 2);
  for (const t of nameTokens) {
    if (locTokens.has(t)) score += 10;
  }

  if (name.length >= 4 && loc.includes(name)) score += 25;

  return score;
}

/**
 * Suggest a FiOS clinic from Google location text. Does not auto-select or persist.
 */
export function suggestClinicFromGoogleLocation(input: {
  googleLocation: string | null | undefined;
  clinics: readonly ClinicSuggestionCandidate[];
}): SuggestClinicFromGoogleLocationResult {
  const googleLocation = input.googleLocation?.trim() || null;
  if (!googleLocation) {
    return { ok: false, reason: "empty_location", googleLocation: null };
  }

  const clinics = input.clinics
    .map((c) => ({ id: c.id.trim(), display_name: c.display_name.trim() }))
    .filter((c) => c.id && c.display_name);

  if (clinics.length === 0) {
    return { ok: false, reason: "no_clinics", googleLocation };
  }

  let best: ClinicSuggestionCandidate | null = null;
  let bestScore = 0;
  for (const clinic of clinics) {
    const score = scoreClinicAgainstGoogleLocation(clinic.display_name, googleLocation);
    if (score > bestScore) {
      bestScore = score;
      best = clinic;
    }
  }

  // Require a meaningful match (evolved+perth-style or strong token overlap).
  if (!best || bestScore < 50) {
    return { ok: false, reason: "no_match", googleLocation };
  }

  return {
    ok: true,
    suggestedClinicId: best.id,
    suggestedClinicName: best.display_name,
    googleLocation,
    suggestionLabel: "Suggested from Google location",
    requiresConfirmation: true,
  };
}

/**
 * Confirm a clinic selection for conversion.
 * Rejects silent commit of an unconfirmed suggestion.
 */
export function resolveConfirmedClinicId(input: {
  selectedClinicId: string | null | undefined;
  suggestedClinicId: string | null | undefined;
  clinicConfirmed: boolean;
  allowUnassigned?: boolean;
}):
  | { ok: true; clinicId: string | null }
  | { ok: false; error: string } {
  const selected = input.selectedClinicId?.trim() || null;
  const suggested = input.suggestedClinicId?.trim() || null;

  if (!selected) {
    if (input.allowUnassigned) return { ok: true, clinicId: null };
    return { ok: false, error: "Select a FiOS clinic, or choose Clinic unassigned if permitted." };
  }

  if (suggested && selected === suggested && !input.clinicConfirmed) {
    return {
      ok: false,
      error: "Confirm the suggested clinic before continuing. Google location is not the FiOS assignment.",
    };
  }

  return { ok: true, clinicId: selected };
}
