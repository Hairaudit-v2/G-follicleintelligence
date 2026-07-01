/**
 * ImagingOS Phase 7B — staff-recorded recipient zone data (pure validation + normalization).
 */

import { patientSafeReportTextIsAllowed } from "./patientVisualSummaryReportCore";
import {
  PATIENT_VISUAL_SUMMARY_VERSION,
  type PatientVisualSummaryGraftTypeMix,
  type PatientVisualSummaryStaffRecord,
} from "./patientVisualSummaryReportTypes";

export const RECIPIENT_ZONE_IDS = ["zone_1", "zone_2", "zone_3", "zone_4"] as const;
export type RecipientZoneId = (typeof RECIPIENT_ZONE_IDS)[number];

export const RECIPIENT_ZONE_LABELS: Record<RecipientZoneId, string> = {
  zone_1: "Zone 1 — Hairline",
  zone_2: "Zone 2 — First 1–1.5 cm",
  zone_3: "Zone 3 — Mid frontal",
  zone_4: "Zone 4 — Posterior frontal / transition",
};

export type RecipientZoneDraft = {
  zone_id: RecipientZoneId;
  graft_count: string;
  density_range: string;
  grafts_per_cm2: string;
  singles: string;
  doubles: string;
  triples: string;
  multi_hair: string;
  five_hair: string;
  notes: string;
};

export type RecipientZoneRecordInput = {
  zone_id?: string;
  graft_count?: number | null;
  density_range?: string | null;
  grafts_per_cm2?: number | null;
  graft_type_mix?: PatientVisualSummaryGraftTypeMix & { fiveHair?: number | null };
  notes?: string | null;
};

export type ValidateZoneRecordResult = {
  ok: boolean;
  record: PatientVisualSummaryStaffRecord;
  errors: string[];
  warnings: string[];
};

function parseOptionalCount(raw: string | number | null | undefined): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return undefined;
    if (raw < 0) return undefined;
    return Math.floor(raw);
  }
  const s = String(raw).trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function parseOptionalText(raw: string | null | undefined): string | undefined {
  const s = raw?.trim();
  return s ? s : undefined;
}

function isRecipientZoneId(value: string): value is RecipientZoneId {
  return (RECIPIENT_ZONE_IDS as readonly string[]).includes(value);
}

export function emptyRecipientZoneDraft(zoneId: RecipientZoneId): RecipientZoneDraft {
  return {
    zone_id: zoneId,
    graft_count: "",
    density_range: "",
    grafts_per_cm2: "",
    singles: "",
    doubles: "",
    triples: "",
    multi_hair: "",
    five_hair: "",
    notes: "",
  };
}

export function recipientZoneDraftFromRecord(
  record: PatientVisualSummaryStaffRecord | null | undefined
): RecipientZoneDraft[] {
  const byId = new Map<string, NonNullable<PatientVisualSummaryStaffRecord["recipient_zones"]>[number]>();
  for (const z of record?.recipient_zones ?? []) {
    const id = z.zone_id?.trim();
    if (id) byId.set(id, z);
  }
  return RECIPIENT_ZONE_IDS.map((zoneId) => {
    const z = byId.get(zoneId);
    const mix = z?.graft_type_mix;
    return {
      zone_id: zoneId,
      graft_count: z?.graft_count != null ? String(z.graft_count) : "",
      density_range: z?.density_range ?? "",
      grafts_per_cm2: "",
      singles: mix?.singles != null ? String(mix.singles) : "",
      doubles: mix?.doubles != null ? String(mix.doubles) : "",
      triples: mix?.triples != null ? String(mix.triples) : "",
      multi_hair: mix?.multiHair != null ? String(mix.multiHair) : "",
      five_hair:
        (mix as { fiveHair?: number } | undefined)?.fiveHair != null
          ? String((mix as { fiveHair?: number }).fiveHair)
          : "",
      notes: z?.notes ?? "",
    };
  });
}

