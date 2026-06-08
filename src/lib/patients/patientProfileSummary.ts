export type BookingLike = {
  id: string;
  start_at: string;
  booking_status: string;
  title: string | null;
};

export type ActivityLike = {
  id: string;
  occurred_at: string;
  activity_kind: string;
  title: string | null;
  lead_id?: string | null;
  case_id?: string | null;
  leadTitle?: string | null;
  linkedToThisPatient?: boolean;
};

export type PatientProfileSummaryMetrics = {
  totalLeads: number;
  totalCases: number;
  upcomingBookings: number;
  completedBookings: number;
  lastActivityAt: string | null;
};

const ACTIVE_CASE_STATUSES = new Set(["draft", "submitted", "processing"]);

const TERMINAL_BOOKING = new Set(["cancelled", "completed", "no_show"]);

export function countLinkedLeadsForPatient(leads: readonly { patient_id: string | null }[], patientId: string): number {
  const pid = patientId.trim();
  return leads.filter((l) => l.patient_id && String(l.patient_id) === pid).length;
}

export function isActiveCaseStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_CASE_STATUSES.has(String(status).trim().toLowerCase());
}

export function computePatientProfileSummaryMetrics(input: {
  leads: readonly unknown[];
  cases: readonly { status: string }[];
  bookings: readonly { start_at: string; booking_status: string }[];
  activityEvents: readonly { occurred_at: string }[];
  nowIso?: string;
}): PatientProfileSummaryMetrics {
  const now = input.nowIso ? Date.parse(input.nowIso) : Date.now();

  const upcomingBookings = input.bookings.filter((b) => {
    const st = String(b.booking_status ?? "").toLowerCase();
    if (TERMINAL_BOOKING.has(st)) return false;
    return Date.parse(String(b.start_at)) >= now;
  }).length;

  const completedBookings = input.bookings.filter((b) => {
    const st = String(b.booking_status ?? "").toLowerCase();
    return st === "completed";
  }).length;

  let lastActivityAt: string | null = null;
  for (const e of input.activityEvents) {
    const t = String((e as { occurred_at: string }).occurred_at);
    if (!lastActivityAt || Date.parse(t) > Date.parse(lastActivityAt)) lastActivityAt = t;
  }

  return {
    totalLeads: input.leads.length,
    totalCases: input.cases.length,
    upcomingBookings,
    completedBookings,
    lastActivityAt,
  };
}

export function splitBookingsUpcomingPast<T extends BookingLike>(
  bookings: readonly T[],
  nowIso?: string
): { upcoming: T[]; past: T[] } {
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const b of bookings) {
    const st = String(b.booking_status ?? "").toLowerCase();
    const start = Date.parse(String(b.start_at));
    const isTerminal = TERMINAL_BOOKING.has(st);
    if (!isTerminal && start >= now) upcoming.push(b);
    else past.push(b);
  }
  upcoming.sort((a, b) => Date.parse(String(a.start_at)) - Date.parse(String(b.start_at)));
  past.sort((a, b) => Date.parse(String(b.start_at)) - Date.parse(String(a.start_at)));
  return { upcoming, past };
}

export function sortActivityEventsNewestFirst<T extends ActivityLike>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => Date.parse(String(b.occurred_at)) - Date.parse(String(a.occurred_at)));
}
