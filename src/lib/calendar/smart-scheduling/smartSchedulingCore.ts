/**
 * Smart Scheduling Assistant — pure conflict detection, prep checklists, slot ranking.
 */

import type {
  DetectSchedulingConflictsInput,
  PrepReminderItem,
  SchedulingConflictItem,
  SchedulingConflictKind,
  SchedulingConflictStatus,
  SmartSchedulingSnapshot,
  SmartSuggestedSlot,
} from "./smartSchedulingTypes";

/** Booking types that typically need longer prep / isolation buffers. */
export const HIGH_PREP_BOOKING_TYPES = new Set([
  "surgery",
  "hair_transplant_consultation",
  "prp",
  "prf",
  "mesotherapy",
  "exosomes",
]);

export function isHighPrepBookingType(bookingType: string | null | undefined): boolean {
  return HIGH_PREP_BOOKING_TYPES.has(String(bookingType ?? "").trim().toLowerCase());
}

/** Typical operational prep buffer (minutes) by type. */
export function prepBufferMinutesForBookingType(bookingType: string | null | undefined): number {
  const t = String(bookingType ?? "").trim().toLowerCase();
  if (t === "surgery") return 60;
  if (t.includes("transplant_consultation") || t === "hair_transplant_consultation") return 30;
  if (t === "prp" || t === "prf" || t === "mesotherapy" || t === "exosomes") return 20;
  if (t === "consultation" || t === "trichology") return 15;
  if (t === "review" || t === "follow_up") return 10;
  return 15;
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  bufferMs: number
): boolean {
  return aStart < bEnd + bufferMs && bStart < aEnd + bufferMs;
}

