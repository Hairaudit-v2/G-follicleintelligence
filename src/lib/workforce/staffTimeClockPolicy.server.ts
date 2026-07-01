import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  mergeWorkforceTimeClockPolicyIntoMetadata,
  parseWorkforceTimeClockPolicy,
  type WorkforceTimeClockPolicy,
} from "./staffTimeClockPolicyCore";

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function upsertTenantSettingsMetadata(
  tenantId: string,
  metadata: Record<string, unknown>,
  client: SupabaseClient
): Promise<void> {
  const tid = tenantId.trim();
  const now = new Date().toISOString();
  const { data: existing, error: loadErr } = await client
    .from("fi_tenant_settings")
    .select("id")
    .eq("tenant_id", tid)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  if (existing) {
    const { error } = await client
      .from("fi_tenant_settings")
      .update({ metadata, updated_at: now })
      .eq("tenant_id", tid);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("fi_tenant_settings").insert({
      tenant_id: tid,
      metadata,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  }
}

export async function loadWorkforceTimeClockPolicy(
  tenantId: string,
  client?: SupabaseClient
): Promise<WorkforceTimeClockPolicy> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { metadata?: unknown } | null;
  return parseWorkforceTimeClockPolicy(asMetadataRecord(row?.metadata));
}

export async function saveWorkforceTimeClockPolicy(
  tenantId: string,
  patch: Partial<WorkforceTimeClockPolicy>,
  client?: SupabaseClient
): Promise<WorkforceTimeClockPolicy> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tid)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  const metadata = mergeWorkforceTimeClockPolicyIntoMetadata(
    asMetadataRecord((existing as { metadata?: unknown } | null)?.metadata),
    patch
  );
  await upsertTenantSettingsMetadata(tid, metadata, supabase);
  return parseWorkforceTimeClockPolicy(metadata);
}

export async function setWorkforceTimeClockBreaksEnabled(
  tenantId: string,
  breaksEnabled: boolean,
  client?: SupabaseClient
): Promise<WorkforceTimeClockPolicy> {
  return saveWorkforceTimeClockPolicy(tenantId, { breaksEnabled }, client);
}

export async function assertBreaksEnabledForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const policy = await loadWorkforceTimeClockPolicy(tenantId, client);
  if (!policy.breaksEnabled) {
    throw new Error("Break tracking is disabled for this clinic. Ask HR to enable it in Payroll settings.");
  }
}