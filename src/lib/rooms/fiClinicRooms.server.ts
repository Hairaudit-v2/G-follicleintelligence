import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import type {
  FiClinicRoomRow,
  FiServiceRoomEligibilityRow,
  FiServiceStaffEligibilityRow,
} from "./roomTypes";

function mapRoomRow(raw: Record<string, unknown>): FiClinicRoomRow {
  const caps = raw.capabilities;
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: String(raw.clinic_id),
    room_code: String(raw.room_code ?? "").trim(),
    display_name: String(raw.display_name ?? "").trim(),
    physical_room_key: String(raw.physical_room_key ?? "").trim(),
    room_type: String(raw.room_type ?? "other") as FiClinicRoomRow["room_type"],
    capabilities: Array.isArray(caps) ? caps.map((c) => String(c)) : [],
    is_active: Boolean(raw.is_active),
    sort_order: Number(raw.sort_order ?? 0),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

function mapServiceRoomEligibilityRow(raw: Record<string, unknown>): FiServiceRoomEligibilityRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    service_id: String(raw.service_id),
    room_id: String(raw.room_id),
    is_preferred: Boolean(raw.is_preferred),
    is_active: Boolean(raw.is_active),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
  };
}

function mapServiceStaffEligibilityRow(raw: Record<string, unknown>): FiServiceStaffEligibilityRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    service_id: String(raw.service_id),
    staff_id: raw.staff_id != null ? String(raw.staff_id) : null,
    staff_role: raw.staff_role != null ? String(raw.staff_role).trim() : null,
    is_required: Boolean(raw.is_required),
    is_active: Boolean(raw.is_active),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
  };
}

export async function loadClinicRoomsForTenant(
  tenantId: string,
  opts?: { clinicId?: string | null; activeOnly?: boolean },
  client?: SupabaseClient
): Promise<FiClinicRoomRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  let q = supabase
    .from("fi_clinic_rooms")
    .select("*")
    .eq("tenant_id", tid)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (opts?.clinicId?.trim()) q = q.eq("clinic_id", opts.clinicId.trim());
  if (opts?.activeOnly) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRoomRow(r as Record<string, unknown>));
}

export async function loadClinicRoomForTenant(
  tenantId: string,
  roomId: string,
  client?: SupabaseClient
): Promise<FiClinicRoomRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const rid = assertNonEmptyUuid(roomId, "roomId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinic_rooms")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", rid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRoomRow(data as Record<string, unknown>);
}

export async function insertClinicRoom(
  tenantId: string,
  input: {
    clinicId: string;
    roomCode: string;
    displayName: string;
    physicalRoomKey: string;
    roomType: FiClinicRoomRow["room_type"];
    capabilities?: string[];
    isActive?: boolean;
    sortOrder?: number;
    metadata?: Record<string, unknown>;
  },
  client?: SupabaseClient
): Promise<FiClinicRoomRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const now = new Date().toISOString();
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinic_rooms")
    .insert({
      tenant_id: tid,
      clinic_id: input.clinicId.trim(),
      room_code: input.roomCode.trim(),
      display_name: input.displayName.trim(),
      physical_room_key: input.physicalRoomKey.trim(),
      room_type: input.roomType,
      capabilities: input.capabilities ?? [],
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRoomRow(data as Record<string, unknown>);
}

export async function updateClinicRoom(
  tenantId: string,
  roomId: string,
  patch: Partial<{
    roomCode: string;
    displayName: string;
    physicalRoomKey: string;
    roomType: FiClinicRoomRow["room_type"];
    capabilities: string[];
    isActive: boolean;
    sortOrder: number;
    metadata: Record<string, unknown>;
  }>,
  client?: SupabaseClient
): Promise<FiClinicRoomRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const rid = assertNonEmptyUuid(roomId, "roomId");
  const supabase = client ?? supabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.roomCode !== undefined) row.room_code = patch.roomCode.trim();
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.physicalRoomKey !== undefined) row.physical_room_key = patch.physicalRoomKey.trim();
  if (patch.roomType !== undefined) row.room_type = patch.roomType;
  if (patch.capabilities !== undefined) row.capabilities = patch.capabilities;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.metadata !== undefined) row.metadata = patch.metadata;

  const { data, error } = await supabase
    .from("fi_clinic_rooms")
    .update(row)
    .eq("tenant_id", tid)
    .eq("id", rid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRoomRow(data as Record<string, unknown>);
}

export async function loadServiceRoomEligibilityForService(
  tenantId: string,
  serviceId: string,
  client?: SupabaseClient
): Promise<FiServiceRoomEligibilityRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(serviceId, "serviceId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_service_room_eligibility")
    .select("*")
    .eq("tenant_id", tid)
    .eq("service_id", sid)
    .order("is_preferred", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapServiceRoomEligibilityRow(r as Record<string, unknown>));
}

export async function loadServiceStaffEligibilityForService(
  tenantId: string,
  serviceId: string,
  client?: SupabaseClient
): Promise<FiServiceStaffEligibilityRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(serviceId, "serviceId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_service_staff_eligibility")
    .select("*")
    .eq("tenant_id", tid)
    .eq("service_id", sid);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapServiceStaffEligibilityRow(r as Record<string, unknown>));
}

export async function loadServiceEligibilityMapsForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<{
  roomByServiceId: Map<string, FiServiceRoomEligibilityRow[]>;
  staffByServiceId: Map<string, FiServiceStaffEligibilityRow[]>;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const [roomRes, staffRes] = await Promise.all([
    supabase.from("fi_service_room_eligibility").select("*").eq("tenant_id", tid),
    supabase.from("fi_service_staff_eligibility").select("*").eq("tenant_id", tid),
  ]);
  if (roomRes.error) throw new Error(roomRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);

  const roomByServiceId = new Map<string, FiServiceRoomEligibilityRow[]>();
  for (const raw of roomRes.data ?? []) {
    const row = mapServiceRoomEligibilityRow(raw as Record<string, unknown>);
    const list = roomByServiceId.get(row.service_id) ?? [];
    list.push(row);
    roomByServiceId.set(row.service_id, list);
  }

  const staffByServiceId = new Map<string, FiServiceStaffEligibilityRow[]>();
  for (const raw of staffRes.data ?? []) {
    const row = mapServiceStaffEligibilityRow(raw as Record<string, unknown>);
    const list = staffByServiceId.get(row.service_id) ?? [];
    list.push(row);
    staffByServiceId.set(row.service_id, list);
  }

  return { roomByServiceId, staffByServiceId };
}

export async function resolveServiceIdForBookingType(
  tenantId: string,
  bookingType: string,
  client?: SupabaseClient
): Promise<string | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bt = bookingType.trim();
  if (!bt) return null;
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_services")
    .select("id")
    .eq("tenant_id", tid)
    .eq("booking_type", bt)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id != null ? String(data.id) : null;
}

export { mapRoomRow, mapServiceRoomEligibilityRow, mapServiceStaffEligibilityRow };