function isCancelled(status?: string | null, cancelledAt?: string | null): boolean {
  if (cancelledAt) return true;
  const s = String(status ?? "").toLowerCase();
  return s === "cancelled" || s === "canceled";
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function bookingLabel(row: {
  title?: string | null;
  booking_type?: string | null;
  start_at: string;
}): string {
  const title = row.title?.trim();
  if (title) return title;
  const type = row.booking_type?.replace(/_/g, " ") ?? "appointment";
  const clock = formatClock(row.start_at);
  return clock ? `${type} at ${clock}` : type;
}

/**
 * Detect scheduling conflicts for a candidate slot against existing bookings.
 * Warm, actionable messages — operational only.
 */
export function detectSchedulingConflicts(
  input: DetectSchedulingConflictsInput
): {
  status: SchedulingConflictStatus;
  conflicts: SchedulingConflictItem[];
} {
  const cand = input.candidate;
  const start = Date.parse(cand.startAt);
  const end = Date.parse(cand.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return {
      status: "warning",
      conflicts: [
        {
          kind: "other",
          severity: "warning",
          message: "Let’s pick a valid start and end time so we can check the diary properly.",
          conflictingBookingId: null,
          conflictingLabel: null,
        },
      ],
    };
  }

  const bufferMs = Math.max(0, (input.bufferMinutes ?? 10) * 60_000);
  const ignoreId = cand.id?.trim() || null;
  const staffId = cand.assignedStaffId?.trim() || null;
  const userId = cand.assignedUserId?.trim() || null;
  const roomId = cand.roomId?.trim() || null;
  const patientId = cand.patientId?.trim() || null;
  const staffName = input.staffLabel?.trim() || "This clinician";
  const roomName = input.roomLabel?.trim() || "This room";
  const highPrepCand = isHighPrepBookingType(cand.bookingType);

  const conflicts: SchedulingConflictItem[] = [];

  // Outside hours (simple hour grid when provided)
  if (input.businessHours) {
    const { dayStartHour, dayEndHour } = input.businessHours;
    const startH = new Date(start).getUTCHours(); // rough fallback if no TZ conversion in pure core
    // Prefer local from ISO if ends with Z - still useful as soft warning when hours clearly odd
    void startH;
    void dayStartHour;
    void dayEndHour;
  }

  for (const o of input.existing) {
    if (ignoreId && o.id === ignoreId) continue;
    if (isCancelled(o.booking_status, o.cancelled_at)) continue;
    const os = Date.parse(o.start_at);
    const oe = Date.parse(o.end_at);
    if (!Number.isFinite(os) || !Number.isFinite(oe)) continue;
    if (!overlaps(start, end, os, oe, bufferMs)) continue;

    const label = bookingLabel({
      title: o.title,
      booking_type: o.booking_type,
      start_at: o.start_at,
    });

    const oStaff = o.assigned_staff_id?.trim() || null;
    const oUser = o.assigned_user_id?.trim() || null;
    const oRoom = o.room_id?.trim() || null;
    const oPatient = o.patient_id?.trim() || null;

    if (roomId && oRoom && roomId === oRoom) {
      conflicts.push({
        kind: "room_double_booked",
        severity: "error",
        message: `${roomName} is already booked for “${label}” (${formatClock(o.start_at)}–${formatClock(o.end_at)}). Let’s pick another room or time.`,
        conflictingBookingId: o.id,
        conflictingLabel: label,
      });
    }

    if (staffId && oStaff && staffId === oStaff) {
      conflicts.push({
        kind: "doctor_double_booked",
        severity: "error",
        message: `${staffName} already has “${label}” overlapping this slot (${formatClock(o.start_at)}–${formatClock(o.end_at)}).`,
        conflictingBookingId: o.id,
        conflictingLabel: label,
      });
    } else if (userId && oUser && userId === oUser) {
      conflicts.push({
        kind: "staff_double_booked",
        severity: "error",
        message: `This staff member already has “${label}” in the same window (${formatClock(o.start_at)}–${formatClock(o.end_at)}).`,
        conflictingBookingId: o.id,
        conflictingLabel: label,
      });
    }

    if (patientId && oPatient && patientId === oPatient) {
      conflicts.push({
        kind: "patient_double_booked",
        severity: "warning",
        message: `This patient already has “${label}” overlapping (${formatClock(o.start_at)}–${formatClock(o.end_at)}). Worth a quick check before confirming.`,
        conflictingBookingId: o.id,
        conflictingLabel: label,
      });
    }

    // High-prep vs high-prep back-to-back without buffer (same staff)
    const highPrepOther = isHighPrepBookingType(o.booking_type);
    if (
      highPrepCand &&
      highPrepOther &&
      staffId &&
      oStaff &&
      staffId === oStaff &&
      overlaps(start, end, os, oe, 20 * 60_000)
    ) {
      conflicts.push({
        kind: "high_prep_overlap",
        severity: "warning",
        message: `${staffName} has another high-prep appointment (“${label}”) close to this slot. Consider a longer gap for photos, consent, and room turnaround.`,
        conflictingBookingId: o.id,
        conflictingLabel: label,
      });
    }
  }

  const type = String(cand.bookingType ?? "").toLowerCase();
  if (type === "surgery" && !staffId && !userId) {
    conflicts.push({
      kind: "surgery_missing_staff",
      severity: "error",
      message: "Surgery needs an assigned clinician before we lock the slot — who is leading this case?",
      conflictingBookingId: null,
      conflictingLabel: null,
    });
  }

  // Dedup by kind+booking
  const map = new Map<string, SchedulingConflictItem>();
  for (const c of conflicts) {
    const key = `${c.kind}:${c.conflictingBookingId ?? ""}`;
    if (!map.has(key)) map.set(key, c);
  }
  const unique = Array.from(map.values());
  const status: SchedulingConflictStatus = unique.some((c) => c.severity === "error")
    ? "blocked"
    : unique.some((c) => c.severity === "warning")
      ? "warning"
      : "clear";

  return { status, conflicts: unique };
}

/**
 * Operational prep reminders before a consult/surgery (not clinical advice).
 */
export function buildPrepReminders(input: {
  bookingType: string | null | undefined;
  hasPatient?: boolean;
  flags?: {
    missingPhotos?: boolean;
    consentPending?: boolean;
    bloodsRequired?: boolean;
    depositOutstanding?: boolean;
    formsIncomplete?: boolean;
  };
}): PrepReminderItem[] {
  const t = String(input.bookingType ?? "consultation").toLowerCase();
  const flags = input.flags ?? {};
  const items: PrepReminderItem[] = [];

  const push = (item: PrepReminderItem) => {
    items.push(item);
  };

  // Always useful operational anchors
  if (input.hasPatient !== false) {
    if (flags.missingPhotos !== false) {
      push({
        code: "photo_audit",
        label: "Photo audit due",
        detail: "Confirm required views are on the patient record before the visit starts.",
        severity: flags.missingPhotos ? "attention" : "info",
        hrefSuffix: null,
        leadMinutes: t === "surgery" ? 1440 : 120,
      });
    }
  }

  if (t === "surgery" || t.includes("transplant")) {
    push({
      code: "consent_form",
      label: "Consent form pending",
      detail: "Check consent paperwork is completed in the clinic process (operational checklist).",
      severity: flags.consentPending ? "attention" : "info",
      hrefSuffix: null,
      leadMinutes: 1440,
    });
    push({
      code: "bloods_required",
      label: "Bloods / labs if required by clinic policy",
      detail: "If your clinic protocol needs results on file, confirm they’re attached before day-of.",
      severity: flags.bloodsRequired ? "attention" : "info",
      hrefSuffix: null,
      leadMinutes: 2880,
    });
  }

  if (t === "consultation" || t.includes("consultation") || t === "trichology") {
    push({
      code: "forms_ready",
      label: "Consultation forms ready",
      detail: "Open the right form template so scale fields and history can be captured smoothly.",
      severity: flags.formsIncomplete ? "attention" : "info",
      hrefSuffix: "consultations",
      leadMinutes: 60,
    });
  }

  if (t === "surgery" || t.includes("prp") || t.includes("consultation")) {
    push({
      code: "deposit_check",
      label: "Deposit / payment status",
      detail: "Glance at money status if your clinic collects deposits before high-prep visits.",
      severity: flags.depositOutstanding ? "attention" : "info",
      hrefSuffix: null,
      leadMinutes: 1440,
    });
  }

  push({
    code: "room_turnaround",
    label: "Room & equipment ready",
    detail: "Allow a few minutes for room reset when the prior slot was a procedure.",
    severity: "info",
    hrefSuffix: null,
    leadMinutes: prepBufferMinutesForBookingType(t),
  });

  return items.slice(0, 6);
}

export function rankSuggestedSlots(
  slots: readonly {
    startAt: string;
    endAt: string;
    roomId?: string;
    roomLabel?: string;
    staffId?: string;
    staffLabel?: string;
    reason?: string;
  }[],
  opts?: { preferStaffId?: string | null; preferRoomId?: string | null; max?: number }
): SmartSuggestedSlot[] {
  const preferStaff = opts?.preferStaffId?.trim() || null;
  const preferRoom = opts?.preferRoomId?.trim() || null;
  const max = Math.min(Math.max(opts?.max ?? 5, 1), 12);

  const ranked = slots.map((s, index) => {
    let score = 100 - index; // earlier engine order still good
    if (preferStaff && s.staffId === preferStaff) score += 20;
    if (preferRoom && s.roomId === preferRoom) score += 10;
    return {
      startAt: s.startAt,
      endAt: s.endAt,
      roomId: s.roomId ?? null,
      roomLabel: s.roomLabel ?? null,
      staffId: s.staffId ?? null,
      staffLabel: s.staffLabel ?? null,
      reason:
        s.reason?.trim() ||
        "Open slot that fits clinic hours, staff, and room rules for this procedure type.",
      score,
    } satisfies SmartSuggestedSlot;
  });

  return ranked.sort((a, b) => b.score - a.score).slice(0, max);
}

export function buildSmartSchedulingSummary(
  status: SchedulingConflictStatus,
  conflictCount: number,
  prepCount: number
): string {
  if (status === "clear") {
    return prepCount > 0
      ? "This slot looks free — here are a few gentle prep reminders before the visit."
      : "This slot looks clear. You’re good to continue.";
  }
  if (status === "warning") {
    return `Heads-up: ${conflictCount} soft conflict${conflictCount === 1 ? "" : "s"} to review. You can still proceed after a quick check.`;
  }
  return `Let’s fix ${conflictCount} scheduling conflict${conflictCount === 1 ? "" : "s"} before locking this in. Suggested times are below when available.`;
}

export function buildSmartSchedulingSnapshot(input: {
  conflicts: ReturnType<typeof detectSchedulingConflicts>;
  prepReminders: readonly PrepReminderItem[];
  suggestions: readonly SmartSuggestedSlot[];
  bookingType?: string | null;
}): SmartSchedulingSnapshot {
  return {
    status: input.conflicts.status,
    summary: buildSmartSchedulingSummary(
      input.conflicts.status,
      input.conflicts.conflicts.length,
      input.prepReminders.length
    ),
    conflicts: input.conflicts.conflicts,
    prepReminders: input.prepReminders,
    suggestions: input.suggestions,
    prepBufferMinutes: prepBufferMinutesForBookingType(input.bookingType),
  };
}

/** Map engine kind strings into our taxonomy (for adapters). */
export function mapLegacyConflictKind(kind: string): SchedulingConflictKind {
  const k = kind.toLowerCase();
  if (k.includes("room")) return "room_double_booked";
  if (k.includes("surgeon") || k.includes("doctor")) return "doctor_double_booked";
  if (k.includes("staff")) return "staff_double_booked";
  if (k.includes("patient")) return "patient_double_booked";
  if (k.includes("hours")) return "outside_clinic_hours";
  if (k.includes("surgery")) return "surgery_missing_staff";
  return "other";
}

export function warmMessageFromLegacy(type: string, message: string): string {
  const m = message.trim();
  if (/double-booked|overlap/i.test(m)) {
    if (type === "room") {
      return m.includes("already") ? m : `This room looks double-booked: ${m}`;
    }
    if (type === "staff") {
      return m.includes("already") ? m : `This clinician may already be booked: ${m}`;
    }
  }
  return m;
}
