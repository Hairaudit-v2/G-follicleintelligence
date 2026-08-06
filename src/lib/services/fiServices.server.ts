import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { parseServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupDefaults";

const SERVICE_SELECT_WITH_SETUP =
  "id, tenant_id, name, duration_minutes, base_price, color, category, is_active, booking_type, setup_config, created_at, updated_at";

const SERVICE_SELECT_LEGACY =
  "id, tenant_id, name, duration_minutes, base_price, color, category, is_active, booking_type, created_at, updated_at";

function isMissingSetupConfigColumn(errorMessage: string | undefined): boolean {
  const m = String(errorMessage ?? "").toLowerCase();
  return (
    m.includes("setup_config") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find"))
  );
}

function mapRow(raw: Record<string, unknown>): FiServiceRow {
  const bp = raw.base_price;
  const price = typeof bp === "number" ? bp : Number(bp);
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    name: String(raw.name ?? "").trim(),
    duration_minutes: Number(raw.duration_minutes ?? 0),
    base_price: Number.isFinite(price) ? price : 0,
    color: raw.color != null ? String(raw.color).trim() : null,
    category: raw.category != null ? String(raw.category).trim() : null,
    is_active: Boolean(raw.is_active),
    booking_type: raw.booking_type != null ? String(raw.booking_type).trim() : null,
    setup_config: parseServiceSetupConfig(raw.setup_config),
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

export async function loadFiServicesForTenant(tenantId: string): Promise<FiServiceRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const primary = await supabase
    .from("fi_services")
    .select(SERVICE_SELECT_WITH_SETUP)
    .eq("tenant_id", tid)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (!primary.error) {
    return (primary.data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  if (!isMissingSetupConfigColumn(primary.error.message)) {
    throw new Error(primary.error.message);
  }

  // Deployed before migration: keep catalog surfaces up with empty setup_config.
  const fallback = await supabase
    .from("fi_services")
    .select(SERVICE_SELECT_LEGACY)
    .eq("tenant_id", tid)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function insertFiService(
  tenantId: string,
  input: {
    name: string;
    duration_minutes: number;
    base_price: number;
    color?: string | null;
    category?: string | null;
    is_active: boolean;
    booking_type?: string | null;
    setup_config?: Record<string, unknown> | null;
  }
): Promise<FiServiceRow> {
  const tid = tenantId.trim();
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const payload: Record<string, unknown> = {
    tenant_id: tid,
    name: input.name.trim(),
    duration_minutes: input.duration_minutes,
    base_price: input.base_price,
    color: input.color?.trim() || null,
    category: input.category?.trim() || null,
    is_active: input.is_active,
    booking_type: input.booking_type?.trim() || null,
    created_at: now,
    updated_at: now,
  };
  if (input.setup_config) {
    payload.setup_config = parseServiceSetupConfig(input.setup_config);
  }

  const primary = await supabase
    .from("fi_services")
    .insert(payload)
    .select(SERVICE_SELECT_WITH_SETUP)
    .single();

  if (!primary.error) {
    return mapRow(primary.data as Record<string, unknown>);
  }

  if (!isMissingSetupConfigColumn(primary.error.message)) {
    throw new Error(primary.error.message);
  }

  delete payload.setup_config;
  const fallback = await supabase
    .from("fi_services")
    .insert(payload)
    .select(SERVICE_SELECT_LEGACY)
    .single();
  if (fallback.error) throw new Error(fallback.error.message);
  return mapRow(fallback.data as Record<string, unknown>);
}

export async function updateFiService(
  tenantId: string,
  serviceId: string,
  patch: Partial<{
    name: string;
    duration_minutes: number;
    base_price: number;
    color: string | null;
    category: string | null;
    is_active: boolean;
    booking_type: string | null;
    setup_config: Record<string, unknown> | null;
  }>
): Promise<FiServiceRow> {
  const tid = tenantId.trim();
  const sid = serviceId.trim();
  const now = new Date().toISOString();
  const body: Record<string, unknown> = { updated_at: now };
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.duration_minutes !== undefined) body.duration_minutes = patch.duration_minutes;
  if (patch.base_price !== undefined) body.base_price = patch.base_price;
  if (patch.color !== undefined) body.color = patch.color?.trim() || null;
  if (patch.category !== undefined) body.category = patch.category?.trim() || null;
  if (patch.is_active !== undefined) body.is_active = patch.is_active;
  if (patch.booking_type !== undefined) body.booking_type = patch.booking_type?.trim() || null;
  if (patch.setup_config !== undefined) {
    body.setup_config = patch.setup_config
      ? parseServiceSetupConfig(patch.setup_config)
      : {};
  }

  const supabase = supabaseAdmin();
  const primary = await supabase
    .from("fi_services")
    .update(body)
    .eq("tenant_id", tid)
    .eq("id", sid)
    .select(SERVICE_SELECT_WITH_SETUP)
    .single();

  if (!primary.error) {
    return mapRow(primary.data as Record<string, unknown>);
  }

  if (!isMissingSetupConfigColumn(primary.error.message)) {
    throw new Error(primary.error.message);
  }

  delete body.setup_config;
  const fallback = await supabase
    .from("fi_services")
    .update(body)
    .eq("tenant_id", tid)
    .eq("id", sid)
    .select(SERVICE_SELECT_LEGACY)
    .single();
  if (fallback.error) throw new Error(fallback.error.message);
  return mapRow(fallback.data as Record<string, unknown>);
}
