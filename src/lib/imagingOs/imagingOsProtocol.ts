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

export type ProgressMeta = {
  status?: "active" | "completed";
  completed_at?: string;
  /** Operator ended session early (optional slots may be empty). */
  finished_at?: string;
  skips?: Record<string, { reason: string; skipped_at: string }>;
};

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
    const suggested_region = typeof o.suggested_region === "string" ? o.suggested_region.trim() : undefined;
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

export function parseProgressMeta(progress: Record<string, unknown>): ProgressMeta {
  const raw = progress[PROGRESS_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const m = raw as Record<string, unknown>;
  const status = m.status === "completed" || m.status === "active" ? m.status : undefined;
  const skipsRaw = m.skips;
  let skips: ProgressMeta["skips"];
  if (skipsRaw && typeof skipsRaw === "object" && !Array.isArray(skipsRaw)) {
    skips = {};
    for (const [k, v] of Object.entries(skipsRaw as Record<string, unknown>)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        const reason = typeof o.reason === "string" ? o.reason.trim() : "";
        const skipped_at = typeof o.skipped_at === "string" ? o.skipped_at.trim() : "";
        if (reason && skipped_at) skips[k] = { reason, skipped_at };
      }
    }
  }
  return {
    status,
    completed_at: typeof m.completed_at === "string" ? m.completed_at : undefined,
    finished_at: typeof m.finished_at === "string" ? m.finished_at : undefined,
    skips,
  };
}

export function isSessionMarkedComplete(progress: Record<string, unknown>): boolean {
  const m = parseProgressMeta(progress);
  return m.status === "completed" || Boolean(m.completed_at) || Boolean(m.finished_at);
}

export function getSlotImageIds(progress: Record<string, unknown>, slotSlug: string): string[] {
  if (slotSlug === PROGRESS_META_KEY) return [];
  const v = progress[slotSlug];
  if (!Array.isArray(v)) return [];
  return v.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
}

export function slotIsSatisfied(slot: ProtocolSlotDef, progress: Record<string, unknown>): boolean {
  const ids = getSlotImageIds(progress, slot.slug);
  if (ids.length > 0) return true;
  if (slot.required === false) {
    const sk = parseProgressMeta(progress).skips?.[slot.slug];
    return Boolean(sk?.reason?.trim());
  }
  return false;
}

/** Required slots only — optional slots may be skipped without affecting this percentage. */
export function protocolRequiredCompletionPercent(slots: ProtocolSlotDef[], progress: Record<string, unknown>): number {
  const required = slots.filter((s) => s.required !== false);
  if (required.length === 0) return 100;
  let fulfilled = 0;
  for (const s of required) {
    if (slotIsSatisfied(s, progress)) fulfilled++;
  }
  return Math.round((fulfilled / required.length) * 100);
}

export function missingRequiredSlotSlugs(slots: ProtocolSlotDef[], progress: Record<string, unknown>): string[] {
  return slots.filter((s) => s.required !== false && !slotIsSatisfied(s, progress)).map((s) => s.slug);
}

export function firstIncompleteSlotIndex(slots: ProtocolSlotDef[], progress: Record<string, unknown>): number {
  const idx = slots.findIndex((s) => !slotIsSatisfied(s, progress));
  return idx >= 0 ? idx : Math.max(0, slots.length - 1);
}

/** Next slot to capture: required gaps first, then optional not yet satisfied. */
export function nextRecommendedSlotSlug(slots: ProtocolSlotDef[], progress: Record<string, unknown>): string | null {
  const missingReq = missingRequiredSlotSlugs(slots, progress);
  if (missingReq.length > 0) return missingReq[0] ?? null;
  const opt = slots.find((s) => s.required === false && !slotIsSatisfied(s, progress));
  return opt?.slug ?? null;
}

export function assertSlotBelongsToTemplate(slots: ProtocolSlotDef[], slotSlug: string): void {
  if (!slots.some((s) => s.slug === slotSlug)) {
    throw new Error("Slot not in protocol template.");
  }
}

export const mergeProgressForSlotCapture = {
  extractPreviousSlotImageIds(progress: Record<string, unknown>, slotSlug: string): string[] {
    return getSlotImageIds(progress, slotSlug);
  },
  apply(progress: Record<string, unknown>, slotSlug: string, newImageId: string): Record<string, unknown> {
    const next = { ...progress };
    next[slotSlug] = [newImageId.trim()];
    return next;
  },
};

export function defaultSlotInstruction(slot: ProtocolSlotDef): string {
  if (slot.instruction?.trim()) return slot.instruction.trim();
  const region = slot.suggested_region?.replace(/_/g, " ") ?? "target area";
  return `Fill the frame with the ${region}. Keep the device level, avoid motion blur, and capture in good light.`;
}
