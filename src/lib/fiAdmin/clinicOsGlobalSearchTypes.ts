/** Shared types for Clinic OS global search (client + server). */

export type ClinicOsGlobalSearchPatient = {
  entityType: "patient";
  id: string;
  patientId: string;
  personId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  href: string;
};

export type ClinicOsGlobalSearchCase = {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  href: string;
};

export type ClinicOsGlobalSearchLead = {
  id: string;
  name: string;
  stageLabel: string;
  href: string;
};

export type ClinicOsGlobalSearchPayload = {
  patients: ClinicOsGlobalSearchPatient[];
  cases: ClinicOsGlobalSearchCase[];
  leads: ClinicOsGlobalSearchLead[];
};
