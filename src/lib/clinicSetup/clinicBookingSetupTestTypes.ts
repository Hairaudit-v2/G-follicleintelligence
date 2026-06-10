export type ClinicBookingSetupTestProfile = "consult" | "regenerative" | "surgery" | "follow_up";

export type ClinicBookingSetupTestRowStatus = "pass" | "warning" | "fail";

export type ClinicBookingSetupTestRow = {
  profile: ClinicBookingSetupTestProfile;
  label: string;
  status: ClinicBookingSetupTestRowStatus;
  message: string;
  suggestedAction?: string;
  href?: string;
};

export type ClinicBookingSetupTestResult = {
  overallStatus: ClinicBookingSetupTestRowStatus;
  tests: ClinicBookingSetupTestRow[];
};
