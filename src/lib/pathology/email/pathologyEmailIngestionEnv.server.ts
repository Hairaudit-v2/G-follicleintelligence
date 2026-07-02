import "server-only";

import {
  isPathologyEmailIngestionEnabledFromEnv,
  type PathologyEmailIngestionEnvSlice,
} from "./pathologyEmailIngestionEnv";

/** Server-only: whether inbound pathology email webhooks are accepted. */
export function readPathologyEmailIngestionEnabled(
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): boolean {
  return isPathologyEmailIngestionEnabledFromEnv(env);
}
