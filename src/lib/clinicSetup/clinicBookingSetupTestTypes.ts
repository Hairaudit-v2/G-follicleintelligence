export type ClinicBookingSetupTestProfile = "consult" | "regenerative" | "surgery" | "follow_up";

export type ClinicBookingSetupTestRowStatus = "pass" | "warning" | "fail";

export type ClinicBookingSetupTestRow = {
  profile: ClinicBookingSetupTestProfile;
  label: string;
  status: ClinicBookingSetupTestRowStatus;
  message: string;
  suggestedAction?: string;
  href?: string;
  /** Server-suggested safe auto-fix keys for this row (see `clinicBookingSetupAutoFix.server.ts`). */
  fixKeys?: string[];
};

export type ClinicBookingSetupHygieneRow = {
  id: string;
  label: string;
  status: ClinicBookingSetupTestRowStatus;
  message: string;
  suggestedAction?: string;
  href?: string;
  fixKeys?: string[];
};

export type ClinicBookingSetupTestResult = {
  overallStatus: ClinicBookingSetupTestRowStatus;
  tests: ClinicBookingSetupTestRow[];
  /** Cross-cutting checks (calendar hygiene, Perth room aliases, …). */
  hygiene: ClinicBookingSetupHygieneRow[];
};
