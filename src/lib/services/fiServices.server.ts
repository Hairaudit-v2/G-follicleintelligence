import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

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
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

export async function loadFiServicesForTenant(tenantId: string): Promise<FiServiceRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_services")
    .select(
      "id, tenant_id, name, duration_minutes, base_price, color, category, is_active, booking_type, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
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
  }
): Promise<FiServiceRow> {
  const tid = tenantId.trim();
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_services")
    .insert({
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
    })
    .select(
      "id, tenant_id, name, duration_minutes, base_price, color, category, is_active, booking_type, created_at, updated_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
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

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_services")
    .update(body)
    .eq("tenant_id", tid)
    .eq("id", sid)
    .select(
      "id, tenant_id, name, duration_minutes, base_price, color, category, is_active, booking_type, created_at, updated_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