export function sumZoneGraftCounts(
  zones: Array<{ graft_count?: number }>
): number {
  return zones.reduce((sum, z) => sum + (z.graft_count ?? 0), 0);
}

export function buildGraftTotalMismatchWarning(input: {
  zoneTotal: number;
  surgeryGraftTotal?: number | null;
}): string | null {
  const surgeryTotal = input.surgeryGraftTotal;
  if (surgeryTotal == null || !Number.isFinite(surgeryTotal) || surgeryTotal <= 0) {
    return null;
  }
  if (input.zoneTotal <= 0) return null;
  if (input.zoneTotal > surgeryTotal) {
    return `Zone graft total (${input.zoneTotal}) exceeds recorded surgery graft count (${surgeryTotal}).`;
  }
  return null;
}

export function normalizeRecipientZoneInput(
  input: RecipientZoneRecordInput
): { zone: NonNullable<PatientVisualSummaryStaffRecord["recipient_zones"]>[number] | null; errors: string[] } {
  const errors: string[] = [];
  const zoneId = input.zone_id?.trim() ?? "";
  if (!zoneId || !isRecipientZoneId(zoneId)) {
    errors.push("Invalid zone id.");
    return { zone: null, errors };
  }

  if (input.graft_count != null && (!Number.isFinite(input.graft_count) || input.graft_count < 0)) {
    errors.push(`${RECIPIENT_ZONE_LABELS[zoneId]}: graft count must be zero or positive.`);
  }
  if (input.grafts_per_cm2 != null && (!Number.isFinite(input.grafts_per_cm2) || input.grafts_per_cm2 < 0)) {
    errors.push(`${RECIPIENT_ZONE_LABELS[zoneId]}: grafts/cm² must be zero or positive.`);
  }

  const mixInput = input.graft_type_mix ?? {};
  for (const [label, val] of [
    ["singles", mixInput.singles],
    ["doubles", mixInput.doubles],
    ["triples", mixInput.triples],
    ["4+ hair grafts", mixInput.multiHair],
    ["5-hair grafts", (mixInput as { fiveHair?: number }).fiveHair],
  ] as const) {
    if (val != null && (!Number.isFinite(val) || val < 0)) {
      errors.push(`${RECIPIENT_ZONE_LABELS[zoneId]}: ${label} must be zero or positive.`);
    }
  }

  if (errors.length > 0) return { zone: null, errors };

  const graftCount = parseOptionalCount(input.graft_count);
  const densityRange = parseOptionalText(input.density_range);
  const notesRaw = parseOptionalText(input.notes);
  const notes =
    notesRaw && patientSafeReportTextIsAllowed(notesRaw) ? notesRaw : notesRaw ? undefined : undefined;

  const singles = parseOptionalCount(mixInput.singles);
  const doubles = parseOptionalCount(mixInput.doubles);
  const triples = parseOptionalCount(mixInput.triples);
  const multiHair = parseOptionalCount(mixInput.multiHair);
  const fiveHair = parseOptionalCount((mixInput as { fiveHair?: number }).fiveHair);

  const graftTypeMix: PatientVisualSummaryGraftTypeMix & { fiveHair?: number } = {};
  if (singles != null) graftTypeMix.singles = singles;
  if (doubles != null) graftTypeMix.doubles = doubles;
  if (triples != null) graftTypeMix.triples = triples;
  if (multiHair != null) graftTypeMix.multiHair = multiHair;
  if (fiveHair != null) graftTypeMix.fiveHair = fiveHair;

  const hasMix = Object.keys(graftTypeMix).length > 0;
  const hasAny =
    graftCount != null ||
    densityRange ||
    hasMix ||
    notes ||
    (input.grafts_per_cm2 != null && Number.isFinite(input.grafts_per_cm2));

  if (!hasAny) return { zone: null, errors: [] };

  const zone: NonNullable<PatientVisualSummaryStaffRecord["recipient_zones"]>[number] = {
    zone_id: zoneId,
    ...(graftCount != null ? { graft_count: graftCount } : {}),
    ...(densityRange ? { density_range: densityRange } : {}),
    ...(hasMix ? { graft_type_mix: graftTypeMix } : {}),
    ...(notes ? { notes } : {}),
  };

  if (input.grafts_per_cm2 != null && Number.isFinite(input.grafts_per_cm2) && input.grafts_per_cm2 >= 0) {
    const densityLabel = RECIPIENT_ZONE_LABELS[zoneId];
    if (!zone.density_range) {
      zone.density_range = `${input.grafts_per_cm2} grafts/cm²`;
    }
    void densityLabel;
  }

  return { zone, errors: [] };
}

