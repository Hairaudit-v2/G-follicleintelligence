import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsPayrollClient } from "@/src/components/fi/workforce/WorkforceOsPayrollClient";
import { loadWorkforceOsPayrollPage } from "@/src/lib/workforce/wageProfilePage.server";

export const metadata = {
  title: "Payroll & wages · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsPayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const { date } = await searchParams;
  if (!tenantId?.trim()) notFound();

  const data = await loadWorkforceOsPayrollPage(tenantId.trim(), date);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <WorkforceOsPayrollClient
        tenantId={tenantId.trim()}
        wageProfiles={data.wageProfiles}
        awardLoadings={data.awardLoadings}
        timesheetEntries={data.timesheetEntries}
        timePunches={data.timePunches}
        staffOptions={data.staffOptions}
        surgeryDayCost={data.surgeryDayCost}
        rateTypeCounts={data.rateTypeCounts}
        workDate={data.workDate}
        canManage={data.canManage}
      />
    </div>
  );
}