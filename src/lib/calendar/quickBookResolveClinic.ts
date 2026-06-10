/**
 * Pure clinic resolution for Front Desk Quick Book — avoids asking reception to pick a clinic
 * when context or tenant layout already implies one.
 */

export type QuickBookClinicCandidate = { id: string; display_name: string };

export type ResolveQuickBookClinicResult =
  | { ok: true; clinicId: string }
  | { ok: false; reason: "no_clinics" | "ambiguous" };

function normId(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t || null;
}

function matchClinicId(clinics: QuickBookClinicCandidate[], id: string | null): string | null {
  if (!id) return null;
  return clinics.some((c) => c.id.trim() === id) ? id : null;
}

/** Prefer a single site whose name suggests Evolved Hair Restoration Perth. */
export function findEvolvedPerthStyleClinicId(clinics: QuickBookClinicCandidate[]): string | null {
  const hit = clinics.find((c) => {
    const n = c.display_name.toLowerCase();
    return n.includes("evolved") && n.includes("perth");
  });
  return hit?.id.trim() ?? null;
}

/**
 * Resolution order:
 * 1. Clinic implied by calendar column (`c:{clinicId}`)
 * 2. Prefill default (slot / FAB / month from CalendarPage)
 * 3. Active calendar URL `clinicId` filter
 * 4. Signed-in operator’s staff primary clinic (when loaded server-side)
 * 5. Sole active clinic for the tenant
 * 6. Evolved + Perth name match when present
 */
export function resolveQuickBookClinicId(input: {
  columnClinicId?: string | null;
  prefillDefaultClinicId?: string | null;
  calendarQueryClinicId?: string | null;
  operatorPrimaryClinicId?: string | null;
  clinics: QuickBookClinicCandidate[];
}): ResolveQuickBookClinicResult {
  const clinics = input.clinics
    .map((c) => ({ id: c.id.trim(), display_name: c.display_name.trim() }))
    .filter((c) => c.id);
  if (clinics.length === 0) return { ok: false, reason: "no_clinics" };

  const resolved =
    matchClinicId(clinics, normId(input.columnClinicId)) ??
    matchClinicId(clinics, normId(input.prefillDefaultClinicId)) ??
    matchClinicId(clinics, normId(input.calendarQueryClinicId)) ??
    matchClinicId(clinics, normId(input.operatorPrimaryClinicId)) ??
    (clinics.length === 1 ? clinics[0]!.id : null) ??
    findEvolvedPerthStyleClinicId(clinics);

  if (!resolved) return { ok: false, reason: "ambiguous" };
  return { ok: true, clinicId: resolved };
}
