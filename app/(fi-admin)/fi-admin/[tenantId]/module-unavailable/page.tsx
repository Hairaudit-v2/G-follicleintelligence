import { notFound } from "next/navigation";

import { FiFeatureAccessDenied } from "@/src/components/fi-os/FiFeatureAccessDenied";
import { isFiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const dynamic = "force-dynamic";

export default async function FiOsModuleUnavailablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: { featureDenied?: string };
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const raw =
    typeof searchParams.featureDenied === "string" ? searchParams.featureDenied.trim() : "";
  const featureKey = raw && isFiFeatureKey(raw) ? raw : null;

  return <FiFeatureAccessDenied tenantId={tenantId} featureKey={featureKey} />;
}
