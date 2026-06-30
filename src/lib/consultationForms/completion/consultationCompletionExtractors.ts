import { getClinicalNoteText, getVoiceNoteTranscript } from "../consultationFormNoteModel";
import {
  aggregateBodyAreaMapByRegionLabel,
  normalizeBodyAreaMapValue,
  BODY_AREA_MAP_VIEW_LABELS,
  type BodyAreaMapViewId,
} from "../bodyAreaMapModel";

export function readString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return "";
}

export function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function readBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "yes" || v === 1) return true;
  return false;
}

export function readNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseFloat(v.trim());
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Parses "2000-2800", "2000–2800", "2000 to 2800" into min/max when possible. */
export function parseGraftRangeText(raw: string): { min: number; max: number } | null {
  const s = raw.trim();
  if (!s) return null;
  const norm = s.replace(/–/g, "-").replace(/\s+to\s+/i, "-");
  const m = norm.match(/(\d[\d\s]*)\s*[-–]\s*(\d[\d\s]*)/);
  if (m) {
    const a = Number.parseInt(m[1]!.replace(/\s/g, ""), 10);
    const b = Number.parseInt(m[2]!.replace(/\s/g, ""), 10);
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const single = norm.match(/\d{3,5}/);
  if (single) {
    const n = Number.parseInt(single[0]!, 10);
    if (!Number.isNaN(n)) return { min: n, max: n };
  }
  return null;
}

export function mergeUniqueStrings(...groups: string[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const x of g) {
      const k = x.trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function extractBodyAreaMapHighlights(
  concernMap: unknown,
  limit = 12
): { view: string; label: string; severity: string }[] {
  if (!concernMap || typeof concernMap !== "object" || Array.isArray(concernMap)) return [];
  const { annotations } = normalizeBodyAreaMapValue(concernMap);
  const agg = aggregateBodyAreaMapByRegionLabel(annotations);
  return agg.slice(0, limit).map((row) => ({
    view:
      row.views
        .map((v) => BODY_AREA_MAP_VIEW_LABELS[v as BodyAreaMapViewId] ?? String(v))
        .filter(Boolean)
        .join(" · ") || "—",
    label: row.labelValue,
    severity: row.severity,
  }));
}

export function buildClinicianNotesPreview(values: Record<string, unknown>, maxLen = 420): string {
  const parts: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t) parts.push(t);
  };
  /** Prefer v2 canonical note, then AI plan draft, then legacy diagnosis surfaces, then dictation / final lines. */
  push(getClinicalNoteText(values.structured_clinical_note));
  push(readString(values.ai_recommended_plan_summary));
  push(getClinicalNoteText(values.diagnosis_clinical_note));
  push(readString(values.diagnosis_free_text));
  push(getVoiceNoteTranscript(values.clinician_voice_note));
  push(readString(values.final_clinician_comments));
  const merged = parts.join("\n\n").replace(/\s+/g, " ").trim();
  if (merged.length <= maxLen) return merged;
  return `${merged.slice(0, maxLen - 1)}…`;
}

export function labelForOptionValue(
  options: { value: string; label: string }[],
  value: string
): string {
  const v = value.trim();
  if (!v) return "";
  const hit = options.find((o) => o.value === v);
  return hit?.label ?? v;
}
