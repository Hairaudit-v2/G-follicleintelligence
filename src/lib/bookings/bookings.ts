import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { mapFiCrmLeadRow } from "@/src/lib/crm/leadRow";
import {
  bookingDetailSnapshotFromRowLike,
  collectChangedBookingDetailKeys,
} from "./bookingChangedFields";
import {
  assertAllowedBookingStatus,
  assertAllowedBookingType,
  assertAtLeastOneBookingAnchor,
  assertBookingTypeAllowedForLeadConversion,
  assertEndAfterStart,
  assertMetadataJsonObject,
  assertNonCancelledBookingMutable,
} from "./bookingPolicy";
import { sortBookingsByStartAt } from "./bookingTime";
import { DEFAULT_OPERATOR_BOOKINGS_LIMIT, MAX_OPERATOR_BOOKINGS_LIMIT } from "./operatorBookingConstants";
import type { FiBookingRow } from "./types";

export { DEFAULT_OPERATOR_BOOKINGS_LIMIT, MAX_OPERATOR_BOOKINGS_LIMIT } from "./operatorBookingConstants";

function mapBookingRow(row: Record<string, unknown>): FiBookingRow {
  const meta = row.metadata;
  assertMetadataJsonObject(meta);
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    assigned_user_id: row.assigned_user_id != null ? String(row.assigned_user_id) : null,
    booking_type: String(row.booking_type),
    booking_status: String(row.booking_status),
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    start_at: String(row.start_at),
    end_at: String(row.end_at),
    timezone: row.timezone != null ? String(row.timezone) : null,
    location: row.location != null ? String(row.location) : null,
    metadata: meta,
    cancelled_at: row.cancelled_at != null ? String(row.cancelled_at) : null,
    cancelled_by_user_id: row.cancelled_by_user_id != null ? String(row.cancelled_by_user_id) : null,
    cancellation_reason: row.cancellation_reason != null ? String(row.cancellation_reason) : null,
    created_by_user_id: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function assertFiUserBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<void> {
  const uid = fiUserId.trim();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("assignedUserId must belong to the tenant.");
}

async function assertClinicBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  clinicId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", clinicId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("clinicId must belong to the tenant.");
}

async function assertPersonBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", personId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("personId must belong to the tenant.");
}

async function assertPatientBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", patientId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("patientId must belong to the tenant.");
}

async function assertCaseBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", caseId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("caseId must belong to the tenant.");
}

async function loadLeadForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string
): Promise<FiCrmLeadRow | null> {
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", leadId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapFiCrmLeadRow(data as Record<string, unknown>);
}

function leadConverted(lead: FiCrmLeadRow): boolean {
  return Boolean(lead.converted_at?.trim());
}

export type BookingAnchorInput = {
  leadId?: string | null;
  personId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
};

async function assertAnchorsTenantConsistent(
  supabase: SupabaseClient,
  tenantId: string,
  anchors: BookingAnchorInput,
  lead: FiCrmLeadRow | null
): Promise<void> {
  const tid = tenantId.trim();
  if (anchors.leadId?.trim()) {
    if (!lead) throw new Error("Lead not found for tenant.");
  }

  if (anchors.personId?.trim()) {
    await assertPersonBelongsToTenant(supabase, tid, anchors.personId);
    if (lead && anchors.personId.trim() !== lead.person_id) {
      throw new Error("personId does not match the linked lead.");
    }
  }

  if (anchors.patientId?.trim()) {
    await assertPatientBelongsToTenant(supabase, tid, anchors.patientId);
    if (lead) {
      const want = lead.patient_id?.trim() || null;
      const got = anchors.patientId.trim();
      if (want == null) {
        throw new Error("patientId is not set on this lead.");
      }
      if (want !== got) throw new Error("patientId does not match the linked lead.");
    }
  }

  if (anchors.caseId?.trim()) {
    await assertCaseBelongsToTenant(supabase, tid, anchors.caseId);
    if (lead) {
      const want = lead.case_id?.trim() || null;
      const got = anchors.caseId.trim();
      if (want == null) throw new Error("caseId is not set on this lead.");
      if (want !== got) throw new Error("caseId does not match the linked lead.");
    }
  }

  if (lead && !leadConverted(lead)) {
    if (anchors.patientId?.trim() || anchors.caseId?.trim()) {
      throw new Error("patientId and caseId must be omitted before the lead is converted.");
    }
    if (anchors.personId?.trim() && anchors.personId.trim() !== lead.person_id) {
      throw new Error("personId must match the lead's person or be omitted.");
    }
  }
}

