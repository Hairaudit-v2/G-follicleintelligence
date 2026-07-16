/**
 * Smart Scheduling Assistant — server evaluation (tenant-scoped).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { previewBookingConflicts } from "@/src/lib/calendar/bookingConflictPreview.server";
import { findNextAvailableBookingSlots } from "@/src/lib/calendar/findNextAvailableBookingSlots.server";
import { loadOverlappingBookingsForRange } from "@/src/lib/rooms/roomAvailability.server";
import {
  buildPrepReminders,
  buildSmartSchedulingSnapshot,
  detectSchedulingConflicts,
  mapLegacyConflictKind,
  prepBufferMinutesForBookingType,
  rankSuggestedSlots,
  warmMessageFromLegacy,
} from "./smartSchedulingCore";
import type { SmartSchedulingSnapshot } from "./smartSchedulingTypes";

export type EvaluateSmartSchedulingInput = {
  tenantId: string;
  clinicId?: string | null;
  bookingType?: string | null;
  roomId?: string | null;
  roomRequired?: boolean;
  staffId?: string | null;
  staffLabel?: string | null;
  roomLabel?: string | null;
  patientId?: string | null;
  bookingId?: string | null;
  startAt: string;
  endAt: string;
  /** Include next-slot suggestions when blocked/warning. */
  includeSuggestions?: boolean;
  client?: SupabaseClient;
};

export async function evaluateSmartScheduling(
  input: EvaluateSmartSchedulingInput
): Promise<SmartSchedulingSnapshot> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const startAt = input.startAt;
  const endAt = input.endAt;
  const buffer = prepBufferMinutesForBookingType(input.bookingType);

  // 1) Live room/staff preview (authoritative resource rules)
  let previewMessages: { type: string; severity: string; message: string }[] = [];
  try {
    const preview = await previewBookingConflicts({
      tenantId: tid,
      clinicId: input.clinicId ?? null,
      bookingType: input.bookingType ?? null,
      roomId: input.roomId ?? null,
      roomRequired: input.roomRequired,
      staffId: input.staffId ?? null,
      bookingId: input.bookingId ?? null,
      startAt,
      endAt,
      previewIntent: input.bookingId ? "edit" : "quick_create",
      client: supabase,
    });
    previewMessages = preview.messages.map((m) => ({
      type: m.type,
      severity: m.severity,
      message: m.message,
    }));
  } catch {
    previewMessages = [];
  }

  // 2) Overlap window bookings for pure detectSchedulingConflicts
  let existing: Awaited<ReturnType<typeof loadOverlappingBookingsForRange>> = [];
  try {
    const startMs = Date.parse(startAt) - buffer * 60_000;
    const endMs = Date.parse(endAt) + buffer * 60_000;
    const rangeStart = new Date(
      Number.isFinite(startMs) ? startMs : Date.parse(startAt)
    ).toISOString();
    const rangeEnd = new Date(Number.isFinite(endMs) ? endMs : Date.parse(endAt)).toISOString();
    existing = await loadOverlappingBookingsForRange(tid, rangeStart, rangeEnd, supabase);
  } catch {
    existing = [];
  }

  const pure = detectSchedulingConflicts({
    candidate: {
      id: input.bookingId,
      startAt,
      endAt,
      assignedStaffId: input.staffId,
      roomId: input.roomId,
      patientId: input.patientId,
      bookingType: input.bookingType,
      roomRequired: input.roomRequired,
    },
    existing: existing.map((b) => ({
      id: b.id,
      start_at: b.start_at,
      end_at: b.end_at,
      assigned_staff_id: b.assigned_staff_id,
      assigned_user_id: b.assigned_user_id,
      room_id: b.room_id,
      patient_id: b.patient_id,
      booking_type: b.booking_type,
      booking_status: b.booking_status,
      title: b.title,
      cancelled_at: b.cancelled_at,
    })),
    staffLabel: input.staffLabel,
    roomLabel: input.roomLabel,
    bufferMinutes: 10,
  });

  // Merge preview messages not already covered
  const merged = [...pure.conflicts];
  for (const m of previewMessages) {
    const kind = mapLegacyConflictKind(m.type);
    const msg = warmMessageFromLegacy(m.type, m.message);
    if (merged.some((c) => c.message === msg)) continue;
    merged.push({
      kind,
      severity: m.severity === "error" ? "error" : m.severity === "warning" ? "warning" : "info",
      message: msg,
      conflictingBookingId: null,
      conflictingLabel: null,
    });
  }

  const status = merged.some((c) => c.severity === "error")
    ? "blocked"
    : merged.some((c) => c.severity === "warning")
      ? "warning"
      : "clear";

  const prepReminders = buildPrepReminders({
    bookingType: input.bookingType,
    hasPatient: Boolean(input.patientId),
    flags: {},
  });

  let suggestions: ReturnType<typeof rankSuggestedSlots> = [];
  if (input.includeSuggestions !== false && input.clinicId && (status !== "clear" || true)) {
    try {
      const durationMinutes = Math.max(
        5,
        Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000) || 30
      );
      const found = await findNextAvailableBookingSlots({
        tenantId: tid,
        clinicId: input.clinicId.trim(),
        bookingType: input.bookingType,
        staffId: input.staffId,
        roomId: input.roomId,
        bookingId: input.bookingId,
        preferredStartAt: startAt,
        durationMinutes,
        limit: 5,
        client: supabase,
      });
      suggestions = rankSuggestedSlots(
        found.slots.map((s) => ({
          startAt: s.startAt,
          endAt: s.endAt,
          roomId: s.roomId,
          roomLabel: s.roomLabel,
          staffId: s.staffId,
          staffLabel: s.staffLabel,
          reason: s.reason,
        })),
        { preferStaffId: input.staffId, preferRoomId: input.roomId, max: 5 }
      );
    } catch {
      suggestions = [];
    }
  }

  return buildSmartSchedulingSnapshot({
    conflicts: { status, conflicts: merged },
    prepReminders,
    suggestions: status === "clear" ? suggestions.slice(0, 2) : suggestions,
    bookingType: input.bookingType,
  });
}
