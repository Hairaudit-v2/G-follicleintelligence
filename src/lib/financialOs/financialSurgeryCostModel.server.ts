import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCostModelsTenantScoped,
  SURGEON_COST_TYPES,
  type FiSurgeryCostModel,
  type SurgeonCostType,
} from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import { mapCostModelRow } from "@/src/lib/financialOs/financialSurgeryEconomics.server";

export type FiSurgeryCostModelRow = FiSurgeryCostModel & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type SurgeryCostModelHistoryGroup = {
  procedure_type: string;
  active: FiSurgeryCostModelRow | null;
  history: FiSurgeryCostModelRow[];
};

function mapCostModelDbRow(raw: Record<string, unknown>): FiSurgeryCostModelRow {
  const base = mapCostModelRow(raw);
  return {
    ...base,
    id: String(raw.id),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    archived_at: raw.archived_at != null ? String(raw.archived_at) : null,
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
  };
}

export type SurgeryCostModelCreateInput = {
  procedure_type: string;
  surgeon_cost_type: SurgeonCostType;
  surgeon_cost_value_cents: number;
  rn_hourly_rate_cents: number;
  technician_hourly_rate_cents: number;
  assistant_hourly_rate_cents: number;
  room_hourly_cost_cents: number;
  consumables_base_cost_cents: number;
  graft_consumable_cost_cents: number;
  prp_cost_cents: number;
  exosome_cost_cents: number;
  medication_cost_cents: number;
  default_duration_minutes: number;
  activate?: boolean;
};

export type SurgeryCostModelUpdateInput = Partial<SurgeryCostModelCreateInput>;

function normalizeProcedureType(procedureType: string): string {
  const proc = procedureType.trim().toLowerCase();
  if (!proc) throw new Error("procedure_type is required.");
  return proc;
}

function assertSurgeonCostType(value: string): SurgeonCostType {
  const v = value.trim() as SurgeonCostType;
  if (!SURGEON_COST_TYPES.includes(v)) throw new Error("Invalid surgeon_cost_type.");
  return v;
}

async function archiveActiveCostModelsForProcedure(
  tenantId: string,
  procedureType: string,
  client: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("fi_surgery_cost_models")
    .update({ is_active: false, archived_at: now, updated_at: now })
    .eq("tenant_id", tenantId.trim())
    .eq("is_active", true)
    .ilike("procedure_type", procedureType);
  if (error) throw new Error(error.message);
}

export async function loadSurgeryCostModelsForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<FiSurgeryCostModelRow[]> {
  const tid = tenantId.trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_cost_models")
    .select("*")
    .eq("tenant_id", tid)
    .order("procedure_type", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => mapCostModelDbRow(r as Record<string, unknown>));
  if (!assertCostModelsTenantScoped(rows, tid)) throw new Error("Tenant isolation violation in cost models.");
  return rows;
}

export async function loadSurgeryCostModelHistoryGrouped(
  tenantId: string,
  client?: SupabaseClient
): Promise<SurgeryCostModelHistoryGroup[]> {
  const rows = await loadSurgeryCostModelsForTenant(tenantId, client);
  const byProcedure = new Map<string, SurgeryCostModelHistoryGroup>();
  for (const row of rows) {
    const key = row.procedure_type.trim().toLowerCase();
    const group = byProcedure.get(key) ?? { procedure_type: key, active: null, history: [] };
    if (row.is_active) group.active = row;
    else group.history.push(row);
    byProcedure.set(key, group);
  }
  return [...byProcedure.values()].sort((a, b) => a.procedure_type.localeCompare(b.procedure_type));
}

export async function loadSurgeryCostModelById(
  tenantId: string,
  modelId: string,
  client?: SupabaseClient
): Promise<FiSurgeryCostModelRow | null> {
  const tid = tenantId.trim();
  const id = modelId.trim();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_cost_models")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapCostModelDbRow(data as Record<string, unknown>);
}

