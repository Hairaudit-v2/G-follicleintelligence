/**
 * FI OS Stage 6 — outcome intelligence registry (checkpoints, metrics, protocols).
 * Typed vocabulary for UI, loaders, and aggregation contracts (no clinical automation).
 */

export const FI_OUTCOME_CHECKPOINT_KEYS = [
  "baseline",
  "day_1",
  "day_7",
  "month_1",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "month_18",
  "month_24",
] as const;

export type FiOutcomeCheckpointKey = (typeof FI_OUTCOME_CHECKPOINT_KEYS)[number];

export const FI_OUTCOME_METRIC_KEYS = [
  "graft_survival_estimate",
  "density_change",
  "donor_recovery_score",
  "hairline_design_score",
  "patient_satisfaction_score",
  "complication_flag",
  "shock_loss_flag",
  "infection_flag",
  "medication_adherence",
  "prp_completed",
  "exosome_completed",
  "imaging_available",
  "audit_score_available",
  "twin_integrity_score",
] as const;

export type FiOutcomeMetricKey = (typeof FI_OUTCOME_METRIC_KEYS)[number];

export const FI_OUTCOME_PROTOCOL_KEYS = [
  "fue",
  "dfi",
  "ptt",
  "sapphire",
  "implanter_pen",
  "forceps_implantation",
  "prp",
  "prf",
  "exosomes",
  "finasteride",
  "dutasteride",
  "oral_minoxidil",
  "topical_minoxidil",
  "saw_palmetto",
  "laser_therapy",
] as const;

export type FiOutcomeProtocolKey = (typeof FI_OUTCOME_PROTOCOL_KEYS)[number];

export type FiOutcomeRegistryCategory = "checkpoint" | "metric" | "protocol";

/** Where the datum may appear in product surfaces (not an RLS substitute). */
export type FiOutcomeRegistryVisibility =
  | "tenant_clinical"
  | "tenant_aggregate"
  | "network_candidate";

/**
 * - `tenant_only`: never roll into cross-tenant aggregates.
 * - `anonymisable`: may contribute to anonymised network stats when aggregated with governance thresholds.
 * - `not_network`: captured for tenant workflows but excluded from network aggregation by design.
 */
export type FiOutcomeAggregationSuitability = "tenant_only" | "anonymisable" | "not_network";

export type FiOutcomeRegistryEntry = {
  key: string;
  label: string;
  description: string;
  category: FiOutcomeRegistryCategory;
  visibility: FiOutcomeRegistryVisibility;
  aggregationSuitability: FiOutcomeAggregationSuitability;
};

const checkpoint = (
  key: FiOutcomeCheckpointKey,
  label: string,
  description: string,
  visibility: FiOutcomeRegistryVisibility,
  aggregationSuitability: FiOutcomeAggregationSuitability
): FiOutcomeRegistryEntry => ({
  key,
  label,
  description,
  category: "checkpoint",
  visibility,
  aggregationSuitability,
});

const metric = (
  key: FiOutcomeMetricKey,
  label: string,
  description: string,
  visibility: FiOutcomeRegistryVisibility,
  aggregationSuitability: FiOutcomeAggregationSuitability
): FiOutcomeRegistryEntry => ({
  key,
  label,
  description,
  category: "metric",
  visibility,
  aggregationSuitability,
});

const protocol = (
  key: FiOutcomeProtocolKey,
  label: string,
  description: string,
  visibility: FiOutcomeRegistryVisibility,
  aggregationSuitability: FiOutcomeAggregationSuitability
): FiOutcomeRegistryEntry => ({
  key,
  label,
  description,
  category: "protocol",
  visibility,
  aggregationSuitability,
});

