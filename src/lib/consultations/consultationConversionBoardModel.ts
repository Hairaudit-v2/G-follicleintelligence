/**
 * Pure model for Consultation Conversion Board V1 — column assignment, window helpers, KPIs.
 */

import { addDaysToCalendarDate, calendarDateStringFromInstant, zonedMidnightUtcMs } from "@/src/lib/calendar/calendarTimezone";

export const CONVERSION_BOARD_LOOKBACK_DAYS = 90;
export const CONVERSION_BOARD_FORWARD_DAYS = 30;

export type ConsultationConversionBoardColumnId =
  | "consultation_booked"
  | "consultation_completed"
  | "quote_drafted"
  | "quote_sent"
  | "quote_accepted"
  | "surgery_booked"
  | "lost";

export type ConsultationConversionBoardWindow = {
  calendarTimezone: string;
  todayYmd: string;
  ymdPast90: string;
  ymdFuture30: string;
  rangeStartIso: string;
  rangeEndIso: string;
};

export type NormalizedQuoteStatus = "draft" | "sent" | "accepted" | "neutral";

/** Maps free-text `quote_data.quote_status` + consultation row status to a coarse lane. */
export function normalizeQuoteStatusFromSignals(input: {
  consultationStatus: string;
  quoteStatusRaw: string | null | undefined;
}): NormalizedQuoteStatus {
  const st = input.consultationStatus.trim().toLowerCase();
  if (st === "accepted" || st === "converted_to_case") return "accepted";

  const raw = typeof input.quoteStatusRaw === "string" ? input.quoteStatusRaw.trim().toLowerCase() : "";
  if (!raw) {
    if (st === "quoted") return "sent";
    return "neutral";
  }

  if (raw === "quote_accepted" || raw.includes("accept")) return "accepted";
  if (raw === "quote_sent" || raw.includes("sent")) return "sent";
  if (raw.includes("draft") || raw.includes("pending") || raw === "quote_draft") return "draft";

  return "neutral";
}

export function hasQuoteDraftSignals(quoteData: Record<string, unknown>): boolean {
  const keys: (keyof typeof quoteData)[] = ["graft_estimate", "session_size", "price_quoted", "other_services"];
  for (const k of keys) {
    const v = quoteData[k];
    if (typeof v === "string" && v.trim().length > 0) return true;
    if (typeof v === "number" && Number.isFinite(v)) return true;
  }
  return false;
}

export function isCrmLostSignal(input: { stageIsLost: boolean; leadStatusLost: boolean }): boolean {
  return input.stageIsLost || input.leadStatusLost;
}

export function isConsultationArchivedSignal(archivedAt: string | null | undefined): boolean {
  return Boolean(archivedAt?.trim());
}

export function hasSurgeryBookedSignal(input: {
  caseId: string | null | undefined;
  hasLinkedSurgeryBooking: boolean;
  consultationStatus: string;
}): boolean {
  const st = input.consultationStatus.trim().toLowerCase();
  if (st === "converted_to_case") return true;
  if (input.caseId?.trim()) return true;
  return input.hasLinkedSurgeryBooking;
}

/**
 * Single primary column per card. Precedence: lost → surgery → quote accepted → sent → draft → completed → booked.
 */
export function pickConsultationConversionColumn(input: {
  crmLost: boolean;
  consultationArchived: boolean;
  surgeryBooked: boolean;
  quoteNormalized: NormalizedQuoteStatus;
  /** True when quote JSON has draftable content but {@link quoteNormalized} is still neutral. */
  quoteDraftContent: boolean;
  consultationStatus: string;
  /** Booking-only row: no fi_consultations yet */
  isBookingOnly: boolean;
  /** Consultation calendar booking completed (or past start) */
  bookingCompletedOrPast: boolean;
}): ConsultationConversionBoardColumnId {
  if (input.crmLost || input.consultationArchived) return "lost";
  if (input.surgeryBooked) return "surgery_booked";

  const q = input.quoteNormalized;
  if (q === "accepted") return "quote_accepted";
  if (q === "sent") return "quote_sent";
  if (q === "draft" || input.quoteDraftContent) return "quote_drafted";

  const st = input.consultationStatus.trim().toLowerCase();
  if (input.isBookingOnly) {
    return input.bookingCompletedOrPast ? "consultation_completed" : "consultation_booked";
  }

  if (st === "completed" || st === "quoted") {
    if (st === "quoted") return "quote_sent";
    return "consultation_completed";
  }

  if (st === "draft" || st === "in_progress") return "consultation_booked";

  return "consultation_booked";
}

