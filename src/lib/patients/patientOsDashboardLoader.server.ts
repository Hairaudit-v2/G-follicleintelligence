import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { loadPatientDirectorySummary, type PatientDirectorySummary } from "@/src/lib/patients/patientDirectoryLoader";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import { dashboardTodayYmd } from "@/src/lib/cases/surgeryOsDashboardDerive";

const TERMINAL_BOOKING = new Set(["cancelled", "completed", "no_show"]);
const MS_DAY = 86_400_000;

function personMetaContact(meta: Record<string, unknown>): { email: string | null; phone: string | null } {
  const email =
    typeof meta.email === "string"
      ? meta.email.trim() || null
      : typeof meta.email_normalized === "string"
        ? meta.email_normalized.trim() || null
        : null;
  const phone = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  return { email, phone };
}

async function loadPersonDisplayByPatientIds(
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, { displayName: string; email: string | null; phone: string | null }>> {
  const out = new Map<string, { displayName: string; email: string | null; phone: string | null }>();
  const tid = tenantId.trim();
  const ids = patientIds.filter(Boolean);
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data: pats, error: pe } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tid)
    .in("id", ids);
  if (pe) throw new Error(pe.message);

  const personIds = Array.from(new Set((pats ?? []).map((r) => String((r as { person_id: string }).person_id))));
  if (!personIds.length) return out;

  const { data: persons, error: e2 } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .in("id", personIds);
  if (e2) throw new Error(e2.message);

  const personMeta = new Map<string, Record<string, unknown>>();
  for (const row of persons ?? []) {
    const id = String((row as { id: string }).id);
    const m = (row as { metadata: unknown }).metadata;
    personMeta.set(id, m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});
  }

  for (const pr of pats ?? []) {
    const pid = String((pr as { id: string }).id);
    const poid = String((pr as { person_id: string }).person_id);
    const meta = personMeta.get(poid) ?? {};
    const { email, phone } = personMetaContact(meta);
    out.set(pid, {
      displayName: personMetadataDisplayLabel(meta),
      email,
      phone,
    });
  }
  return out;
}

export type PatientOsOverviewKpis = {
  totalPatients: number;
  recentlyAddedPatients: number;
  patientsWithActiveCases: number;
  patientsWithUpcomingBookings: number;
  patientsNeedingFollowUp: number;
};

export type PatientOsRecentPatientRow = {
  patientId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  lastActivityAt: string;
};

export type PatientOsJourneyRow = {
  patientId: string;
  caseId: string;
  displayName: string;
  caseStatus: string;
  caseStatusLabel: string;
  updatedAt: string;
};

export type PatientOsUpcomingBookingRow = {
  bookingId: string;
  patientId: string;
  startAt: string;
  title: string | null;
  bookingStatus: string;
  displayName: string;
};

export type PatientOsTimelineHighlight = {
  id: string;
  patientId: string | null;
  patientDisplayName: string | null;
  caseId: string;
  occurredAt: string;
  eventKind: string;
  title: string | null;
};

export type PatientOsOverviewModel = {
  kpis: PatientOsOverviewKpis;
  recentPatients: PatientOsRecentPatientRow[];
  activeJourneys: PatientOsJourneyRow[];
  upcomingBookings: PatientOsUpcomingBookingRow[];
  timelineHighlights: PatientOsTimelineHighlight[];
};

/** Safe fallback when overview sections cannot load; KPIs align with directory summary when provided. */
export function buildPatientOsOverviewFallback(summary: PatientDirectorySummary): PatientOsOverviewModel {
  return {
    kpis: {
      totalPatients: summary.totalPatients,
      recentlyAddedPatients: 0,
      patientsWithActiveCases: summary.withActiveCase,
      patientsWithUpcomingBookings: summary.withFutureBooking,
      patientsNeedingFollowUp: 0,
    },
    recentPatients: [],
    activeJourneys: [],
    upcomingBookings: [],
    timelineHighlights: [],
  };
}

