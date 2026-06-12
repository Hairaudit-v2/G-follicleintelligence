import { FiSection } from "@/src/components/fi-design/FiSection";
import type { CasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";

import { CaseRevenuePaymentsCardClient } from "./CaseRevenuePaymentsCardClient";

export function CaseRevenuePaymentsCard(props: {
  tenantId: string;
  caseId: string;
  patientFoundationId: string | null;
  readiness: CasePaymentReadiness;
  canMutate: boolean;
}) {
  const { tenantId, caseId, patientFoundationId, readiness, canMutate } = props;

  return (
    <FiSection
      title="Invoices & payment requests"
      description="RevenueOS invoices — separate from manual payment status cards. Amounts are administrative; staff must verify before collection."
      headingId="case-revenue-payments-heading"
    >
      <CaseRevenuePaymentsCardClient
        tenantId={tenantId}
        caseId={caseId}
        patientFoundationId={patientFoundationId}
        readiness={readiness}
        canMutate={canMutate}
      />
    </FiSection>
  );
}
