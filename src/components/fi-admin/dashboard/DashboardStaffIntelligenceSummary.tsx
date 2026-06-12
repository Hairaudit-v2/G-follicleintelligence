import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

type Props = {
  tenantBase: string;
};

/**
 * Stage 3.75 — director / clinic manager widget shell (no automated decisions; no external AI).
 */
export function DashboardStaffIntelligenceSummary(props: Props) {
  const b = props.tenantBase.replace(/\/+$/, "");
  const staffHref = `${b}/staff`;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-staff-intel-heading">
      <SectionHeader
        id="dash-staff-intel-heading"
        kicker="Support signals"
        title="Staff intelligence"
        description="Operational support signals for managers — surfaced from clinic activity (no automated permission changes)."
      />
      <p className="mt-3 text-sm text-slate-400">
        Staff intelligence will surface operational support signals once enough activity is available. Use the staff
        directory to review individual queues and recommended next steps.
      </p>
      <p className="mt-4">
        <Link href={staffHref} className="text-sm font-semibold text-cyan-400/90 underline-offset-2 hover:underline">
          Open staff directory
        </Link>
      </p>
    </DashboardCard>
  );
}
