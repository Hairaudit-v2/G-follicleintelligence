import "server-only";

import { isFiProcedureDayEnabledFromEnv } from "./procedureDayEnv";

export function readFiProcedureDayEnabled(): boolean {
  return isFiProcedureDayEnabledFromEnv(process.env as import("./procedureDayEnv").ProcedureDayEnvSlice);
}