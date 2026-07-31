import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { SurgeryReviewHub } from "@/src/components/fi-os/surgery/SurgeryReviewHub";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { buildSurgeryReviewHubModel } from "@/src/lib/fiOs/surgery/surgeryReviewHubCore";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";

export const metadata = {
  title: "Surgery review",
  description: "Review surgical records, graft documentation, imaging and outcomes requiring attention.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminSurgeryReviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  await assertFiTenantPortalAccessUnlessStaffPinSession(tid);
  await assertStaffModuleAccess(tid, "surgery_os", "read");

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

  const viewer = await resolveSurgeryOsViewerContext(tid);
  if (!viewer.canAccessSurgeryOs) {
    redirect(`/fi-admin/${tid}/calendar`);
  }

  const canAccessAdvancedOutcomeView = viewer.surgeryOsRole === "admin";

  const model = buildSurgeryReviewHubModel({
    tenantId: tid,
    access: {
      canAccessCases: true,
      canAccessSurgeryWorkspace: viewer.canAccessSurgeryOs,
      canAccessAdvancedOutcomeView,
      canAccessGraftCounting: canAccessAdvancedOutcomeView,
    },
  });

  return <SurgeryReviewHub model={model} />;
}