/** Canonical ordering for timeline / completeness (earliest → latest). */
export const FI_OUTCOME_CHECKPOINT_REGISTRY: readonly FiOutcomeRegistryEntry[] = [
  checkpoint(
    "baseline",
    "Baseline",
    "Pre- or peri-treatment baseline capture before primary intervention.",
    "tenant_clinical",
    "anonymisable"
  ),
  checkpoint(
    "day_1",
    "Day 1",
    "Immediate post-operative checkpoint.",
    "tenant_clinical",
    "anonymisable"
  ),
  checkpoint("day_7", "Day 7", "Early healing checkpoint.", "tenant_clinical", "anonymisable"),
  checkpoint(
    "month_1",
    "Month 1",
    "One-month structural review window.",
    "tenant_clinical",
    "anonymisable"
  ),
  checkpoint(
    "month_3",
    "Month 3",
    "Early density / shock-loss window.",
    "tenant_aggregate",
    "anonymisable"
  ),
  checkpoint(
    "month_6",
    "Month 6",
    "Mid-term growth checkpoint.",
    "tenant_aggregate",
    "anonymisable"
  ),
  checkpoint(
    "month_9",
    "Month 9",
    "Optional mid-longitudinal review.",
    "tenant_aggregate",
    "anonymisable"
  ),
  checkpoint(
    "month_12",
    "Month 12",
    "Primary 12-month outcome window.",
    "tenant_aggregate",
    "anonymisable"
  ),
  checkpoint(
    "month_18",
    "Month 18",
    "Extended follow-up window.",
    "tenant_aggregate",
    "anonymisable"
  ),
  checkpoint(
    "month_24",
    "Month 24",
    "Longitudinal stability window.",
    "tenant_aggregate",
    "anonymisable"
  ),
];

export const FI_OUTCOME_METRIC_REGISTRY: readonly FiOutcomeRegistryEntry[] = [
  metric(
    "graft_survival_estimate",
    "Graft survival (estimate)",
    "Structured estimate of graft take / survival when explicitly recorded (not inferred).",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "density_change",
    "Density change",
    "Relative or absolute density delta when measured (imaging-linked in refs, not auto-judged).",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "donor_recovery_score",
    "Donor recovery score",
    "Donor-healing score or grade captured from source documentation (no auto scoring).",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "hairline_design_score",
    "Hairline design score",
    "Design satisfaction or rubric score from structured capture (not AI-generated).",
    "tenant_clinical",
    "tenant_only"
  ),
  metric(
    "patient_satisfaction_score",
    "Patient satisfaction",
    "Numeric or ordinal satisfaction from patient-reported capture.",
    "tenant_aggregate",
    "anonymisable"
  ),
  metric(
    "complication_flag",
    "Complication recorded",
    "Boolean / enum flag when a complication is explicitly documented.",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "shock_loss_flag",
    "Shock loss recorded",
    "Boolean / enum flag when shock loss is explicitly documented.",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "infection_flag",
    "Infection recorded",
    "Boolean / enum flag when infection is explicitly documented.",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "medication_adherence",
    "Medication adherence",
    "Structured adherence signal from therapy tracking (tenant-clinical detail).",
    "tenant_clinical",
    "not_network"
  ),
  metric(
    "prp_completed",
    "PRP completed",
    "Adjunct PRP session completion flag from protocol or events.",
    "tenant_aggregate",
    "anonymisable"
  ),
  metric(
    "exosome_completed",
    "Exosome therapy completed",
    "Adjunct exosome session completion flag from protocol or events.",
    "tenant_aggregate",
    "anonymisable"
  ),
  metric(
    "imaging_available",
    "Imaging available",
    "Indicates linked imaging evidence exists for the checkpoint (metadata only).",
    "tenant_clinical",
    "anonymisable"
  ),
  metric(
    "audit_score_available",
    "Audit score available",
    "Indicates a HairAudit or formal audit score reference exists (no score interpretation here).",
    "tenant_clinical",
    "tenant_only"
  ),
  metric(
    "twin_integrity_score",
    "Twin integrity score",
    "Patient Twin completeness / integrity index (tenant operational; not for public benchmarking).",
    "tenant_clinical",
    "not_network"
  ),
];

