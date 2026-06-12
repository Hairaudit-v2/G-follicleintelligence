import "server-only";

import { redirect } from "next/navigation";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsFeatureAccessMapOrNullForViewer } from "@/src/lib/fi-os/featureAccess.server";
import { buildFiOsModuleUnavailableHref, resolveFiFeatureRouteDecision } from "@/src/lib/fi-os/featureRouteGuardPolicy";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export async function enforceFiFeatureRouteOrRedirect(opts: {
  tenantId: string;
  pathname: string | null | undefined;
  tenantBase: string;
  pinFloorMode: boolean;
}): Promise<void> {
  if (opts.pinFloorMode) return;
  const rawPath = opts.pathname?.trim() ?? "";
  if (!rawPath) return;

  const tid = opts.tenantId.trim();
  const base = opts.tenantBase.replace(/\/+$/, "") || "";
  if (!tid || !base) return;

  const [featureAccessMap, authId] = await Promise.all([
    loadFiOsFeatureAccessMapOrNullForViewer(tid),
    resolveAuthUserId(null),
  ]);
  const adminProf = authId ? await loadActiveTenantAdminProfileForSession(tid, authId) : null;

  const decision = resolveFiFeatureRouteDecision({
    pathname: rawPath,
    tenantBase: base,
    featureAccessMap,
    isActiveTenantBackendAdmin: Boolean(adminProf),
  });

  if (decision.kind === "allow") return;

  redirect(buildFiOsModuleUnavailableHref(base, decision.feature));
}
