import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SystemStatusDbSnapshot } from "./systemStatusTypes";

const TABLES_TO_PROBE = [
  "fi_crm_leads",
  "fi_crm_tasks",
  "fi_crm_lead_notes",
  "fi_crm_lead_communications",
  "fi_bookings",
  "fi_reminder_templates",
  "fi_reminder_jobs",
  "fi_persons",
  "fi_patients",
  "fi_patient_clinical_details",
  "fi_patient_images",
  "fi_cases",
  "fi_users",
  "fi_crm_activity_events",
] as const;

function isMissingRelationError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    (m.includes("relation") && m.includes("not exist"))
  );
}

async function probeTable(supabase: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  if (isMissingRelationError(error.message)) return false;
  // Permissions or transient errors: treat as present to avoid false "missing".
  return true;
}

async function countEq(supabase: SupabaseClient, table: string, tenantId: string): Promise<number | null> {
  const { error, count } = await supabase
    .from(table)
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId);
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countConvertedLeads(supabase: SupabaseClient, tenantId: string): Promise<number | null> {
  const { error, count } = await supabase
    .from("fi_crm_leads")
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId)
    .not("converted_at", "is", null);
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countLeadsColumnSet(supabase: SupabaseClient, tenantId: string, column: string): Promise<number | null> {
  const { error, count } = await supabase
    .from("fi_crm_leads")
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId)
    .not(column, "is", null);
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countBookingsByStatuses(
  supabase: SupabaseClient,
  tenantId: string,
  statuses: string[]
): Promise<number | null> {
  const { error, count } = await supabase
    .from("fi_bookings")
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId)
    .in("booking_status", statuses);
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countFutureBookings(supabase: SupabaseClient, tenantId: string, nowIso: string): Promise<number | null> {
  const { error, count } = await supabase
    .from("fi_bookings")
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId)
    .gt("start_at", nowIso)
    .neq("booking_status", "completed")
    .neq("booking_status", "cancelled")
    .neq("booking_status", "no_show");
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countCasesByStatuses(
  supabase: SupabaseClient,
  tenantId: string,
  statuses: string[]
): Promise<number | null> {
  const { error, count } = await supabase
    .from("fi_cases")
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId)
    .in("status", statuses);
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countActivitySince(
  supabase: SupabaseClient,
  tenantId: string,
  sinceIso: string
): Promise<number | null> {
  const { error, count } = await supabase
    .from("fi_crm_activity_events")
    .select("*", { head: true, count: "exact" })
    .eq("tenant_id", tenantId)
    .gte("occurred_at", sinceIso);
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countFiUsers(supabase: SupabaseClient, tenantId: string, withAuth: boolean): Promise<number | null> {
  let q = supabase.from("fi_users").select("*", { head: true, count: "exact" }).eq("tenant_id", tenantId);
  if (withAuth) {
    q = q.not("auth_user_id", "is", null);
  }
  const { error, count } = await q;
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

async function countPatientImages(
  supabase: SupabaseClient,
  tenantId: string,
  status?: "active" | "archived"
): Promise<number | null> {
  let q = supabase.from("fi_patient_images").select("*", { head: true, count: "exact" }).eq("tenant_id", tenantId);
  if (status) {
    q = q.eq("image_status", status);
  }
  const { error, count } = await q;
  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  return count ?? 0;
}

function emptySnapshot(tenantId: string, partial?: { supabaseConfigured?: boolean }): SystemStatusDbSnapshot {
  const z = null;
  return {
    tenantId,
    generatedAtIso: new Date().toISOString(),
    tablePresence: Object.fromEntries(TABLES_TO_PROBE.map((t) => [t, false])) as Record<string, boolean>,
    counts: {
      crmLeads: z,
      crmTasks: z,
      crmLeadNotes: z,
      crmLeadCommunications: z,
      convertedLeads: z,
      leadsWithPersonId: z,
      leadsWithPatientId: z,
      leadsWithCaseId: z,
      bookingsTotal: z,
      bookingsFuture: z,
      bookingsCompleted: z,
      bookingsCancelled: z,
      persons: z,
      patients: z,
      casesActive: z,
      casesCompleted: z,
      activityToday: z,
      activityLast7d: z,
      fiUsersTotal: z,
      fiUsersActive: z,
      patientImagesTotal: z,
      patientImagesActive: z,
      patientImagesArchived: z,
    },
    supabaseConfigured: partial?.supabaseConfigured ?? false,
    calendarLoadersAvailable: false,
    migrationLatestFilename: null,
    migrationMetadataAvailable: false,
  };
}

/**
 * Tenant-scoped Supabase reads (service role) for the system status dashboard.
 */
export async function runSystemStatusDbQueries(tenantId: string): Promise<SystemStatusDbSnapshot> {
  const tid = tenantId.trim();
  if (!tid) return emptySnapshot("");

  let supabase: SupabaseClient;
  try {
    supabase = supabaseAdmin();
  } catch {
    return emptySnapshot(tid, { supabaseConfigured: false });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const nextUtc = new Date(startUtc);
  nextUtc.setUTCDate(nextUtc.getUTCDate() + 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const presenceEntries = await Promise.all(
    TABLES_TO_PROBE.map(async (t) => [t, await probeTable(supabase, t)] as const)
  );
  const tablePresence = Object.fromEntries(presenceEntries) as Record<string, boolean>;

  const leadsTable = tablePresence.fi_crm_leads;
  const bookingsTable = tablePresence.fi_bookings;
  const activityTable = tablePresence.fi_crm_activity_events;

  const [
    crmLeads,
    crmTasks,
    crmLeadNotes,
    crmLeadCommunications,
    convertedLeads,
    leadsWithPersonId,
    leadsWithPatientId,
    leadsWithCaseId,
    bookingsTotal,
    bookingsFuture,
    bookingsCompleted,
    bookingsCancelled,
    persons,
    patients,
    casesActive,
    casesCompleted,
    activityLast7d,
    fiUsersTotal,
    fiUsersActive,
    patientImagesTotal,
    patientImagesActive,
    patientImagesArchived,
  ] = await Promise.all([
    leadsTable ? countEq(supabase, "fi_crm_leads", tid) : Promise.resolve(null),
    tablePresence.fi_crm_tasks ? countEq(supabase, "fi_crm_tasks", tid) : Promise.resolve(null),
    tablePresence.fi_crm_lead_notes ? countEq(supabase, "fi_crm_lead_notes", tid) : Promise.resolve(null),
    tablePresence.fi_crm_lead_communications ? countEq(supabase, "fi_crm_lead_communications", tid) : Promise.resolve(null),
    leadsTable ? countConvertedLeads(supabase, tid) : Promise.resolve(null),
    leadsTable ? countLeadsColumnSet(supabase, tid, "person_id") : Promise.resolve(null),
    leadsTable ? countLeadsColumnSet(supabase, tid, "patient_id") : Promise.resolve(null),
    leadsTable ? countLeadsColumnSet(supabase, tid, "case_id") : Promise.resolve(null),
    bookingsTable ? countEq(supabase, "fi_bookings", tid) : Promise.resolve(null),
    bookingsTable ? countFutureBookings(supabase, tid, nowIso) : Promise.resolve(null),
    bookingsTable ? countBookingsByStatuses(supabase, tid, ["completed"]) : Promise.resolve(null),
    bookingsTable ? countBookingsByStatuses(supabase, tid, ["cancelled"]) : Promise.resolve(null),
    tablePresence.fi_persons ? countEq(supabase, "fi_persons", tid) : Promise.resolve(null),
    tablePresence.fi_patients ? countEq(supabase, "fi_patients", tid) : Promise.resolve(null),
    tablePresence.fi_cases ? countCasesByStatuses(supabase, tid, ["draft", "submitted", "processing"]) : Promise.resolve(null),
    tablePresence.fi_cases ? countCasesByStatuses(supabase, tid, ["complete"]) : Promise.resolve(null),
    activityTable ? countActivitySince(supabase, tid, sevenDaysAgo.toISOString()) : Promise.resolve(null),
    tablePresence.fi_users ? countFiUsers(supabase, tid, false) : Promise.resolve(null),
    tablePresence.fi_users ? countFiUsers(supabase, tid, true) : Promise.resolve(null),
    tablePresence.fi_patient_images ? countPatientImages(supabase, tid) : Promise.resolve(null),
    tablePresence.fi_patient_images ? countPatientImages(supabase, tid, "active") : Promise.resolve(null),
    tablePresence.fi_patient_images ? countPatientImages(supabase, tid, "archived") : Promise.resolve(null),
  ]);

  let activityTodayFinal: number | null = null;
  if (activityTable) {
    const { count, error } = await supabase
      .from("fi_crm_activity_events")
      .select("*", { head: true, count: "exact" })
      .eq("tenant_id", tid)
      .gte("occurred_at", startUtc.toISOString())
      .lt("occurred_at", nextUtc.toISOString());
    if (!error && count !== null) activityTodayFinal = count;
  }

  return {
    tenantId: tid,
    generatedAtIso: now.toISOString(),
    tablePresence,
    counts: {
      crmLeads,
      crmTasks,
      crmLeadNotes,
      crmLeadCommunications,
      convertedLeads,
      leadsWithPersonId,
      leadsWithPatientId,
      leadsWithCaseId,
      bookingsTotal,
      bookingsFuture,
      bookingsCompleted,
      bookingsCancelled,
      persons,
      patients,
      casesActive,
      casesCompleted,
      activityToday: activityTodayFinal,
      activityLast7d,
      fiUsersTotal,
      fiUsersActive,
      patientImagesTotal,
      patientImagesActive,
      patientImagesArchived,
    },
    supabaseConfigured: true,
    calendarLoadersAvailable: false,
    migrationLatestFilename: null,
    migrationMetadataAvailable: false,
  };
}
