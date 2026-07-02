import "server-only";

import { isPathologyExtractionEnabledFromEnv } from "./pathologyExtractionEnv";

export function readPathologyExtractionEnabled(): boolean {
  return isPathologyExtractionEnabledFromEnv(
    process.env as import("./pathologyExtractionEnv").PathologyExtractionEnvSlice
  );
}
