import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { TodaySignalBakeSurface } from "@/src/components/fi-os/todaySignal/TodaySignalBakeSurface";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewTodaySignalLearning } from "@/src/lib/fiOs/todaySignal/todaySignalLearningAccess.server";
import { loadTodaySignalBakePageModel } from "@/src/lib/fiOs/todaySignal/todaySignalValidation.server";

export const metadata = {
  title: "D6 Intelligence Bake",
  description: "Operational validation for the living Today and workspace signal layer.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TodaySignalD6BakePage({
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

  const model = await loadTodaySignalBakePageModel(tid);

  return <TodaySignalBakeSurface model={model} />;
}
