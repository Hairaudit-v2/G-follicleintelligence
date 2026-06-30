import Link from "next/link";
import type { AppointmentInvoicePreview } from "@/src/lib/bookings/appointmentInvoicePreview";
import { appointmentCardClass } from "../shared";

export function AppointmentInvoicePreviewPanel({
  tenantId,
  patientId,
  invoice,
}: {
  tenantId: string;
  patientId: string | null;
  invoice: AppointmentInvoicePreview;
}) {
  return (
    <section className={appointmentCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Invoice preview</h2>
          <p className="mt-1 text-xs text-slate-400">
            Draft preview from appointment metadata until a dedicated billing module is connected. Not a tax invoice.
          </p>
        </div>
        {patientId ? (
          <Link href={`/fi-admin/${tenantId}/patients/${patientId}`} className="text-xs text-blue-300 hover:underline">
            Patient billing context →
          </Link>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-500">Reference</dt>
          <dd className="font-medium text-slate-100">{invoice.reference ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Status</dt>
          <dd className="capitalize text-slate-100">{invoice.status ?? "draft"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Currency</dt>
          <dd>{invoice.currency ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Total</dt>
          <dd className="font-semibold text-slate-100">{invoice.totalLabel ?? "TBC"}</dd>
        </div>
      </dl>
      {invoice.lineItems.length > 0 ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-xs uppercase text-gray-500">
              <th className="py-2">Line</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line, i) => (
              <tr key={`${line.label}-${i}`} className="border-b border-white/[0.06]">
                <td className="py-2 text-slate-200">{line.label}</td>
                <td className="py-2 text-right text-slate-200">{line.amount ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-slate-400">No line items yet. Add `metadata.invoice` on the booking when billing is wired.</p>
      )}
      {invoice.notes ? <p className="mt-3 text-xs text-slate-400">{invoice.notes}</p> : null}
    </section>
  );
}