export function validateAndBuildStaffRecord(input: {
  zones: RecipientZoneRecordInput[];
  densityZones?: PatientVisualSummaryStaffRecord["density_zones"];
  hairlinePrinciples?: string[];
  fiveHairGrafts?: number | null;
  followUpPlan?: string | null;
  surgeryGraftTotal?: number | null;
}): ValidateZoneRecordResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recipientZones: NonNullable<PatientVisualSummaryStaffRecord["recipient_zones"]> = [];

  for (const z of input.zones) {
    const { zone, errors: zoneErrors } = normalizeRecipientZoneInput(z);
    errors.push(...zoneErrors);
    if (zone) recipientZones.push(zone);
  }

  if (input.fiveHairGrafts != null) {
    if (!Number.isFinite(input.fiveHairGrafts) || input.fiveHairGrafts < 0) {
      errors.push("5-hair graft total must be zero or positive.");
    }
  }

  const followUp = input.followUpPlan?.trim();
  if (followUp && !patientSafeReportTextIsAllowed(followUp)) {
    errors.push("Follow-up plan contains wording not suitable for patient records.");
  }

  const zoneTotal = sumZoneGraftCounts(recipientZones);
  const mismatch = buildGraftTotalMismatchWarning({
    zoneTotal,
    surgeryGraftTotal: input.surgeryGraftTotal,
  });
  if (mismatch) warnings.push(mismatch);

  const record: PatientVisualSummaryStaffRecord = {
    version: PATIENT_VISUAL_SUMMARY_VERSION,
    ...(recipientZones.length > 0 ? { recipient_zones: recipientZones } : {}),
    ...(input.densityZones?.length ? { density_zones: input.densityZones } : {}),
    ...(input.hairlinePrinciples?.length ? { hairline_principles: input.hairlinePrinciples } : {}),
    ...(input.fiveHairGrafts != null && input.fiveHairGrafts >= 0
      ? { five_hair_grafts: Math.floor(input.fiveHairGrafts) }
      : {}),
    ...(followUp && patientSafeReportTextIsAllowed(followUp) ? { follow_up_plan: followUp } : {}),
  };

  return { ok: errors.length === 0, record, errors, warnings };
}

export function draftsToZoneInputs(drafts: RecipientZoneDraft[]): RecipientZoneRecordInput[] {
  return drafts.map((d) => ({
    zone_id: d.zone_id,
    graft_count: parseOptionalCount(d.graft_count),
    density_range: parseOptionalText(d.density_range),
    grafts_per_cm2: parseOptionalCount(d.grafts_per_cm2),
    graft_type_mix: {
      singles: parseOptionalCount(d.singles),
      doubles: parseOptionalCount(d.doubles),
      triples: parseOptionalCount(d.triples),
      multiHair: parseOptionalCount(d.multi_hair),
      fiveHair: parseOptionalCount(d.five_hair),
    },
    notes: parseOptionalText(d.notes),
  }));
}

export function mergeStaffRecordIntoCaseMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  record: PatientVisualSummaryStaffRecord
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  return { ...base, patient_visual_summary_record: record };
}