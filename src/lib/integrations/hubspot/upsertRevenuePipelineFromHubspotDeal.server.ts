import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeBalanceAmount,
  mapHubspotDealStage,
  parseHubspotCloseDate,
  parseHubspotDealAmount,
  type RevenuePipelineStage,
} from "./hubspotDealStageMap";

export type UpsertRevenuePipelineInput = {
  tenantId: string;
  hubspotDealId: string;
  patientId: string | null;
  crmLeadId: string | null;
  stageRaw: string | null | undefined;
  amountRaw: string | number | null | undefined;
  depositAmountRaw?: string | number | null | undefined;
  procedureType?: string | null;
  closeDateRaw?: string | null;
  hubspotPayload: Record<string, unknown>;
};

export type UpsertRevenuePipelineResult = {
  id: string | null;
  created: boolean;
  mapped_stage: RevenuePipelineStage | null;
  stage_unmapped: boolean;
};

type ExistingPipelineRow = {
  id: string;
  stage: RevenuePipelineStage;
  expected_revenue: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  probability_score: number;
  procedure_type: string | null;
  forecast_date: string | null;
  patient_id: string | null;
  crm_lead_id: string | null;
};

/**
 * Create or update a fi_revenue_pipeline row keyed by tenant + hubspot_deal_id.
 * Never writes to fi_crm_quotes — parallel intelligence layer only.
 */
export async function upsertRevenuePipelineFromHubspotDeal(
  supabase: SupabaseClient,
  input: UpsertRevenuePipelineInput
): Promise<UpsertRevenuePipelineResult> {
  const tid = input.tenantId.trim();
  const dealId = input.hubspotDealId.trim();
  const mapped = mapHubspotDealStage(input.stageRaw);
  const expectedRevenue = parseHubspotDealAmount(input.amountRaw);
  const depositAmount = parseHubspotDealAmount(input.depositAmountRaw);
  const balanceAmount = computeBalanceAmount(expectedRevenue, depositAmount);
  const forecastDate = parseHubspotCloseDate(input.closeDateRaw);
  const procedureType = input.procedureType?.trim() || null;

  const { data: existingRaw, error: loadErr } = await supabase
    .from("fi_revenue_pipeline")
    .select("id, stage, expected_revenue, deposit_amount, balance_amount, probability_score, procedure_type, forecast_date, patient_id, crm_lead_id")
    .eq("tenant_id", tid)
    .eq("hubspot_deal_id", dealId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  const existing = existingRaw as ExistingPipelineRow | null;

  if (!existing && !mapped.stage) {
    return { id: null, created: false, mapped_stage: null, stage_unmapped: mapped.unmapped };
  }

  const row = {
    tenant_id: tid,
    hubspot_deal_id: dealId,
    patient_id: input.patientId ?? existing?.patient_id ?? null,
    crm_lead_id: input.crmLeadId ?? existing?.crm_lead_id ?? null,
    stage: mapped.stage ?? existing!.stage,
    expected_revenue: expectedRevenue ?? existing?.expected_revenue ?? null,
    deposit_amount: depositAmount ?? existing?.deposit_amount ?? null,
    balance_amount: balanceAmount ?? existing?.balance_amount ?? null,
    probability_score: mapped.stage ? mapped.probability_score : (existing?.probability_score ?? 0),
    procedure_type: procedureType ?? existing?.procedure_type ?? null,
    forecast_date: forecastDate ?? existing?.forecast_date ?? null,
    metadata: {
      source: "hubspot.deal_webhook",
      hubspot: input.hubspotPayload,
      stage_raw: input.stageRaw ?? null,
      stage_unmapped: mapped.unmapped,
    },
  };

  if (!existing) {
    const { data, error } = await supabase.from("fi_revenue_pipeline").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return {
      id: data ? String((data as { id: string }).id) : null,
      created: true,
      mapped_stage: mapped.stage,
      stage_unmapped: mapped.unmapped,
    };
  }

  const { data, error } = await supabase
    .from("fi_revenue_pipeline")
    .update(row)
    .eq("tenant_id", tid)
    .eq("id", existing.id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data ? String((data as { id: string }).id) : existing.id,
    created: false,
    mapped_stage: mapped.stage,
    stage_unmapped: mapped.unmapped,
  };
}
