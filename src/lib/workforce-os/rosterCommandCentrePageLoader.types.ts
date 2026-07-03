export type RosterLoadStep =
  | "schema_check"
  | "load_staff"
  | "load_standard_hours"
  | "load_shifts"
  | "load_availability"
  | "load_clinical_events"
  | "load_roster_payload"
  | "load_event_details";

export type RosterLoadCounts = {
  staffCount: number;
  shiftsCount: number;
  standardHoursStaffCount: number;
  availabilityBlockCount: number;
  clinicalEventCount: number;
};

export type RosterCommandCentrePageFailure = {
  ok: false;
  failedStep: RosterLoadStep;
  message: string;
  digest?: string;
  schemaCheckPassed: boolean;
  counts: Partial<RosterLoadCounts>;
};
