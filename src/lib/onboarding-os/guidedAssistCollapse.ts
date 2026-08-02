/**
 * Clinic guide dock collapse preference (client-only storage helpers + pure defaults).
 * Keeps the guide from auto-popping when the user has turned it off or collapsed it.
 */

/** localStorage key prefix — value is "1" (collapsed) or "0" (expanded). */
export const GUIDED_ASSIST_COLLAPSE_STORAGE_PREFIX = "fi_clinic_guide_collapsed";

export function guidedAssistCollapseStorageKey(tenantId: string): string {
  const tid = tenantId.trim().toLowerCase();
  return tid
    ? `${GUIDED_ASSIST_COLLAPSE_STORAGE_PREFIX}:${tid}`
    : GUIDED_ASSIST_COLLAPSE_STORAGE_PREFIX;
}

export type GuidedAssistCollapseDecisionInput = {
  /**
   * Explicit user preference from storage.
   * true = collapsed, false = expanded, null = no stored preference.
   */
  storedCollapsed: boolean | null;
  /** Tips/content visible (preference on or admin force-show). */
  guideVisible: boolean;
  /** Calendar day surface — keep dock compact. */
  onCalendarSurface: boolean;
  /** Narrow phones prefer collapsed so the dock does not fight bottom nav. */
  prefersNarrowViewport: boolean;
};

/**
 * Resolve whether the Clinic guide dock should start collapsed.
 *
 * Priority:
 * 1. Calendar → always collapsed
 * 2. Guide off (not force-shown) → collapsed (mount also hides dock entirely)
 * 3. Stored user preference → honor it
 * 4. Narrow viewport → collapsed
 * 5. Default → expanded on desktop when guide is on
 */
export function resolveGuidedAssistInitialCollapsed(
  input: GuidedAssistCollapseDecisionInput
): boolean {
  if (input.onCalendarSurface) return true;
  if (!input.guideVisible) return true;
  if (input.storedCollapsed !== null) return input.storedCollapsed;
  if (input.prefersNarrowViewport) return true;
  return false;
}

export function readGuidedAssistCollapsedPreference(
  storage: Pick<Storage, "getItem"> | null | undefined,
  tenantId: string
): boolean | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(guidedAssistCollapseStorageKey(tenantId));
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeGuidedAssistCollapsedPreference(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  tenantId: string,
  collapsed: boolean
): void {
  if (!storage) return;
  try {
    storage.setItem(guidedAssistCollapseStorageKey(tenantId), collapsed ? "1" : "0");
  } catch {
    /* private mode / quota — ignore */
  }
}
