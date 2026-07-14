/**
 * Canonical protocol slot vocabulary shared by catalog resolver and guided capture.
 * Prefer this module over `@/src/lib/imagingOs/imagingOsProtocol` for slot defs and parsing.
 */

export type ProtocolSlotDef = {
  slug: string;
  label: string;
  /** When false, slot is optional. */
  required?: boolean;
  suggested_region?: string;
  /** Recommended angle / framing (from template JSON or UI default). */
  instruction?: string;
};

/** Reserved progress key for session lifecycle + optional slot skips. */
export const PROGRESS_META_KEY = "__meta__" as const;

export function parseProtocolSlots(slotsJson: unknown): ProtocolSlotDef[] {
  if (!slotsJson || typeof slotsJson !== "object" || Array.isArray(slotsJson)) return [];
  const root = slotsJson as Record<string, unknown>;
  const raw = root.slots;
  if (!Array.isArray(raw)) return [];
  const out: ProtocolSlotDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const slug = typeof o.slug === "string" ? o.slug.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!slug || !label) continue;
    const required = o.required === false ? false : true;
    const suggested_region =
      typeof o.suggested_region === "string" ? o.suggested_region.trim() : undefined;
    const instructionRaw =
      typeof o.instruction === "string"
        ? o.instruction.trim()
        : typeof o.angle_hint === "string"
          ? o.angle_hint.trim()
          : typeof o.hint === "string"
            ? o.hint.trim()
            : "";
    const instruction = instructionRaw || undefined;
    out.push({ slug, label, required, suggested_region, instruction });
  }
  return out;
}
