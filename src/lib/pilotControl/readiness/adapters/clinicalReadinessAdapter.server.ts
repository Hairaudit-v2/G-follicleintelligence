import "server-only";
import { resolveClinicalSignals } from "./clinicalReadinessAdapter";
export async function runClinicalReadinessAdapter(
  ...args: Parameters<typeof resolveClinicalSignals>
) {
  return resolveClinicalSignals(...args);
}
