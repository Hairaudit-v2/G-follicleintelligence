import Link from "next/link";
import { notFound } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

const NAV = [
  { href: "dashboard", label: "Dashboard" },
  { href: "invoices", label: "Invoices" },
  { href: "payments", label: "Payments" },
  { href: "payment-requests", label: "Payment requests" },
  { href: "installments", label: "Installments" },
  { href: "deposit-rules", label: "Deposit rules" },
] as const;

export default async function FinancialOsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const base = `/fi-admin/${tid}/financial`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-semibold text-slate-900">FinancialOS</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Revenue, deposits, installments, and payment automation. Operational booking status is unchanged; financial lifecycle is tracked on{" "}
          <code className="rounded bg-slate-100 px-1">fi_bookings.financial_os_status</code> when linked via consultation.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="FinancialOS sections">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`${base}/${item.href}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:border-sky-300 hover:text-sky-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
