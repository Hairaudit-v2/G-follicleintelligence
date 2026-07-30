import "server-only";
import { resolvePatientSignals } from "./patientReadinessAdapter";
export async function runPatientReadinessAdapter(
  ...args: Parameters<typeof resolvePatientSignals>
) {
  return resolvePatientSignals(...args);
}
