import type { PatientClinicalDetailsRow } from "./clinicalDetailsServer";

export type PreviousProcedureRow = {
  id: string;
  procedureType: string;
  performedAt: string | null;
  clinic: string | null;
  graftCount: number | null;
  outcome: string | null;
  notes: string | null;
};

const STORAGE_KEY = "previous_procedures";

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapRawProcedure(raw: Record<string, unknown>, index: number): PreviousProcedureRow | null {
  const procedureType = asString(raw.procedure_type ?? raw.procedureType ?? raw.type);
  if (!procedureType) return null;
  return {
    id: asString(raw.id) ?? `proc-${index}`,
    procedureType,
    performedAt: asString(raw.performed_at ?? raw.performedAt ?? raw.date),
    clinic: asString(raw.clinic ?? raw.clinic_name),
    graftCount: asNumber(raw.graft_count ?? raw.graftCount),
    outcome: asString(raw.outcome),
    notes: asString(raw.notes),
  };
}

/** Structured rows from `clinical_flags.previous_procedures`; falls back to legacy textarea as one row. */
export function parsePreviousProceduresFromClinical(
  clinical: PatientClinicalDetailsRow | null | undefined
): PreviousProcedureRow[] {
  if (!clinical) return [];

  const flags = clinical.clinical_flags ?? {};
  const rawList = flags[STORAGE_KEY];
  if (Array.isArray(rawList)) {
    const out: PreviousProcedureRow[] = [];
    rawList.forEach((item, i) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const row = mapRawProcedure(item as Record<string, unknown>, i);
      if (row) out.push(row);
    });
    if (out.length) return out;
  }

  const legacy = clinical.previous_hair_treatments?.trim();
  if (!legacy) return [];
  return [
    {
      id: "legacy-textarea",
      procedureType: "Previous treatments (legacy)",
      performedAt: null,
      clinic: null,
      graftCount: null,
      outcome: null,
      notes: legacy,
    },
  ];
}