function activityIdsDetail(row: FiBookingRow): Record<string, unknown> {
  const d: Record<string, unknown> = { booking_id: row.id };
  if (row.lead_id) d.lead_id = row.lead_id;
  if (row.person_id) d.person_id = row.person_id;
  if (row.patient_id) d.patient_id = row.patient_id;
  if (row.case_id) d.case_id = row.case_id;
  return d;
}

export async function loadBookingsForTenantRange(
  tenantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  assertEndAfterStart(rangeStartIso, rangeEndIso);

  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .lt("start_at", rangeEndIso.trim())
    .gt("end_at", rangeStartIso.trim())
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  return sortBookingsByStartAt(((data ?? []) as Record<string, unknown>[]).map(mapBookingRow));
}

export type LoadBookingsForOperatorViewParams = {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  status?: string | null;
  bookingType?: string | null;
  assignedUserId?: string | null;
  clinicId?: string | null;
  /** When false, rows with `booking_status = cancelled` are omitted. */
  includeCancelled?: boolean;
  limit?: number;
};

/**
 * Tenant-scoped bookings overlapping `[rangeStartIso, rangeEndIso)`, optional filters,
 * ascending `start_at`, with a hard cap to avoid loading unbounded rows (Stage 3B).
 */
export async function loadBookingsForOperatorView(
  params: LoadBookingsForOperatorViewParams,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  assertEndAfterStart(params.rangeStartIso, params.rangeEndIso);
  const cap = params.limit ?? DEFAULT_OPERATOR_BOOKINGS_LIMIT;
  const limit = Math.min(Math.max(cap, 1), MAX_OPERATOR_BOOKINGS_LIMIT);

  let q = supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .lt("start_at", params.rangeEndIso.trim())
    .gt("end_at", params.rangeStartIso.trim());

  if (params.status?.trim()) {
    q = q.eq("booking_status", params.status.trim());
  }
  if (params.bookingType?.trim()) {
    q = q.eq("booking_type", params.bookingType.trim());
  }
  if (params.assignedUserId?.trim()) {
    q = q.eq("assigned_user_id", params.assignedUserId.trim());
  }
  if (params.clinicId?.trim()) {
    q = q.eq("clinic_id", params.clinicId.trim());
  }
  if (!params.includeCancelled) {
    q = q.neq("booking_status", "cancelled");
  }

  const { data, error } = await q.order("start_at", { ascending: true }).limit(limit);

  if (error) throw new Error(error.message);
  return sortBookingsByStartAt(((data ?? []) as Record<string, unknown>[]).map(mapBookingRow));
}

export async function loadBookingsForLead(
  tenantId: string,
  leadId: string,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");

  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  return sortBookingsByStartAt(((data ?? []) as Record<string, unknown>[]).map(mapBookingRow));
}

export async function loadBookingsForPerson(
  tenantId: string,
  personId: string,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const pid = assertNonEmptyUuid(personId, "personId");

  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("person_id", pid)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  return sortBookingsByStartAt(((data ?? []) as Record<string, unknown>[]).map(mapBookingRow));
}

export async function loadBookingsForPatient(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const pid = assertNonEmptyUuid(patientId, "patientId");

  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  return sortBookingsByStartAt(((data ?? []) as Record<string, unknown>[]).map(mapBookingRow));
}

export async function loadBookingsForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<FiBookingRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);
  return sortBookingsByStartAt(((data ?? []) as Record<string, unknown>[]).map(mapBookingRow));
}

export async function loadBookingForTenant(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<FiBookingRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(bookingId, "bookingId");

  const { data, error } = await supabase
    .from("fi_bookings")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", bid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapBookingRow(data as Record<string, unknown>);
}

export type CreateBookingParams = BookingAnchorInput & {
  tenantId: string;
  bookingType: string;
  title?: string | null;
  description?: string | null;
  startAt: string;
  endAt: string;
  timezone?: string | null;
  location?: string | null;
  metadata?: Record<string, unknown> | null;
  clinicId?: string | null;
  assignedUserId?: string | null;
  /** Server-resolved fi_users.id; never from client JSON. */
  createdByUserId?: string | null;
};

