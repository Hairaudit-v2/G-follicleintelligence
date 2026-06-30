import Link from "next/link";

import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
} from "@/src/lib/revenueOs/revenueInvoiceModel";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function PatientRevenueInvoicesPanel(props: {
  tenantId: string;
  patientId: string;
  summary: PatientInvoiceSummary;
}) {
  const { tenantId, patientId, summary } = props;
  const open = summary.invoices.filter(
    (i) => isInvoiceOpenForCollection(i.status) && invoiceBalanceDueCents(i) > 0
  );

  return (
    <div className="space-y-4">
      <FiSection
        title="Invoices (RevenueOS)"
        description="Structured invoices and balances. This does not replace manual payment status tracking elsewhere on the profile."
        headingId="patient-revenue-invoices-heading"
      >
        <div className="mb-3 flex flex-wrap gap-3 text-sm text-slate-300">
          <span>
            Open balances: <strong>{summary.unpaidOpenCount}</strong>
          </span>
          <span>
            Overdue (by due date): <strong>{summary.overdueCount}</strong>
          </span>
          <span>
            Outstanding (AUD):{" "}
            <strong>{formatMoneyFromCents(summary.outstandingCentsAud, "AUD")}</strong>
          </span>
        </div>
        {summary.invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices yet for this patient.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded border border-white/[0.08]">
            {summary.invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-mono text-xs text-slate-500">{inv.id}</p>
                  <p className="mt-1 text-slate-200">
                    {inv.title ?? inv.invoice_kind} ·{" "}
                    <span className="font-semibold">{inv.status}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Paid {formatMoneyFromCents(inv.amount_paid_cents, inv.currency)} /{" "}
                    {formatMoneyFromCents(inv.total_cents, inv.currency)}
                    {inv.due_date ? <span> · due {inv.due_date}</span> : null}
                  </p>
                </div>
                {inv.case_id ? (
                  <Link
                    href={`/fi-admin/${tenantId}/cases/${inv.case_id}`}
                    className="text-xs font-medium text-blue-300 hover:underline"
                  >
                    Case
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </FiSection>

      {open.length > 0 ? (
        <p className="text-xs text-slate-500">
          Patient <span className="font-mono">{patientId.slice(0, 8)}…</span> — finance roles can
          mark invoices paid or send payment requests from the case or consultation workspace.
        </p>
      ) : null}
    </div>
  );
}
