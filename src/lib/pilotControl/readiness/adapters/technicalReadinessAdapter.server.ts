import "server-only";
import { resolveTechnicalSignals } from "./technicalReadinessAdapter";
export async function runTechnicalReadinessAdapter(
  ...args: Parameters<typeof resolveTechnicalSignals>
) {
  return resolveTechnicalSignals(...args);
}
