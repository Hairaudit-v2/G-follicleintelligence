import { notFound } from "next/navigation";

import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveTrichoscopyRouteAccess } from "@/src/lib/platform/entitlements/trichoscopyRouteGate.server";
import type { ModuleAccessDenialReason } from "@/src/lib/platform/entitlements/entitlementTypes";

export const dynamic = "force-dynamic";

function mapToModuleDenial(
  reason: string
): ModuleAccessDenialReason {
  switch (reason) {
    case "platform_disabled":
    case "subscription_not_included":
    case "subscription_expired":
    case "trial_expired":
    case "entitlement_inactive":
      return "billing_inactive";
    case "tenant_module_disabled":
      return "module_disabled";
    case "user_not_permitted":
    case "user_not_found":
      return "role_not_allowed";
    default:
      return "module_disabled";
  }
}

export default async function TrichoscopyModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tenantId);

  const access = await resolveTrichoscopyRouteAccess(tenantId.trim());
  if (!access.ok) {
    if (access.reason === "platform_disabled" || access.reason === "subscription_not_included") {
      notFound();
    }
    return (
      <FiModuleAccessDenied
        tenantId={tenantId.trim()}
        moduleLabel="Trichoscopy Intelligence"
        reason={mapToModuleDenial(access.reason)}
      />
    );
  }

  return <>{children}</>;
}
