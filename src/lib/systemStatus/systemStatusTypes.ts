/** Traffic-light style used across the system status dashboard. */
export type TrafficLight = "green" | "amber" | "red";

/** CRM table presence + row health. */
export type CrmTableCheck = {
  name: string;
  exists: boolean;
};

export type CrmSectionModel = {
  tables: CrmTableCheck[];
  counts: {
    leads: number | null;
    tasks: number | null;
    notes: number | null;
    communications: number | null;
  };
  /** Operational | Warning | Missing */
  overallLabel: "Operational" | "Warning" | "Missing";
  traffic: TrafficLight;
};

export type ConversionSectionModel = {
  convertedLeads: number | null;
  leadsWithPersonId: number | null;
  leadsWithPatientId: number | null;
  leadsWithCaseId: number | null;
  /** True when conversion columns are readable (table exists). */
  readable: boolean;
};

export type BookingsSectionModel = {
  tableExists: boolean;
  counts: {
    total: number | null;
    future: number | null;
    completed: number | null;
    cancelled: number | null;
  };
};

export type CalendarSectionModel = {
  routeEnabled: boolean;
  loadersAvailable: boolean;
  label: "Ready" | "Not configured";
  traffic: TrafficLight;
};

export type PatientsSectionModel = {
  personsTable: boolean;
  patientsTable: boolean;
  personsCount: number | null;
  patientsCount: number | null;
  label: "Ready" | "Partial" | "Missing";
  traffic: TrafficLight;
};

export type CasesSectionModel = {
  tableExists: boolean;
  active: number | null;
  completed: number | null;
};

export type ActivityStreamSectionModel = {
  tableName: "fi_crm_activity_events";
  tableExists: boolean;
  eventsToday: number | null;
  eventsLast7Days: number | null;
};

export type UsersSectionModel = {
  tableExists: boolean;
  /** fi_users rows for tenant with a linked auth user (can sign in). */
  activeUsers: number | null;
  totalUsers: number | null;
};

export type DatabaseHealthRow = {
  table: string;
  present: boolean;
};

export type MigrationHealthModel = {
  latestMigrationFilename: string | null;
  label: "Healthy" | "Unknown";
};

export type SummaryStripItem = {
  id: "crm" | "bookings" | "calendar" | "patients" | "cases";
  label: string;
  traffic: TrafficLight;
};

export type SystemReadinessModel = {
  scorePercent: number;
  /** Short explanation for operators. */
  headline: string;
};

/** Flat result from `runSystemStatusDbQueries` before UI-oriented shaping. */
export type SystemStatusDbSnapshot = {
  tenantId: string;
  generatedAtIso: string;
  tablePresence: Record<string, boolean>;
  counts: {
    crmLeads: number | null;
    crmTasks: number | null;
    crmLeadNotes: number | null;
    crmLeadCommunications: number | null;
    convertedLeads: number | null;
    leadsWithPersonId: number | null;
    leadsWithPatientId: number | null;
    leadsWithCaseId: number | null;
    bookingsTotal: number | null;
    bookingsFuture: number | null;
    bookingsCompleted: number | null;
    bookingsCancelled: number | null;
    persons: number | null;
    patients: number | null;
    casesActive: number | null;
    casesCompleted: number | null;
    activityToday: number | null;
    activityLast7d: number | null;
    fiUsersTotal: number | null;
    fiUsersActive: number | null;
  };
  supabaseConfigured: boolean;
  calendarLoadersAvailable: boolean;
  migrationLatestFilename: string | null;
  migrationMetadataAvailable: boolean;
};

export type SystemStatusPayload = {
  tenantId: string;
  generatedAtIso: string;
  crm: CrmSectionModel;
  conversion: ConversionSectionModel;
  bookings: BookingsSectionModel;
  calendar: CalendarSectionModel;
  patients: PatientsSectionModel;
  cases: CasesSectionModel;
  activity: ActivityStreamSectionModel;
  users: UsersSectionModel;
  databaseHealth: DatabaseHealthRow[];
  migrationHealth: MigrationHealthModel;
  summaryStrip: SummaryStripItem[];
  readiness: SystemReadinessModel;
};
