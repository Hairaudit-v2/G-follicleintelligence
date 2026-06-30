import { notFound } from "next/navigation";

import { FinancialOsModuleSwitcher } from "@/src/components/fi-admin/financial-os/FinancialOsModuleSwitcher";
import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";

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
  await assertStaffModuleAccess(tid, "financial_os", "read");
  const base = `/fi-admin/${tid}/financial`;

  return (
    <div className={financialOsClasses.pageShell}>
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">
            FinancialOS · Command centre
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            Revenue & settlement
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Revenue, deposits, installments, and payment automation. Operational booking status is
            unchanged; financial lifecycle is tracked on{" "}
            <code className={financialOsClasses.code}>fi_bookings.financial_os_status</code> when
            linked via consultation.
          </p>
        </div>
        <div className="w-full shrink-0 sm:max-w-none lg:w-auto lg:min-w-[15rem]">
          <FinancialOsModuleSwitcher base={base} />
        </div>
      </header>
      {children}
    </div>
  );
}
