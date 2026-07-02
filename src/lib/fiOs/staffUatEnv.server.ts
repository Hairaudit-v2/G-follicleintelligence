import "server-only";

import { isFiStaffUatModeEnabledFromEnv } from "./staffUatEnv";

export function readFiStaffUatModeEnabled(): boolean {
  return isFiStaffUatModeEnabledFromEnv(
    process.env as import("./staffUatEnv").StaffUatEnvSlice
  );
}