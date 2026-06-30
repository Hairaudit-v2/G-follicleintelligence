import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiFinanceProviderType } from "@/src/lib/financialOs/financialFinanceApplicationsCore";

export type FinanceProviderRecord = {
  id: string;
  tenant_id: string | null;
  name: string;
  provider_type: FiFinanceProviderType;
  country_code: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const SELECT_COLUMNS =
  "id, tenant_id, name, provider_type, country_code, is_active, metadata, created_at, updated_at";

function mapRow(raw: Record<string, unknown>): FinanceProviderRecord {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: raw.tenant_id ? String(raw.tenant_id) : null,
    name: String(raw.name ?? ""),
    provider_type: raw.provider_type as FiFinanceProviderType,
    country_code: raw.country_code ? String(raw.country_code) : null,
    is_active: Boolean(raw.is_active),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

/**
 * Loads global catalog providers plus tenant-specific providers.
 */
export async function loadFinanceProviders(tenantId: string): Promise<FinanceProviderRecord[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_finance_providers")
    .select(SELECT_COLUMNS)
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function createFinanceProvider(args: {
  tenantId: string;
  name: string;
  providerType: FiFinanceProviderType;
  countryCode?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<FinanceProviderRecord> {
  const tid = args.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_finance_providers")
    .insert({
      tenant_id: tid,
      name: args.name.trim(),
      provider_type: args.providerType,
      country_code: args.countryCode?.trim() || null,
      is_active: args.isActive ?? true,
      metadata: args.metadata ?? {},
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updateFinanceProvider(args: {
  tenantId: string;
  providerId: string;
  name?: string;
  providerType?: FiFinanceProviderType;
  countryCode?: string | null;
  isActive?: boolean;
  metadataPatch?: Record<string, unknown>;
}): Promise<FinanceProviderRecord> {
  const tid = args.tenantId.trim();
  const pid = args.providerId.trim();
  const supabase = supabaseAdmin();

  const { data: existing, error: fe } = await supabase
    .from("fi_finance_providers")
    .select(SELECT_COLUMNS)
    .eq("id", pid)
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`)
    .maybeSingle();
  if (fe) throw new Error(fe.message);
  if (!existing) throw new Error("Finance provider not found.");

  const row = mapRow(existing as Record<string, unknown>);
  if (row.tenant_id && row.tenant_id !== tid) throw new Error("Finance provider not found.");

  const patch: Record<string, unknown> = {};
  if (args.name !== undefined) patch.name = args.name.trim();
  if (args.providerType !== undefined) patch.provider_type = args.providerType;
  if (args.countryCode !== undefined) patch.country_code = args.countryCode?.trim() || null;
  if (args.isActive !== undefined) patch.is_active = args.isActive;
  if (args.metadataPatch) {
    patch.metadata = { ...row.metadata, ...args.metadataPatch };
  }

  const { data, error } = await supabase
    .from("fi_finance_providers")
    .update(patch)
    .eq("id", pid)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
