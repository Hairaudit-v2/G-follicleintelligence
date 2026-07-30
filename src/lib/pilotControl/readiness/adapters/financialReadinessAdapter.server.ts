import "server-only";
import { resolveFinancialSignals } from "./financialReadinessAdapter";
export async function runFinancialReadinessAdapter(
  ...args: Parameters<typeof resolveFinancialSignals>
) {
  return resolveFinancialSignals(...args);
}
