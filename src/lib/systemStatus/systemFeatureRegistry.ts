/**
 * Central inventory of FI OS product areas for the system status page.
 * Status is resolved at runtime from `SystemStatusPayload` (see `resolveFeatureInventoryStatuses`).
 */

import type { SystemStatusPayload } from "./systemStatusTypes";

export type FeatureRolloutStatus = "ready" | "partial" | "planned";

export type SystemFeatureEntry = {
  id: string;
  group: "CRM" | "Bookings" | "Patients" | "HairAudit" | "IIOHR" | "SurgeryOS";
  label: string;
};

export const SYSTEM_FEATURE_REGISTRY: readonly SystemFeatureEntry[] = [
  { id: "crm.leads", group: "CRM", label: "Leads" },
  { id: "crm.tasks", group: "CRM", label: "Tasks" },
  { id: "crm.notes", group: "CRM", label: "Notes" },
  { id: "crm.communications", group: "CRM", label: "Communications" },
  { id: "crm.conversion", group: "CRM", label: "Conversion" },
  { id: "bookings.operator", group: "Bookings", label: "Operator View" },
  { id: "bookings.calendar", group: "Bookings", label: "Calendar" },
  { id: "patients.profile", group: "Patients", label: "Profile" },
  { id: "patients.clinicalDetails", group: "Patients", label: "Clinical Details" },
  { id: "patients.images", group: "Patients", label: "Images" },
  { id: "patients.hli", group: "Patients", label: "HLI" },
  { id: "hairaudit.core", group: "HairAudit", label: "HairAudit" },
  { id: "surgeryos.core", group: "SurgeryOS", label: "SurgeryOS" },
  { id: "iiohr.core", group: "IIOHR", label: "IIOHR" },
] as const;

export type ResolvedFeatureRow = SystemFeatureEntry & { status: FeatureRolloutStatus };

/**
 * Maps the live tenant snapshot to rollout labels for the feature matrix.
 *
 * - **Ready:** table/route prerequisites met and (where applicable) tenant has used the surface.
 * - **Partial:** schema or shell exists but prerequisites missing or usage not yet proven.
 * - **Planned:** not yet shipped in this codebase / placeholder row.
 */
export function resolveFeatureInventoryStatuses(payload: SystemStatusPayload): ResolvedFeatureRow[] {
  const crmTablesOk =
    payload.crm.tables.every((t) => t.exists) && payload.crm.traffic !== "red";
  const leadsOk = payload.crm.tables.find((t) => t.name === "fi_crm_leads")?.exists ?? false;
  const tasksOk = payload.crm.tables.find((t) => t.name === "fi_crm_tasks")?.exists ?? false;
  const notesOk = payload.crm.tables.find((t) => t.name === "fi_crm_lead_notes")?.exists ?? false;
  const commsOk = payload.crm.tables.find((t) => t.name === "fi_crm_lead_communications")?.exists ?? false;

  const hasLeads = (payload.crm.counts.leads ?? 0) > 0;
  const hasTasks = (payload.crm.counts.tasks ?? 0) > 0;
  const hasNotes = (payload.crm.counts.notes ?? 0) > 0;
  const hasComms = (payload.crm.counts.communications ?? 0) > 0;
  const convReady =
    payload.conversion.readable &&
    (payload.conversion.convertedLeads ?? 0) > 0 &&
    (payload.conversion.leadsWithPatientId ?? 0) > 0;

  const bookingsReady = payload.bookings.tableExists;
  const operatorReady = bookingsReady && (payload.bookings.counts.total ?? 0) > 0;
  const calendarReady = payload.calendar.label === "Ready" && payload.calendar.traffic === "green";

  const patientProfileSchemaOk = payload.patients.personsTable && payload.patients.patientsTable;
  const patientProfileHasRows = (payload.patients.patientsCount ?? 0) > 0;
  const clinicalDetailsTable = payload.patients.clinicalDetailsTable;

  const resolve = (id: string): FeatureRolloutStatus => {
    switch (id) {
      case "crm.leads":
        return leadsOk ? "ready" : "partial";
      case "crm.tasks":
        if (!tasksOk) return "partial";
        return crmTablesOk && hasLeads ? (hasTasks ? "ready" : "partial") : "partial";
      case "crm.notes":
        if (!notesOk) return "partial";
        return crmTablesOk && hasLeads ? (hasNotes ? "ready" : "partial") : "partial";
      case "crm.communications":
        if (!commsOk) return "partial";
        return crmTablesOk && hasLeads ? (hasComms ? "ready" : "partial") : "partial";
      case "crm.conversion":
        if (!leadsOk || !payload.conversion.readable) return "partial";
        return convReady ? "ready" : "partial";
      case "bookings.operator":
        return bookingsReady ? (operatorReady ? "ready" : "partial") : "partial";
      case "bookings.calendar":
        return bookingsReady ? (calendarReady ? "ready" : "partial") : "partial";
      case "patients.profile":
        if (!patientProfileSchemaOk) return "planned";
        return patientProfileHasRows ? "ready" : "partial";
      case "patients.clinicalDetails":
        if (!patientProfileSchemaOk) return "planned";
        return clinicalDetailsTable ? "ready" : "partial";
      case "patients.images":
      case "patients.hli":
        return "planned";
      case "hairaudit.core":
      case "surgeryos.core":
      case "iiohr.core":
        return "planned";
      default:
        return "planned";
    }
  };

  return SYSTEM_FEATURE_REGISTRY.map((row) => ({ ...row, status: resolve(row.id) }));
}