async function countRecentlyCreatedPatients(tenantId: string, sinceIso: string): Promise<number> {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_patients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .gte("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

async function countPatientsNeedingFollowUp(tenantId: string, todayYmd: string): Promise<number> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const { data: fuRows, error } = await supabase
    .from("fi_case_follow_ups")
    .select("case_id, scheduled_date, follow_up_status")
    .eq("tenant_id", tid)
    .not("scheduled_date", "is", null);

  if (error) {
    if (isSupabaseMissingRelationError(error)) return 0;
    throw new Error(error.message);
  }

  const dueCaseIds = new Set<string>();
  for (const raw of fuRows ?? []) {
    const r = raw as { case_id: string; scheduled_date: string | null; follow_up_status: string };
    const st = String(r.follow_up_status ?? "").toLowerCase();
    if (st === "completed" || st === "skipped" || st === "cancelled") continue;
    const sd = r.scheduled_date?.trim().slice(0, 10);
    if (sd && sd <= todayYmd) dueCaseIds.add(String(r.case_id));
  }

  if (dueCaseIds.size === 0) return 0;

  const caseIds = Array.from(dueCaseIds);
  const { data: caseRows, error: ce } = await supabase
    .from("fi_cases")
    .select("foundation_patient_id")
    .eq("tenant_id", tid)
    .in("id", caseIds)
    .is("deleted_at", null)
    .not("foundation_patient_id", "is", null);

  if (ce) {
    if (isSupabaseMissingRelationError(ce)) return 0;
    throw new Error(ce.message);
  }

  const patients = new Set<string>();
  for (const row of caseRows ?? []) {
    const pid = (row as { foundation_patient_id: string | null }).foundation_patient_id;
    if (pid) patients.add(String(pid));
  }
  return patients.size;
}

async function loadRecentPatients(tenantId: string, limit: number): Promise<PatientOsRecentPatientRow[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data: pats, error } = await supabase
    .from("fi_patients")
    .select("id, created_at, updated_at")
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const ids = (pats ?? []).map((r) => String((r as { id: string }).id));
  const display = await loadPersonDisplayByPatientIds(tid, ids);

  return (pats ?? []).map((raw) => {
    const r = raw as { id: string; created_at: string; updated_at: string };
    const pid = String(r.id);
    const d = display.get(pid);
    const created = Date.parse(r.created_at);
    const updated = Date.parse(r.updated_at);
    const last = Math.max(created, updated);
    return {
      patientId: pid,
      displayName: d?.displayName ?? "—",
      email: d?.email ?? null,
      phone: d?.phone ?? null,
      lastActivityAt: new Date(last).toISOString(),
    };
  });
}

async function loadActiveJourneys(tenantId: string, limit: number): Promise<PatientOsJourneyRow[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data: cases, error } = await supabase
    .from("fi_cases")
    .select("id, status, updated_at, foundation_patient_id")
    .eq("tenant_id", tid)
    .not("foundation_patient_id", "is", null)
    .not("status", "eq", "complete")
    .not("status", "eq", "failed")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);

  const rows = (cases ?? []) as { id: string; status: string; updated_at: string; foundation_patient_id: string }[];
  const patientIds = Array.from(new Set(rows.map((c) => String(c.foundation_patient_id))));
  const display = await loadPersonDisplayByPatientIds(tid, patientIds);

  const out: PatientOsJourneyRow[] = [];
  const seenPatient = new Set<string>();
  for (const c of rows) {
    const pid = String(c.foundation_patient_id);
    if (seenPatient.has(pid)) continue;
    seenPatient.add(pid);
    const d = display.get(pid);
    out.push({
      patientId: pid,
      caseId: String(c.id),
      displayName: d?.displayName ?? "—",
      caseStatus: String(c.status),
      caseStatusLabel: fiCaseStatusLabel(c.status),
      updatedAt: String(c.updated_at),
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function loadUpcomingBookings(tenantId: string, limit: number, nowIso: string): Promise<PatientOsUpcomingBookingRow[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data: books, error } = await supabase
    .from("fi_bookings")
    .select("id, patient_id, start_at, title, booking_status")
    .eq("tenant_id", tid)
    .not("patient_id", "is", null)
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true })
    .limit(limit * 2);
  if (error) throw new Error(error.message);

  const filtered = (books ?? []).filter((raw) => {
    const st = String((raw as { booking_status: string }).booking_status ?? "").toLowerCase();
    return !TERMINAL_BOOKING.has(st);
  });

  const slice = filtered.slice(0, limit) as {
    id: string;
    patient_id: string;
    start_at: string;
    title: string | null;
    booking_status: string;
  }[];

  const pids = Array.from(new Set(slice.map((b) => String(b.patient_id))));
  const display = await loadPersonDisplayByPatientIds(tid, pids);

  return slice.map((b) => ({
    bookingId: String(b.id),
    patientId: String(b.patient_id),
    startAt: String(b.start_at),
    title: b.title,
    bookingStatus: String(b.booking_status),
    displayName: display.get(String(b.patient_id))?.displayName ?? "—",
  }));
}

