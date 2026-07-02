import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PresenceIntelligenceSurface } from "@/src/components/fi-os/presence/PresenceIntelligenceSurface";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewPresenceIntelligence } from "@/src/lib/fiOs/presence/presenceAccess.server";
import { loadPresenceSnapshotForTenant } from "@/src/lib/fiOs/presence/presenceEngine.server";
import { loadWorkspaceProfileKeyForViewer } from "@/src/lib/fi-os/workspaceProfile.server";

export const metadata = {
  title: "Presence Intelligence",
  description: "Operational presence coverage derived from existing clinic signals.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PresenceIntelligencePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  if (!(await canViewPresenceIntelligence(tid))) {
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

  const profileKey = await loadWorkspaceProfileKeyForViewer(tid);
  const summary = await loadPresenceSnapshotForTenant(tid, { profileKey });

  return <PresenceIntelligenceSurface summary={summary} />;
}
