import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
  isFiFeatureKey,
  type FiFeatureKey,
} from "@/src/config/fiFeatureAccessRegistry";

/**
 * Parses a JSON object from DB into partial feature toggles; unknown keys ignored.
 */
export function parseFeatureAccessJsonObject(raw: unknown): Partial<Record<FiFeatureKey, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<FiFeatureKey, boolean>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isFiFeatureKey(k)) continue;
    if (typeof v === "boolean") {
      out[k] = v;
    } else if (v === 1 || v === 0) {
      out[k] = Boolean(v);
    }
  }
  return out;
}

/**
 * Stage 3.5 merge order: all-enabled baseline → tenant operating mode → feature template → per-staff overrides (always wins).
 */
export function mergeFeatureAccessWithOrganisationalLayers(opts: {
  tenantModeDefaults?: Partial<Record<FiFeatureKey, boolean>>;
  templateDefaults?: Partial<Record<FiFeatureKey, boolean>>;
  staffOverrides: Partial<Record<FiFeatureKey, boolean>>;
}): Map<FiFeatureKey, boolean> {
  let m = buildDefaultFeatureAccessAllEnabled();
  m = applyPartialFeatureOverrides(m, opts.tenantModeDefaults ?? {});
  m = applyPartialFeatureOverrides(m, opts.templateDefaults ?? {});
  m = applyPartialFeatureOverrides(m, opts.staffOverrides);
  return m;
}
