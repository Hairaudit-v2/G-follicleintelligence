import "server-only";

import {
  isPathologyAutoDraftEnabledFromEnv,
  isPathologyExtractionEnabledFromEnv,
} from "./pathologyExtractionEnv";

export function readPathologyExtractionEnabled(): boolean {
  return isPathologyExtractionEnabledFromEnv(
    process.env as import("./pathologyExtractionEnv").PathologyExtractionEnvSlice
  );
}

export function readPathologyAutoDraftEnabled(): boolean {
  return isPathologyAutoDraftEnabledFromEnv(
    process.env as import("./pathologyExtractionEnv").PathologyExtractionEnvSlice
  );
}