export async function createSurgeryCostModel(args: {
  tenantId: string;
  input: SurgeryCostModelCreateInput;
  createdByFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<FiSurgeryCostModelRow> {
  const tid = args.tenantId.trim();
  const proc = normalizeProcedureType(args.input.procedure_type);
  const supabase = args.client ?? supabaseAdmin();
  const activate = args.input.activate !== false;
  const now = new Date().toISOString();

  if (activate) {
    await archiveActiveCostModelsForProcedure(tid, proc, supabase);
  }

  const insertRow = {
    tenant_id: tid,
    procedure_type: proc,
    surgeon_cost_type: assertSurgeonCostType(args.input.surgeon_cost_type),
    surgeon_cost_value_cents: Math.max(0, Math.floor(args.input.surgeon_cost_value_cents)),
    rn_hourly_rate_cents: Math.max(0, Math.floor(args.input.rn_hourly_rate_cents)),
    technician_hourly_rate_cents: Math.max(0, Math.floor(args.input.technician_hourly_rate_cents)),
    assistant_hourly_rate_cents: Math.max(0, Math.floor(args.input.assistant_hourly_rate_cents)),
    room_hourly_cost_cents: Math.max(0, Math.floor(args.input.room_hourly_cost_cents)),
    consumables_base_cost_cents: Math.max(0, Math.floor(args.input.consumables_base_cost_cents)),
    graft_consumable_cost_cents: Math.max(0, Math.floor(args.input.graft_consumable_cost_cents)),
    prp_cost_cents: Math.max(0, Math.floor(args.input.prp_cost_cents)),
    exosome_cost_cents: Math.max(0, Math.floor(args.input.exosome_cost_cents)),
    medication_cost_cents: Math.max(0, Math.floor(args.input.medication_cost_cents)),
    default_duration_minutes: Math.max(1, Math.min(1440, Math.floor(args.input.default_duration_minutes))),
    is_active: activate,
    archived_at: null,
    created_by_fi_user_id: args.createdByFiUserId?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from("fi_surgery_cost_models").insert(insertRow).select("*").single();
  if (error) throw new Error(error.message);
  return mapCostModelDbRow(data as Record<string, unknown>);
}

export async function updateActiveSurgeryCostModel(args: {
  tenantId: string;
  modelId: string;
  patch: SurgeryCostModelUpdateInput;
  client?: SupabaseClient;
}): Promise<FiSurgeryCostModelRow> {
  const tid = args.tenantId.trim();
  const id = args.modelId.trim();
  const supabase = args.client ?? supabaseAdmin();
  const existing = await loadSurgeryCostModelById(tid, id, supabase);
  if (!existing) throw new Error("Cost model not found.");
  if (!existing.is_active) throw new Error("Only the active cost model can be edited. Activate a version or create a new model.");

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const p = args.patch;
  if (p.procedure_type !== undefined) updatePayload.procedure_type = normalizeProcedureType(p.procedure_type);
  if (p.surgeon_cost_type !== undefined) updatePayload.surgeon_cost_type = assertSurgeonCostType(p.surgeon_cost_type);
  if (p.surgeon_cost_value_cents !== undefined) updatePayload.surgeon_cost_value_cents = Math.max(0, Math.floor(p.surgeon_cost_value_cents));
  if (p.rn_hourly_rate_cents !== undefined) updatePayload.rn_hourly_rate_cents = Math.max(0, Math.floor(p.rn_hourly_rate_cents));
  if (p.technician_hourly_rate_cents !== undefined) updatePayload.technician_hourly_rate_cents = Math.max(0, Math.floor(p.technician_hourly_rate_cents));
  if (p.assistant_hourly_rate_cents !== undefined) updatePayload.assistant_hourly_rate_cents = Math.max(0, Math.floor(p.assistant_hourly_rate_cents));
  if (p.room_hourly_cost_cents !== undefined) updatePayload.room_hourly_cost_cents = Math.max(0, Math.floor(p.room_hourly_cost_cents));
  if (p.consumables_base_cost_cents !== undefined) updatePayload.consumables_base_cost_cents = Math.max(0, Math.floor(p.consumables_base_cost_cents));
  if (p.graft_consumable_cost_cents !== undefined) updatePayload.graft_consumable_cost_cents = Math.max(0, Math.floor(p.graft_consumable_cost_cents));
  if (p.prp_cost_cents !== undefined) updatePayload.prp_cost_cents = Math.max(0, Math.floor(p.prp_cost_cents));
  if (p.exosome_cost_cents !== undefined) updatePayload.exosome_cost_cents = Math.max(0, Math.floor(p.exosome_cost_cents));
  if (p.medication_cost_cents !== undefined) updatePayload.medication_cost_cents = Math.max(0, Math.floor(p.medication_cost_cents));
  if (p.default_duration_minutes !== undefined) {
    updatePayload.default_duration_minutes = Math.max(1, Math.min(1440, Math.floor(p.default_duration_minutes)));
  }

  const { data, error } = await supabase
    .from("fi_surgery_cost_models")
    .update(updatePayload)
    .eq("tenant_id", tid)
    .eq("id", id)
    .eq("is_active", true)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCostModelDbRow(data as Record<string, unknown>);
}

export async function archiveSurgeryCostModel(args: {
  tenantId: string;
  modelId: string;
  client?: SupabaseClient;
}): Promise<FiSurgeryCostModelRow> {
  const tid = args.tenantId.trim();
  const id = args.modelId.trim();
  const supabase = args.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_surgery_cost_models")
    .update({ is_active: false, archived_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCostModelDbRow(data as Record<string, unknown>);
}

export async function activateSurgeryCostModel(args: {
  tenantId: string;
  modelId: string;
  client?: SupabaseClient;
}): Promise<FiSurgeryCostModelRow> {
  const tid = args.tenantId.trim();
  const id = args.modelId.trim();
  const supabase = args.client ?? supabaseAdmin();
  const model = await loadSurgeryCostModelById(tid, id, supabase);
  if (!model) throw new Error("Cost model not found.");
  if (model.is_active) return model;

  await archiveActiveCostModelsForProcedure(tid, model.procedure_type, supabase);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_surgery_cost_models")
    .update({ is_active: true, archived_at: null, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCostModelDbRow(data as Record<string, unknown>);
}

export async function loadCostModelCreatorLabels(
  tenantId: string,
  fiUserIds: string[],
  client?: SupabaseClient
): Promise<Map<string, string>> {
  const ids = [...new Set(fiUserIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    const r = row as { id: string; email?: string | null };
    const label = r.email?.trim() || r.id;
    out.set(String(r.id), label);
  }
  return out;
}
