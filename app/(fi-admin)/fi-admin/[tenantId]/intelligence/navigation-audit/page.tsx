import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { FiOsNavigationDriftAuditSurface } from "@/src/components/fi-os/navigation/FiOsNavigationDriftAuditSurface";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewFiOsNavigationAudit } from "@/src/lib/fiOs/navigation/fiOsNavigationAuditAccess.server";
import { loadFiOsNavigationAuditPageModel } from "@/src/lib/fiOs/navigation/fiOsNavigationAudit.server";

export const metadata = {
  title: "Navigation drift audit",
  description: "D6G-A audit of FI OS navigation against 1B workflow architecture.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiOsNavigationAuditPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  if (!(await canViewFiOsNavigationAudit(tid))) {
    notFound();
  }

  const model = loadFiOsNavigationAuditPageModel(tid);

  return <FiOsNavigationDriftAuditSurface model={model} />;
}