async function loadTimelineHighlights(tenantId: string, limit: number): Promise<PatientOsTimelineHighlight[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data, error } = await supabase
    .from("fi_timeline_events")
    .select("id, patient_id, case_id, event_kind, title, occurred_at")
    .eq("tenant_id", tid)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }

  const base = (data ?? []).map((raw) => {
    const r = raw as {
      id: string;
      patient_id: string | null;
      case_id: string;
      event_kind: string;
      title: string | null;
      occurred_at: string;
    };
    return {
      id: String(r.id),
      patientId: r.patient_id ? String(r.patient_id) : null,
      patientDisplayName: null as string | null,
      caseId: String(r.case_id),
      occurredAt: String(r.occurred_at),
      eventKind: String(r.event_kind ?? ""),
      title: r.title,
    };
  });

  const pids = Array.from(new Set(base.map((h) => h.patientId).filter((x): x is string => Boolean(x))));
  if (pids.length) {
    const names = await loadPersonDisplayByPatientIds(tid, pids);
    for (const h of base) {
      if (h.patientId) h.patientDisplayName = names.get(h.patientId)?.displayName ?? null;
    }
  }

  return base;
}

export type LoadPatientOsOverviewOptions = {
  /** When set, skips an extra directory summary query (reuse from `loadPatientDirectoryPage`). */
  summary?: PatientDirectorySummary;
};

/**
 * Read-only PatientOS dashboard aggregates (tenant-scoped). Safe to call from RSC / loaders.
 * Does not call `loadPatientTimelineSources` or other per-patient full timeline loaders.
 */
export async function loadPatientOsOverview(
  tenantId: string,
  opts?: LoadPatientOsOverviewOptions
): Promise<PatientOsOverviewModel> {
  const tid = tenantId.trim();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayYmd = dashboardTodayYmd(now);
  const thirtyAgo = new Date(now.getTime() - 30 * MS_DAY).toISOString();
  // SA-2 field-level redaction (follow-up): for any patient rows surfaced in the overview that
  // carry identity / contact / financial_summary, redact with `redactPatientForStaffAccess`
  // from `@/src/lib/staffAccess/staffFieldAccess.server` for the current viewer before render.
  // Apply at the render boundary so masked/summary placeholders don't reach typed consumers.
  // Field access is clamped to PatientOS module access by the engine.

  const summaryPromise = opts?.summary ? Promise.resolve(opts.summary) : loadPatientDirectorySummary(tid);

  const [summary, recentCount, followUpPatients, recentPatients, activeJourneys, upcomingBookings, timelineHighlights] =
    await Promise.all([
      summaryPromise,
      countRecentlyCreatedPatients(tid, thirtyAgo),
      countPatientsNeedingFollowUp(tid, todayYmd),
      loadRecentPatients(tid, 8),
      loadActiveJourneys(tid, 10),
      loadUpcomingBookings(tid, 10, nowIso),
      loadTimelineHighlights(tid, 12),
    ]);

  return {
    kpis: {
      totalPatients: summary.totalPatients,
      recentlyAddedPatients: recentCount,
      patientsWithActiveCases: summary.withActiveCase,
      patientsWithUpcomingBookings: summary.withFutureBooking,
      patientsNeedingFollowUp: followUpPatients,
    },
    recentPatients,
    activeJourneys,
    upcomingBookings,
    timelineHighlights,
  };
}
