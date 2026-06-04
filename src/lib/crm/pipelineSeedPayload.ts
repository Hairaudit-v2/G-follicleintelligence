/**
 * Pure defaults for lazy hair-restoration pipeline seeding (doc 17 / 18). No I/O.
 */

import { DEFAULT_CRM_PIPELINE_KEY } from "./types";

export type DefaultPipelineStageDefinition = {
  slug: string;
  label: string;
  sort_order: number;
  is_entry: boolean;
  is_won: boolean;
  is_lost: boolean;
};

/** Stable ordering: lower sort_order = earlier funnel. */
export function defaultHairRestorationPipelineDefinitions(): readonly DefaultPipelineStageDefinition[] {
  return [
    { slug: "new", label: "New inquiry", sort_order: 0, is_entry: true, is_won: false, is_lost: false },
    { slug: "contacted", label: "Contacted", sort_order: 10, is_entry: false, is_won: false, is_lost: false },
    { slug: "qualified", label: "Qualified", sort_order: 20, is_entry: false, is_won: false, is_lost: false },
    { slug: "consult_scheduled", label: "Consult scheduled", sort_order: 30, is_entry: false, is_won: false, is_lost: false },
    { slug: "consult_completed", label: "Consult completed", sort_order: 40, is_entry: false, is_won: false, is_lost: false },
    { slug: "treatment_planning", label: "Treatment planning", sort_order: 50, is_entry: false, is_won: false, is_lost: false },
    { slug: "quote_sent", label: "Quote sent", sort_order: 60, is_entry: false, is_won: false, is_lost: false },
    { slug: "deposit_or_booked", label: "Deposit / booked", sort_order: 70, is_entry: false, is_won: false, is_lost: false },
    { slug: "in_treatment", label: "In treatment", sort_order: 80, is_entry: false, is_won: false, is_lost: false },
    { slug: "won_closed", label: "Won / completed", sort_order: 90, is_entry: false, is_won: true, is_lost: false },
    { slug: "lost", label: "Lost", sort_order: 100, is_entry: false, is_won: false, is_lost: true },
    { slug: "nurture", label: "Nurture", sort_order: 110, is_entry: false, is_won: false, is_lost: false },
  ] as const;
}

export type PipelineStageInsertRow = {
  tenant_id: string;
  organisation_id: string | null;
  clinic_id: string | null;
  pipeline_key: string;
  slug: string;
  label: string;
  sort_order: number;
  is_entry: boolean;
  is_won: boolean;
  is_lost: boolean;
  metadata: Record<string, unknown>;
};

/**
 * Build INSERT payloads for the default pipeline at a concrete tenant/org/clinic scope.
 */
export function buildDefaultPipelineStageInsertRows(params: {
  tenantId: string;
  organisationId: string | null;
  clinicId: string | null;
  pipelineKey?: string;
}): PipelineStageInsertRow[] {
  const pipelineKey = (params.pipelineKey ?? DEFAULT_CRM_PIPELINE_KEY).trim() || DEFAULT_CRM_PIPELINE_KEY;
  const defs = defaultHairRestorationPipelineDefinitions();
  return defs.map((d) => ({
    tenant_id: params.tenantId.trim(),
    organisation_id: params.organisationId,
    clinic_id: params.clinicId,
    pipeline_key: pipelineKey,
    slug: d.slug,
    label: d.label,
    sort_order: d.sort_order,
    is_entry: d.is_entry,
    is_won: d.is_won,
    is_lost: d.is_lost,
    metadata: { seed: "fi_crm_default_hair_restoration", slug: d.slug },
  }));
}

/** Exactly one entry stage is required in the default definition set. */
export function assertDefaultPipelineStageOrderingInvariant(
  defs: readonly DefaultPipelineStageDefinition[] = defaultHairRestorationPipelineDefinitions()
): void {
  const entries = defs.filter((d) => d.is_entry);
  if (entries.length !== 1) {
    throw new Error(`Default pipeline must have exactly one is_entry stage; found ${entries.length}.`);
  }
  const sorted = [...defs].sort((a, b) => a.sort_order - b.sort_order);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].sort_order <= sorted[i - 1].sort_order) {
      throw new Error("Default pipeline stages must have strictly increasing sort_order values.");
    }
  }
}

export function sortPipelineStagesByOrder<T extends { sort_order: number }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => a.sort_order - b.sort_order);
}
