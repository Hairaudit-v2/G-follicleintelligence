import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { WorkforceCommandCentreClient } from "@/src/components/fi-admin/workforce/WorkforceCommandCentreClient";
import { buildTeamWorkspaceLandingHref } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import { resolveTeamWorkspaceAccessForViewer } from "@/src/lib/staffAccess/staffTeamAccess.server";
import { loadWorkforceCommandCentrePage } from "@/src/lib/workforce/workforceCommandCentrePage.server";

export const metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminTeamOverviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  const teamAccess = await resolveTeamWorkspaceAccessForViewer(tid);
  if (!teamAccess.allowed) notFound();

  const data = await loadWorkforceCommandCentrePage(tid);
  if (!data) {
    const landingHref = buildTeamWorkspaceLandingHref(tid, teamAccess.tabAccess.visibleTabIds, {
      excludeOverview: true,
    });
    if (landingHref.endsWith("/team") || landingHref.endsWith("/team/")) {
      notFound();
    }
    redirect(landingHref);
  }

  return (
    <div className="pb-8">
      <WorkforceCommandCentreClient tenantId={tenantId.trim()} data={data} />
    </div>
  );
}