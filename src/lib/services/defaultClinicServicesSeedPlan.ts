import {
  buildApprovedServicesImportPlan,
  summarizeImportPlan,
} from "@/src/lib/timelyImport/approvedFiServicesImportPlan";
import { defaultClinicServicesAsImportRows } from "@/src/lib/services/defaultClinicServices";
import type { ExistingFiServiceSnapshot } from "@/src/lib/timelyImport/approvedFiServicesImportPlan";

/** Pure plan builder for tests — mirrors server seed matching without DB writes. */
export function buildDefaultClinicServicesSeedPlan(existing: ExistingFiServiceSnapshot[]) {
  const plan = buildApprovedServicesImportPlan(defaultClinicServicesAsImportRows(), existing);
  return { plan, summary: summarizeImportPlan(plan) };
}
