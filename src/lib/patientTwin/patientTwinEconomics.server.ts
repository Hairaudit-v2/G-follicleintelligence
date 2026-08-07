/**
 * FI-DEMO-DAY-2A.4 — Read-only economics summary for Health record overview.
 */

import "server-only";

import { loadPatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import { composeOverviewEconomics } from "./patientTwinEconomicsCore";
import type { OverviewEconomicsSection } from "./patientTwinOverviewTypes";

export async function loadPatientTwinEconomicsSummary(input: {
  tenantId: string;
  patientId: string;
  paymentsHref: string;
}): Promise<OverviewEconomicsSection> {
  const summary = await loadPatientInvoiceSummary(input.tenantId, input.patientId);
  return composeOverviewEconomics({
    invoices: summary.invoices,
    paymentsHref: input.paymentsHref,
  });
}

export { composeOverviewEconomics } from "./patientTwinEconomicsCore";
