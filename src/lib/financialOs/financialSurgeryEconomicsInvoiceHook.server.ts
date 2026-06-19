import "server-only";

import { invoiceBalanceDueCents, type FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { maybeTriggerSurgeryProfitabilitySnapshot } from "@/src/lib/financialOs/financialSurgeryEconomicsSnapshotOrchestrator.server";

/**
 * Best-effort profitability snapshot when a surgery balance invoice is paid in full.
 */
export async function maybeTriggerSurgeryProfitabilitySnapshotAfterInvoiceSettlement(args: {
  tenantId: string;
  invoice: FiInvoiceRow;
  actorFiUserId?: string | null;
}): Promise<void> {
  const tid = args.tenantId.trim();
  const inv = args.invoice;
  const caseId = inv.case_id?.trim() || null;
  if (!tid || !caseId) return;
  if (inv.invoice_kind !== "surgery_balance" && inv.invoice_kind !== "surgery_deposit") return;
  if (invoiceBalanceDueCents(inv) > 0) return;

  try {
    await maybeTriggerSurgeryProfitabilitySnapshot({
      tenantId: tid,
      caseId,
      trigger: {
        source: inv.invoice_kind === "surgery_balance" ? "invoice_paid_in_full" : "surgery_deposit_paid",
        actorFiUserId: args.actorFiUserId,
        metadata: {
          invoice_id: inv.id,
          invoice_kind: inv.invoice_kind,
        },
      },
    });
  } catch {
    /* best-effort */
  }
}