export async function createBooking(params: CreateBookingParams, client?: SupabaseClient): Promise<FiBookingRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");

  assertAtLeastOneBookingAnchor({
    lead_id: params.leadId,
    person_id: params.personId,
    patient_id: params.patientId,
    case_id: params.caseId,
  });
  assertAllowedBookingType(params.bookingType);
  assertEndAfterStart(params.startAt, params.endAt);
  const metadata = params.metadata ?? {};
  assertMetadataJsonObject(metadata);

  const lead = params.leadId?.trim() ? await loadLeadForTenant(supabase, tid, params.leadId) : null;
  if (params.leadId?.trim() && !lead) throw new Error("Lead not found for tenant.");

  assertBookingTypeAllowedForLeadConversion({
    bookingType: params.bookingType,
    leadId: params.leadId,
    leadConverted: lead ? leadConverted(lead) : false,
  });

  await assertAnchorsTenantConsistent(
    supabase,
    tid,
    {
      leadId: params.leadId,
      personId: params.personId,
      patientId: params.patientId,
      caseId: params.caseId,
    },
    lead
  );

  if (params.clinicId?.trim()) await assertClinicBelongsToTenant(supabase, tid, params.clinicId);
  if (params.assignedUserId?.trim()) await assertFiUserBelongsToTenant(supabase, tid, params.assignedUserId);

  const insertRow = {
    tenant_id: tid,
    lead_id: params.leadId?.trim() || null,
    person_id: params.personId?.trim() || null,
    patient_id: params.patientId?.trim() || null,
    case_id: params.caseId?.trim() || null,
    clinic_id: params.clinicId?.trim() || null,
    assigned_user_id: params.assignedUserId?.trim() || null,
    booking_type: params.bookingType.trim(),
    booking_status: "scheduled",
    title: params.title?.trim() || null,
    description: params.description?.trim() || null,
    start_at: params.startAt.trim(),
    end_at: params.endAt.trim(),
    timezone: params.timezone?.trim() || null,
    location: params.location?.trim() || null,
    metadata,
    created_by_user_id: params.createdByUserId?.trim() || null,
  };

  const { data, error } = await supabase.from("fi_bookings").insert(insertRow).select("*").single();
  if (error) throw new Error(error.message);
  const row = mapBookingRow(data as Record<string, unknown>);

  if (row.lead_id) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: row.lead_id,
        activityKind: "booking.created",
        title: "Booking created",
        detail: activityIdsDetail(row),
        patientId: row.patient_id,
        caseId: row.case_id,
      },
      supabase
    );
  }

  return row;
}

export type UpdateBookingParams = BookingAnchorInput & {
  tenantId: string;
  bookingId: string;
  bookingType?: string | null;
  bookingStatus?: string | null;
  title?: string | null;
  description?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string | null;
  location?: string | null;
  metadata?: Record<string, unknown> | null;
  clinicId?: string | null;
  assignedUserId?: string | null;
};

export async function updateBooking(params: UpdateBookingParams, client?: SupabaseClient): Promise<FiBookingRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const bid = assertNonEmptyUuid(params.bookingId, "bookingId");

  const existing = await loadBookingForTenant(tid, bid, supabase);
  if (!existing) throw new Error("Booking not found.");
  assertNonCancelledBookingMutable(existing);

  const beforeSnap = bookingDetailSnapshotFromRowLike(existing);

  const next: FiBookingRow = {
    ...existing,
    lead_id: params.leadId !== undefined ? (params.leadId?.trim() || null) : existing.lead_id,
    person_id: params.personId !== undefined ? (params.personId?.trim() || null) : existing.person_id,
    patient_id: params.patientId !== undefined ? (params.patientId?.trim() || null) : existing.patient_id,
    case_id: params.caseId !== undefined ? (params.caseId?.trim() || null) : existing.case_id,
    booking_type:
      params.bookingType !== undefined ? (params.bookingType?.trim() || existing.booking_type) : existing.booking_type,
    booking_status:
      params.bookingStatus !== undefined
        ? (params.bookingStatus?.trim() || existing.booking_status)
        : existing.booking_status,
    title: params.title !== undefined ? (params.title?.trim() || null) : existing.title,
    description: params.description !== undefined ? (params.description?.trim() || null) : existing.description,
    start_at: params.startAt !== undefined ? (params.startAt?.trim() || existing.start_at) : existing.start_at,
    end_at: params.endAt !== undefined ? (params.endAt?.trim() || existing.end_at) : existing.end_at,
    timezone: params.timezone !== undefined ? (params.timezone?.trim() || null) : existing.timezone,
    location: params.location !== undefined ? (params.location?.trim() || null) : existing.location,
    metadata: params.metadata !== undefined ? params.metadata ?? {} : existing.metadata,
    clinic_id: params.clinicId !== undefined ? (params.clinicId?.trim() || null) : existing.clinic_id,
    assigned_user_id: params.assignedUserId !== undefined ? (params.assignedUserId?.trim() || null) : existing.assigned_user_id,
  };

  assertMetadataJsonObject(next.metadata);
  assertAtLeastOneBookingAnchor({
    lead_id: next.lead_id,
    person_id: next.person_id,
    patient_id: next.patient_id,
    case_id: next.case_id,
  });
  assertAllowedBookingType(next.booking_type);
  assertAllowedBookingStatus(next.booking_status);
  assertEndAfterStart(next.start_at, next.end_at);

  const lead = next.lead_id ? await loadLeadForTenant(supabase, tid, next.lead_id) : null;
  if (next.lead_id && !lead) throw new Error("Lead not found for tenant.");

  assertBookingTypeAllowedForLeadConversion({
    bookingType: next.booking_type,
    leadId: next.lead_id,
    leadConverted: lead ? leadConverted(lead) : false,
  });

  await assertAnchorsTenantConsistent(
    supabase,
    tid,
    {
      leadId: next.lead_id,
      personId: next.person_id,
      patientId: next.patient_id,
      caseId: next.case_id,
    },
    lead
  );

  if (next.clinic_id?.trim()) await assertClinicBelongsToTenant(supabase, tid, next.clinic_id);
  if (next.assigned_user_id?.trim()) await assertFiUserBelongsToTenant(supabase, tid, next.assigned_user_id);

  const nowIso = new Date().toISOString();
  const afterSnap = bookingDetailSnapshotFromRowLike(next);
  const changedKeys = collectChangedBookingDetailKeys(beforeSnap, afterSnap);

  const { data, error } = await supabase
    .from("fi_bookings")
    .update({
      lead_id: next.lead_id,
      person_id: next.person_id,
      patient_id: next.patient_id,
      case_id: next.case_id,
      clinic_id: next.clinic_id,
      assigned_user_id: next.assigned_user_id,
      booking_type: next.booking_type,
      booking_status: next.booking_status,
      title: next.title,
      description: next.description,
      start_at: next.start_at,
      end_at: next.end_at,
      timezone: next.timezone,
      location: next.location,
      metadata: next.metadata,
      updated_at: nowIso,
    })
    .eq("tenant_id", tid)
    .eq("id", bid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapBookingRow(data as Record<string, unknown>);

  if (updated.lead_id && changedKeys.length > 0) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: updated.lead_id,
        activityKind: "booking.updated",
        title: "Booking updated",
        detail: { ...activityIdsDetail(updated), changed_keys: changedKeys },
        patientId: updated.patient_id,
        caseId: updated.case_id,
      },
      supabase
    );
  }

  return updated;
}

