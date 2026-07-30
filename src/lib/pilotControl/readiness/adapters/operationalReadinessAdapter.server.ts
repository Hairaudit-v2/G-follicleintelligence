import "server-only";
import { resolveOperationalSignals } from "./operationalReadinessAdapter";
export async function runOperationalReadinessAdapter(
  ...args: Parameters<typeof resolveOperationalSignals>
) {
  return resolveOperationalSignals(...args);
}
