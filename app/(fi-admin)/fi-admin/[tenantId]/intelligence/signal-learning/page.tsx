import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { TodaySignalLearningSurface } from "@/src/components/fi-os/todaySignal/TodaySignalLearningSurface";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewTodaySignalLearning } from "@/src/lib/fiOs/todaySignal/todaySignalLearningAccess.server";
import { loadTodaySignalLearningSummaryForTenant } from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary.server";

export const metadata = {
  title: "Signal Learning",
  description: "Operational pattern intelligence from Today signal behaviour.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TodaySignalLearningPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  if (!(await canViewTodaySignalLearning(tid))) {
    notFound();
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const model = await loadTodaySignalLearningSummaryForTenant(tid);

  return <TodaySignalLearningSurface model={model} />;
}
