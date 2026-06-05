import type {
  ActivityStreamSectionModel,
  BookingsSectionModel,
  CalendarSectionModel,
  CasesSectionModel,
  ConversionSectionModel,
  CrmSectionModel,
  CrmTableCheck,
  DatabaseHealthRow,
  MigrationHealthModel,
  PatientsSectionModel,
  SummaryStripItem,
  SystemReadinessModel,
  SystemStatusDbSnapshot,
  SystemStatusPayload,
  TrafficLight,
  UsersSectionModel,
} from "./systemStatusTypes";

/** Core relational objects required for FI OS CRM + bookings + foundation admin. */
export const SYSTEM_STATUS_CORE_TABLES = [
  "fi_crm_leads",
  "fi_crm_tasks",
  "fi_crm_lead_notes",
  "fi_crm_lead_communications",
  "fi_bookings",
  "fi_persons",
  "fi_patients",
  "fi_patient_clinical_details",
  "fi_patient_images",
  "fi_cases",
  "fi_users",
] as const;

export type ReadinessScoreInput = {
  databaseHealth: readonly DatabaseHealthRow[];
  summaryStrip: readonly Pick<SummaryStripItem, "traffic">[];
  calendarReady: boolean;
};

/**
 * Computes the **System Readiness Score** (0–100) for the FI OS tenant snapshot.
 *
 * **Weights (documented for operators):**
 * - **60% — Database core:** fraction of `SYSTEM_STATUS_CORE_TABLES` that exist in PostgREST (present / |core| × 60).
 * - **25% — Module strip:** average traffic light where green = 1.0, amber = 0.55, red = 0.0, scaled to 25 points.
 * - **15% — Calendar route stack:** full points when the calendar surface is considered configured (Supabase env OK,
 *   `fi_bookings` present, and calendar loaders resolved at build time).
 *
 * The score is clamped and rounded — it is a rollout planning signal, not a clinical or security grade.
 */
export function calculateSystemReadinessScore(input: ReadinessScoreInput): number {
  const totalTables = input.databaseHealth.length;
  const presentTables = input.databaseHealth.filter((r) => r.present).length;
  const dbRatio = totalTables === 0 ? 0 : presentTables / totalTables;
  const dbPart = dbRatio * 60;

  const weight = (t: TrafficLight) => (t === "green" ? 1 : t === "amber" ? 0.55 : 0);
  const strip =
    input.summaryStrip.length === 0
      ? 0
      : (input.summaryStrip.reduce((acc, s) => acc + weight(s.traffic), 0) / input.summaryStrip.length) * 25;

  const calPart = input.calendarReady ? 15 : 0;

  return Math.round(Math.min(100, Math.max(0, dbPart + strip + calPart)));
}

function buildCrmSection(snap: SystemStatusDbSnapshot): CrmSectionModel {
  const names = ["fi_crm_leads", "fi_crm_tasks", "fi_crm_lead_notes", "fi_crm_lead_communications"] as const;
  const tables: CrmTableCheck[] = names.map((name) => ({ name, exists: Boolean(snap.tablePresence[name]) }));
  const leadsOk = tables.find((t) => t.name === "fi_crm_leads")?.exists ?? false;
  const allOk = tables.every((t) => t.exists);

  let overallLabel: CrmSectionModel["overallLabel"] = "Warning";
  let traffic: TrafficLight = "amber";
  if (!leadsOk) {
    overallLabel = "Missing";
    traffic = "red";
  } else if (allOk) {
    overallLabel = "Operational";
    traffic = "green";
  }

  return {
    tables,
    counts: {
      leads: snap.counts.crmLeads,
      tasks: snap.counts.crmTasks,
      notes: snap.counts.crmLeadNotes,
      communications: snap.counts.crmLeadCommunications,
    },
    overallLabel,
    traffic,
  };
}

function buildConversion(snap: SystemStatusDbSnapshot): ConversionSectionModel {
  const readable = Boolean(snap.tablePresence.fi_crm_leads);
  return {
    convertedLeads: snap.counts.convertedLeads,
    leadsWithPersonId: snap.counts.leadsWithPersonId,
    leadsWithPatientId: snap.counts.leadsWithPatientId,
    leadsWithCaseId: snap.counts.leadsWithCaseId,
    readable,
  };
}

function buildBookings(snap: SystemStatusDbSnapshot): BookingsSectionModel {
  return {
    tableExists: Boolean(snap.tablePresence.fi_bookings),
    counts: {
      total: snap.counts.bookingsTotal,
      future: snap.counts.bookingsFuture,
      completed: snap.counts.bookingsCompleted,
      cancelled: snap.counts.bookingsCancelled,
    },
  };
}

function buildCalendar(snap: SystemStatusDbSnapshot): CalendarSectionModel {
  const routeEnabled = true;
  const loadersAvailable = snap.calendarLoadersAvailable;
  const ready =
    snap.supabaseConfigured && Boolean(snap.tablePresence.fi_bookings) && loadersAvailable && routeEnabled;
  return {
    routeEnabled,
    loadersAvailable,
    label: ready ? "Ready" : "Not configured",
    traffic: ready ? "green" : "amber",
  };
}

