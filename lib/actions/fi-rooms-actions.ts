"use server";

import { z, ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { canManageFiServicesCatalog } from "@/src/lib/services/fiServicesManageAccess.server";
import {
  insertClinicRoom,
  loadClinicRoomsForTenant,
  loadServiceEligibilityMapsForTenant,
  loadServiceRoomEligibilityForService,
  loadServiceStaffEligibilityForService,
  updateClinicRoom,
} from "@/src/lib/rooms/fiClinicRooms.server";
import { loadClinicRoomsForPicker } from "@/src/lib/rooms/roomAvailability.server";
import {
  CLINIC_ROOM_TYPES,
  type ClinicRoomType,
  type RoomPickerOption,
} from "@/src/lib/rooms/roomTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const UUID = z.string().uuid();

export async function loadRoomsCatalogAction(tenantId: string): Promise<
  | {
      ok: true;
      rooms: Awaited<ReturnType<typeof loadClinicRoomsForTenant>>;
      canManage: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const tid = tenantId.trim();
    const [rooms, canManage] = await Promise.all([
      loadClinicRoomsForTenant(tid),
      canManageFiServicesCatalog({ tenantId: tid, request: null }),
    ]);
    return { ok: true, rooms, canManage };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const roomUpsertSchema = z
  .object({
    adminKey: z.string().optional(),
    clinicId: UUID,
    roomCode: z.string().min(1).max(64),
    displayName: z.string().min(1).max(200),
    physicalRoomKey: z.string().min(1).max(128),
    roomType: z.enum([...CLINIC_ROOM_TYPES] as [ClinicRoomType, ...ClinicRoomType[]]),
    capabilities: z.array(z.string().max(64)).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export async function createClinicRoomAction(
  tenantId: string,
  body: unknown
): Promise<
  { ok: true; room: Awaited<ReturnType<typeof insertClinicRoom>> } | { ok: false; error: string }
> {
  try {
    const parsed = roomUpsertSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const room = await insertClinicRoom(tenantId, {
      clinicId: parsed.clinicId,
      roomCode: parsed.roomCode,
      displayName: parsed.displayName,
      physicalRoomKey: parsed.physicalRoomKey,
      roomType: parsed.roomType,
      capabilities: parsed.capabilities,
      isActive: parsed.isActive,
      sortOrder: parsed.sortOrder,
    });
    return { ok: true, room };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateClinicRoomAction(
  tenantId: string,
  roomId: string,
  body: unknown
): Promise<
  { ok: true; room: Awaited<ReturnType<typeof updateClinicRoom>> } | { ok: false; error: string }
> {
  try {
    const parsed = roomUpsertSchema
      .partial({ clinicId: true })
      .extend({ adminKey: z.string().optional() })
      .parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const room = await updateClinicRoom(tenantId, roomId, {
      roomCode: parsed.roomCode,
      displayName: parsed.displayName,
      physicalRoomKey: parsed.physicalRoomKey,
      roomType: parsed.roomType,
      capabilities: parsed.capabilities,
      isActive: parsed.isActive,
      sortOrder: parsed.sortOrder,
    });
    return { ok: true, room };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadRoomPickerOptionsAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; options: RoomPickerOption[] } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        clinicId: UUID,
        serviceId: z.union([UUID, z.null()]).optional(),
        bookingType: z.string().max(64).optional().nullable(),
        startAt: z.string().min(1),
        endAt: z.string().min(1),
        bookingId: z.union([UUID, z.null()]).optional(),
      })
      .strict()
      .parse(body);
    const options = await loadClinicRoomsForPicker({
      tenantId,
      clinicId: parsed.clinicId,
      serviceId: parsed.serviceId ?? null,
      bookingType: parsed.bookingType ?? null,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      bookingId: parsed.bookingId ?? null,
    });
    return { ok: true, options };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadServiceEligibilityAction(
  tenantId: string,
  serviceId: string
): Promise<
  | {
      ok: true;
      roomEligibility: Awaited<ReturnType<typeof loadServiceRoomEligibilityForService>>;
      staffEligibility: Awaited<ReturnType<typeof loadServiceStaffEligibilityForService>>;
    }
  | { ok: false; error: string }
> {
  try {
    const tid = tenantId.trim();
    const sid = serviceId.trim();
    const [roomEligibility, staffEligibility] = await Promise.all([
      loadServiceRoomEligibilityForService(tid, sid),
      loadServiceStaffEligibilityForService(tid, sid),
    ]);
    return { ok: true, roomEligibility, staffEligibility };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function saveServiceRoomEligibilityAction(
  tenantId: string,
  serviceId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        adminKey: z.string().optional(),
        rows: z.array(
          z
            .object({
              roomId: UUID,
              clinicId: z.union([UUID, z.null()]).optional(),
              isPreferred: z.boolean().optional(),
              isActive: z.boolean().optional(),
            })
            .strict()
        ),
      })
      .strict()
      .parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const sid = serviceId.trim();
    const supabase = supabaseAdmin();
    const now = new Date().toISOString();

    for (const row of parsed.rows) {
      const { error } = await supabase.from("fi_service_room_eligibility").upsert(
        {
          tenant_id: tid,
          service_id: sid,
          room_id: row.roomId,
          clinic_id: row.clinicId ?? null,
          is_preferred: row.isPreferred ?? false,
          is_active: row.isActive ?? true,
          updated_at: now,
        },
        { onConflict: "tenant_id,service_id,room_id" }
      );
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function saveServiceStaffEligibilityAction(
  tenantId: string,
  serviceId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        adminKey: z.string().optional(),
        rows: z.array(
          z
            .object({
              staffId: z.union([UUID, z.null()]).optional(),
              staffRole: z.string().max(64).nullable().optional(),
              isRequired: z.boolean().optional(),
              isActive: z.boolean().optional(),
            })
            .strict()
        ),
      })
      .strict()
      .parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const sid = serviceId.trim();
    const supabase = supabaseAdmin();
    const now = new Date().toISOString();

    await supabase
      .from("fi_service_staff_eligibility")
      .delete()
      .eq("tenant_id", tid)
      .eq("service_id", sid);

    if (parsed.rows.length > 0) {
      const { error } = await supabase.from("fi_service_staff_eligibility").insert(
        parsed.rows.map((row) => ({
          tenant_id: tid,
          service_id: sid,
          staff_id: row.staffId ?? null,
          staff_role: row.staffRole?.trim() || null,
          is_required: row.isRequired ?? false,
          is_active: row.isActive ?? true,
          metadata: {},
          created_at: now,
          updated_at: now,
        }))
      );
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadAllServiceEligibilityMapsAction(tenantId: string) {
  try {
    const maps = await loadServiceEligibilityMapsForTenant(tenantId.trim());
    return { ok: true as const, ...maps };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