export const FI_OUTCOME_PROTOCOL_REGISTRY: readonly FiOutcomeRegistryEntry[] = [
  protocol(
    "fue",
    "FUE",
    "Follicular unit excision harvesting technique.",
    "tenant_clinical",
    "anonymisable"
  ),
  protocol(
    "dfi",
    "DFI",
    "Direct follicle implantation or related implantation variant.",
    "tenant_clinical",
    "anonymisable"
  ),
  protocol(
    "ptt",
    "PTT",
    "Partial / targeted technique code as used by the tenant.",
    "tenant_clinical",
    "anonymisable"
  ),
  protocol(
    "sapphire",
    "Sapphire blades",
    "Sapphire blade tooling noted for incisions.",
    "tenant_clinical",
    "anonymisable"
  ),
  protocol(
    "implanter_pen",
    "Implanter pen",
    "Implanter pen implantation method.",
    "tenant_clinical",
    "anonymisable"
  ),
  protocol(
    "forceps_implantation",
    "Forceps implantation",
    "Traditional forceps-assisted implantation.",
    "tenant_clinical",
    "anonymisable"
  ),
  protocol("prp", "PRP", "Platelet-rich plasma adjunct.", "tenant_aggregate", "anonymisable"),
  protocol("prf", "PRF", "Platelet-rich fibrin adjunct.", "tenant_aggregate", "anonymisable"),
  protocol("exosomes", "Exosomes", "Exosome adjunct therapy.", "tenant_aggregate", "anonymisable"),
  protocol(
    "finasteride",
    "Finasteride",
    "Systemic finasteride maintenance (MedicationOS / protocol capture).",
    "tenant_clinical",
    "not_network"
  ),
  protocol(
    "dutasteride",
    "Dutasteride",
    "Systemic dutasteride maintenance (MedicationOS / protocol capture).",
    "tenant_clinical",
    "not_network"
  ),
  protocol(
    "oral_minoxidil",
    "Oral minoxidil",
    "Oral minoxidil maintenance (MedicationOS / protocol capture).",
    "tenant_clinical",
    "not_network"
  ),
  protocol(
    "topical_minoxidil",
    "Topical minoxidil",
    "Topical minoxidil maintenance (MedicationOS / protocol capture).",
    "tenant_clinical",
    "not_network"
  ),
  protocol(
    "saw_palmetto",
    "Saw palmetto",
    "Botanical maintenance noted in protocol capture.",
    "tenant_clinical",
    "not_network"
  ),
  protocol(
    "laser_therapy",
    "Low-level laser therapy",
    "LLLT or laser cap protocol flag.",
    "tenant_aggregate",
    "anonymisable"
  ),
];

const ALL_REGISTRY: readonly FiOutcomeRegistryEntry[] = [
  ...FI_OUTCOME_CHECKPOINT_REGISTRY,
  ...FI_OUTCOME_METRIC_REGISTRY,
  ...FI_OUTCOME_PROTOCOL_REGISTRY,
];

const KEY_SET = new Set(ALL_REGISTRY.map((e) => e.key));

export function assertFiOutcomeIntelligenceRegistryComplete(): void {
  for (const k of FI_OUTCOME_CHECKPOINT_KEYS) {
    const hit = FI_OUTCOME_CHECKPOINT_REGISTRY.find((e) => e.key === k);
    if (!hit) throw new Error(`Missing checkpoint registry entry: ${k}`);
  }
  for (const k of FI_OUTCOME_METRIC_KEYS) {
    const hit = FI_OUTCOME_METRIC_REGISTRY.find((e) => e.key === k);
    if (!hit) throw new Error(`Missing metric registry entry: ${k}`);
  }
  for (const k of FI_OUTCOME_PROTOCOL_KEYS) {
    const hit = FI_OUTCOME_PROTOCOL_REGISTRY.find((e) => e.key === k);
    if (!hit) throw new Error(`Missing protocol registry entry: ${k}`);
  }
  if (KEY_SET.size !== ALL_REGISTRY.length) {
    throw new Error("Duplicate keys in FI outcome intelligence registry.");
  }
}

export function isFiOutcomeCheckpointKey(v: string): v is FiOutcomeCheckpointKey {
  return (FI_OUTCOME_CHECKPOINT_KEYS as readonly string[]).includes(v);
}

export function isFiOutcomeMetricKey(v: string): v is FiOutcomeMetricKey {
  return (FI_OUTCOME_METRIC_KEYS as readonly string[]).includes(v);
}

export function isFiOutcomeProtocolKey(v: string): v is FiOutcomeProtocolKey {
  return (FI_OUTCOME_PROTOCOL_KEYS as readonly string[]).includes(v);
}

/** Stable checkpoint order for completeness and UI sorting. */
export function fiOutcomeCheckpointOrderIndex(checkpointKey: string): number {
  const i = FI_OUTCOME_CHECKPOINT_KEYS.indexOf(checkpointKey as FiOutcomeCheckpointKey);
  return i >= 0 ? i : 999;
}
