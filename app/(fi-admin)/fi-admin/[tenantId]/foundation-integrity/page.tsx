import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { FoundationOsDashboard } from "@/src/components/fi-admin/foundation/FoundationOsDashboard";
import { loadFoundationOsDashboard } from "@/src/lib/fi/foundation/foundationOsDashboardRead.server";

export const metadata = {
  title: "FoundationOS",
  description: "Patient identity resolution, media unification, timelines, events, and Patient Twin health.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FoundationIntegrityPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const data = await loadFoundationOsDashboard(tenantId.trim());

  return (
    <div className="mx-auto max-w-[88rem] min-w-0 space-y-6 px-4 py-6 sm:px-6">
      <FoundationOsDashboard tenantId={tenantId.trim()} data={data} />
    </div>
  );
}
