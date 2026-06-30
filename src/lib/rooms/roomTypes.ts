export const CLINIC_ROOM_TYPES = [
  "consult",
  "prp",
  "surgery",
  "patient",
  "multi_use",
  "other",
] as const;

export type ClinicRoomType = (typeof CLINIC_ROOM_TYPES)[number];

export type FiClinicRoomRow = {
  id: string;
  tenant_id: string;
  clinic_id: string;
  room_code: string;
  display_name: string;
  physical_room_key: string;
  room_type: ClinicRoomType;
  capabilities: string[];
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type FiServiceRoomEligibilityRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  service_id: string;
  room_id: string;
  is_preferred: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

export type FiServiceStaffEligibilityRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  staff_id: string | null;
  staff_role: string | null;
  is_required: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

export type RoomPickerOption = {
  room: FiClinicRoomRow;
  eligible: boolean;
  available: boolean;
  preferred: boolean;
  disabledReason: string | null;
};

export type RoomOverlapBookingLike = {
  id: string;
  room_id: string | null;
  start_at: string;
  end_at: string;
  booking_status: string;
  cancelled_at?: string | null;
};

export type RoomOverlapContext = {
  roomsById: Map<string, FiClinicRoomRow>;
  /** physical_room_key → room ids sharing that physical space */
  roomIdsByPhysicalKey: Map<string, string[]>;
};