function buildPatients(snap: SystemStatusDbSnapshot): PatientsSectionModel {
  const personsTable = Boolean(snap.tablePresence.fi_persons);
  const patientsTable = Boolean(snap.tablePresence.fi_patients);
  const clinicalDetailsTable = Boolean(snap.tablePresence.fi_patient_clinical_details);
  const patientImagesTable = Boolean(snap.tablePresence.fi_patient_images);
  const pc = snap.counts.persons;
  const pt = snap.counts.patients;
  const hasPersons = (pc ?? 0) > 0;
  const hasPatients = (pt ?? 0) > 0;

  let label: PatientsSectionModel["label"] = "Missing";
  let traffic: TrafficLight = "red";
  if (personsTable && patientsTable && hasPersons && hasPatients) {
    label = "Ready";
    traffic = "green";
  } else if (personsTable && patientsTable) {
    label = "Partial";
    traffic = "amber";
  } else if (personsTable || patientsTable) {
    label = "Partial";
    traffic = "amber";
  }

  return {
    personsTable,
    patientsTable,
    clinicalDetailsTable,
    patientImagesTable,
    personsCount: pc,
    patientsCount: pt,
    patientImagesTotal: snap.counts.patientImagesTotal,
    patientImagesActive: snap.counts.patientImagesActive,
    patientImagesArchived: snap.counts.patientImagesArchived,
    label,
    traffic,
  };
}

function buildCases(snap: SystemStatusDbSnapshot): CasesSectionModel {
  return {
    tableExists: Boolean(snap.tablePresence.fi_cases),
    active: snap.counts.casesActive,
    completed: snap.counts.casesCompleted,
  };
}

function buildActivity(snap: SystemStatusDbSnapshot): ActivityStreamSectionModel {
  return {
    tableName: "fi_crm_activity_events",
    tableExists: Boolean(snap.tablePresence.fi_crm_activity_events),
    eventsToday: snap.counts.activityToday,
    eventsLast7Days: snap.counts.activityLast7d,
  };
}

function buildUsers(snap: SystemStatusDbSnapshot): UsersSectionModel {
  return {
    tableExists: Boolean(snap.tablePresence.fi_users),
    activeUsers: snap.counts.fiUsersActive,
    totalUsers: snap.counts.fiUsersTotal,
  };
}

function buildDatabaseHealth(snap: SystemStatusDbSnapshot): DatabaseHealthRow[] {
  return SYSTEM_STATUS_CORE_TABLES.map((table) => ({
    table,
    present: Boolean(snap.tablePresence[table]),
  }));
}

function buildMigrationHealth(snap: SystemStatusDbSnapshot): MigrationHealthModel {
  if (!snap.migrationMetadataAvailable || !snap.migrationLatestFilename) {
    return { latestMigrationFilename: null, label: "Unknown" };
  }
  return { latestMigrationFilename: snap.migrationLatestFilename, label: "Healthy" };
}

function trafficBookings(s: BookingsSectionModel): TrafficLight {
  if (!s.tableExists) return "red";
  if ((s.counts.total ?? 0) === 0) return "amber";
  return "green";
}

function trafficCases(s: CasesSectionModel): TrafficLight {
  if (!s.tableExists) return "red";
  const t = (s.active ?? 0) + (s.completed ?? 0);
  if (t === 0) return "amber";
  return "green";
}

function buildSummaryStrip(
  crm: CrmSectionModel,
  bookings: BookingsSectionModel,
  calendar: CalendarSectionModel,
  patients: PatientsSectionModel,
  cases: CasesSectionModel
): SummaryStripItem[] {
  return [
    { id: "crm", label: "CRM", traffic: crm.traffic },
    { id: "bookings", label: "Bookings", traffic: trafficBookings(bookings) },
    { id: "calendar", label: "Calendar", traffic: calendar.traffic },
    { id: "patients", label: "Patients", traffic: patients.traffic },
    { id: "cases", label: "Patients", traffic: trafficCases(cases) },
  ];
}

function buildReadiness(score: number): SystemReadinessModel {
  let headline = "Environment is mostly ready for FI OS operations.";
  if (score >= 90) headline = "Core schema and modules line up — safe for active rollout testing.";
  else if (score >= 70) headline = "Most surfaces are live; review amber modules before expanding usage.";
  else if (score >= 45) headline = "Several prerequisites are missing — treat as development or partial tenant.";
  else headline = "Major gaps detected — database or module prerequisites need attention.";
  return { scorePercent: score, headline };
}

/** Aggregates DB snapshot + migration metadata into the serialisable page payload. */
export function assembleSystemStatusPayload(snap: SystemStatusDbSnapshot): SystemStatusPayload {
  const crm = buildCrmSection(snap);
  const conversion = buildConversion(snap);
  const bookings = buildBookings(snap);
  const calendar = buildCalendar(snap);
  const patients = buildPatients(snap);
  const cases = buildCases(snap);
  const activity = buildActivity(snap);
  const users = buildUsers(snap);
  const databaseHealth = buildDatabaseHealth(snap);
  const migrationHealth = buildMigrationHealth(snap);
  const summaryStrip = buildSummaryStrip(crm, bookings, calendar, patients, cases);
  const calendarReady = calendar.label === "Ready" && calendar.traffic === "green";
  const score = calculateSystemReadinessScore({
    databaseHealth,
    summaryStrip,
    calendarReady,
  });

  return {
    tenantId: snap.tenantId,
    generatedAtIso: snap.generatedAtIso,
    crm,
    conversion,
    bookings,
    calendar,
    patients,
    cases,
    activity,
    users,
    databaseHealth,
    migrationHealth,
    summaryStrip,
    readiness: buildReadiness(score),
  };
}

/** Pure helper for tests: derive summary traffic from shaped sections (post-assembly). */
export function aggregateHealthTraffic(rows: readonly DatabaseHealthRow[]): TrafficLight {
  if (rows.length === 0) return "red";
  const missing = rows.filter((r) => !r.present).length;
  if (missing === 0) return "green";
  if (missing >= rows.length) return "red";
  return "amber";
}