export type CancelBookingParams = {
  tenantId: string;
  bookingId: string;
  cancellationReason?: string | null;
  /** Server-resolved fi_users.id; never from client JSON. */
  cancelledByUserId?: string | null;
};

export async function cancelBooking(params: CancelBookingParams, client?: SupabaseClient): Promise<FiBookingRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const bid = assertNonEmptyUuid(params.bookingId, "bookingId");

  const existing = await loadBookingForTenant(tid, bid, supabase);
  if (!existing) throw new Error("Booking not found.");
  if (existing.booking_status === "cancelled" || existing.cancelled_at) {
    throw new Error("Booking is already cancelled.");
  }
  if (existing.booking_status === "completed") {
    throw new Error("Completed bookings cannot be cancelled.");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_bookings")
    .update({
      booking_status: "cancelled",
      cancelled_at: nowIso,
      cancelled_by_user_id: params.cancelledByUserId?.trim() || null,
      cancellation_reason: params.cancellationReason?.trim() || null,
      updated_at: nowIso,
    })
    .eq("tenant_id", tid)
    .eq("id", bid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = mapBookingRow(data as Record<string, unknown>);

  if (row.lead_id) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: row.lead_id,
        activityKind: "booking.cancelled",
        title: "Booking cancelled",
        detail: activityIdsDetail(row),
        patientId: row.patient_id,
        caseId: row.case_id,
      },
      supabase
    );
  }

  return row;
}

export type CompleteBookingParams = {
  tenantId: string;
  bookingId: string;
};

export async function completeBooking(params: CompleteBookingParams, client?: SupabaseClient): Promise<FiBookingRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const bid = assertNonEmptyUuid(params.bookingId, "bookingId");

  const existing = await loadBookingForTenant(tid, bid, supabase);
  if (!existing) throw new Error("Booking not found.");
  if (existing.booking_status === "cancelled" || existing.cancelled_at) {
    throw new Error("Cancelled bookings cannot be completed.");
  }
  if (existing.booking_status === "completed") {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_bookings")
    .update({
      booking_status: "completed",
      updated_at: nowIso,
    })
    .eq("tenant_id", tid)
    .eq("id", bid)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = mapBookingRow(data as Record<string, unknown>);

  if (row.lead_id) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: row.lead_id,
        activityKind: "booking.completed",
        title: "Booking completed",
        detail: activityIdsDetail(row),
        patientId: row.patient_id,
        caseId: row.case_id,
      },
      supabase
    );
  }

  return row;
}
