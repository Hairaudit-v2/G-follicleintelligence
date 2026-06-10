export type ClinicBookingSetupAutoFixApplied = { key: string; message: string };
export type ClinicBookingSetupAutoFixSkipped = { key: string; reason: string };
export type ClinicBookingSetupAutoFixError = { key: string; message: string };

export type ClinicBookingSetupAutoFixResult = {
  ok: boolean;
  applied: ClinicBookingSetupAutoFixApplied[];
  skipped: ClinicBookingSetupAutoFixSkipped[];
  errors: ClinicBookingSetupAutoFixError[];
};
