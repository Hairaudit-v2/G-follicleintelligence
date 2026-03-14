/**
 * fi_tenants.config_json schema and server utilities.
 * Tenants can change branding and flags without deploy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiScorecardSectionId } from "./scorecard";

/** Report branding: logo, colours, footer. Used by PDF renderer. */
export type TenantBranding = {
  logo_url?: string | null;
  primary_color?: string | null; // hex e.g. "#C6A75E"
  secondary_color?: string | null; // hex e.g. "#0F1B2D"
  brand_name?: string | null; // e.g. "Follicle Intelligence™"
  footer_text?: string | null;
};

/** Feature flags. Engine stages check these. */
export type TenantFeatureFlags = {
  enable_image_signals?: boolean;
  enable_progression_model?: boolean;
  enable_androgen_age_chart?: boolean;
  enable_surgical_readiness?: boolean;
};

/** Scoring weight overrides. Keys = FiScorecardSectionId. */
export type TenantScorecardWeights = Partial<Record<FiScorecardSectionId, number>>;

export type TenantConfig = {
  branding?: TenantBranding | null;
  feature_flags?: TenantFeatureFlags | null;
  scorecard_weights?: TenantScorecardWeights | null;
};

const DEFAULT_BRANDING: TenantBranding = {
  primary_color: "#C6A75E",
  secondary_color: "#0F1B2D",
  brand_name: "Follicle Intelligence™",
};

const DEFAULT_FEATURE_FLAGS: TenantFeatureFlags = {
  enable_image_signals: true,
  enable_progression_model: true,
  enable_androgen_age_chart: true,
  enable_surgical_readiness: true,
};

/** Resolve full config with defaults for missing fields. */
export function resolveTenantConfig(raw: TenantConfig | null): TenantConfig {
  if (!raw) return { branding: DEFAULT_BRANDING, feature_flags: DEFAULT_FEATURE_FLAGS };
  return {
    branding: { ...DEFAULT_BRANDING, ...raw.branding },
    feature_flags: { ...DEFAULT_FEATURE_FLAGS, ...raw.feature_flags },
    scorecard_weights: raw.scorecard_weights ?? undefined,
  };
}

/** Fetch tenant config from fi_tenants.config_json. */
export async function getTenantConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantConfig | null> {
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("config_json")
    .eq("id", tenantId)
    .single();

  if (error || !data) return null;
  const raw = data.config_json;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  return raw as TenantConfig;
}

/** Fetch and resolve tenant config with defaults. */
export async function getTenantConfigResolved(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantConfig> {
  const raw = await getTenantConfig(supabase, tenantId);
  return resolveTenantConfig(raw);
}

/**
 * Server utility: fetch tenant config by tenantId only.
 * Uses admin client. Prefer passing supabase when already in context.
 */
export async function getTenantConfigById(tenantId: string): Promise<TenantConfig | null> {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return getTenantConfig(supabaseAdmin(), tenantId);
}

/** Server utility: fetch and resolve tenant config by tenantId only. */
export async function getTenantConfigResolvedById(tenantId: string): Promise<TenantConfig> {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  return getTenantConfigResolved(supabaseAdmin(), tenantId);
}