export function computeConsultationConversionBoardWindow(now: Date, calendarTimezone: string): ConsultationConversionBoardWindow {
  const tz = calendarTimezone.trim();
  const todayYmd = calendarDateStringFromInstant(now, tz);
  const ymdPast90 = addDaysToCalendarDate(todayYmd, -CONVERSION_BOARD_LOOKBACK_DAYS, tz);
  const ymdFuture30 = addDaysToCalendarDate(todayYmd, CONVERSION_BOARD_FORWARD_DAYS, tz);
  const dayAfterFuture = addDaysToCalendarDate(ymdFuture30, 1, tz);
  const startMs = zonedMidnightUtcMs(ymdPast90, tz);
  const endMs = zonedMidnightUtcMs(dayAfterFuture, tz);
  const rangeStartIso = (startMs != null ? new Date(startMs) : now).toISOString();
  const rangeEndIso = (endMs != null ? new Date(endMs) : new Date(now.getTime() + (CONVERSION_BOARD_FORWARD_DAYS + 1) * 86_400_000)).toISOString();
  return { calendarTimezone: tz, todayYmd, ymdPast90, ymdFuture30, rangeStartIso, rangeEndIso };
}

/** Inclusive YYYY-MM-DD string compare (valid for ISO dates). */
export function calendarYmdInInclusiveRange(ymd: string | null | undefined, minYmd: string, maxYmd: string): boolean {
  const y = ymd?.trim();
  if (!y) return false;
  return y >= minYmd && y <= maxYmd;
}

export function calendarYmdFromIsoInstant(iso: string | null | undefined, tz: string): string | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return calendarDateStringFromInstant(new Date(ms), tz);
}

export function daysSinceCalendarYmd(fromYmd: string | null, todayYmd: string): number | null {
  if (!fromYmd?.trim()) return null;
  const a = Date.parse(`${fromYmd.trim()}T12:00:00.000Z`);
  const b = Date.parse(`${todayYmd.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86_400_000);
}

export type ConsultationConversionKpis = {
  consultationsBookedNext30Days: number;
  consultationsCompletedLast30Days: number;
  quotesSent: number;
  quotesAccepted: number;
  surgeryBookedFromConsults: number;
  /** Ratio 0–1 when denominator is meaningful; otherwise null. */
  conversionRateQuoteToSurgery: number | null;
  conversionRateLabel: string;
};

export function aggregateConsultationConversionKpis(input: {
  calendarTimezone: string;
  /** Consultation-type bookings with start local day in (today, today+30] */
  consultationBookingStartsNext30: string[];
  todayYmd: string;
  /** Consultation rows: status completed + consultation_date in [today-30, today] */
  completedConsultationDatesLast30: { consultationDateYmd: string | null; status: string }[];
  columnCounts: Record<ConsultationConversionBoardColumnId, number>;
}): ConsultationConversionKpis {
  const tz = input.calendarTimezone.trim();
  const today = input.todayYmd;
  const end30 = addDaysToCalendarDate(today, 30, tz);
  const startPast30 = addDaysToCalendarDate(today, -30, tz);

  let consultationsBookedNext30Days = 0;
  for (const ymd of input.consultationBookingStartsNext30) {
    if (ymd > today && ymd <= end30) consultationsBookedNext30Days += 1;
  }

  let consultationsCompletedLast30Days = 0;
  for (const row of input.completedConsultationDatesLast30) {
    if (row.status.trim().toLowerCase() !== "completed") continue;
    const d = row.consultationDateYmd?.trim();
    if (d && d >= startPast30 && d <= today) consultationsCompletedLast30Days += 1;
  }

  const quotesSent = input.columnCounts.quote_sent;
  const quotesAccepted = input.columnCounts.quote_accepted;
  const surgeryBookedFromConsults = input.columnCounts.surgery_booked;

  const denom = quotesSent + quotesAccepted + surgeryBookedFromConsults;
  let conversionRateQuoteToSurgery: number | null = null;
  let conversionRateLabel = "Quote → surgery (snapshot)";
  if (denom > 0) {
    conversionRateQuoteToSurgery = surgeryBookedFromConsults / denom;
    conversionRateLabel = "Surgery booked ÷ (quotes sent + accepted + surgery on board)";
  } else if (consultationsCompletedLast30Days > 0 && surgeryBookedFromConsults > 0) {
    conversionRateQuoteToSurgery = surgeryBookedFromConsults / consultationsCompletedLast30Days;
    conversionRateLabel = "Surgery booked ÷ consultations completed (last 30d) — approximate";
  } else {
    conversionRateLabel = "Not enough quote/surgery signals for a reliable rate";
  }

  return {
    consultationsBookedNext30Days,
    consultationsCompletedLast30Days,
    quotesSent,
    quotesAccepted,
    surgeryBookedFromConsults,
    conversionRateQuoteToSurgery,
    conversionRateLabel,
  };
}

export function nextRecommendedAction(column: ConsultationConversionBoardColumnId): string {
  switch (column) {
    case "lost":
      return "Close the record or archive consultation notes.";
    case "surgery_booked":
      return "Confirm SurgeryOS readiness and pre-op tasks.";
    case "quote_accepted":
      return "Create or link the case and schedule surgery.";
    case "quote_sent":
      return "Follow up on the quote and capture acceptance.";
    case "quote_drafted":
      return "Finalize pricing and send the quote.";
    case "consultation_completed":
      return "Draft and send the treatment quote.";
    case "consultation_booked":
      return "Complete the consultation workspace and mark completed.";
    default:
      return "Review consultation status and CRM stage.";
  }
}
