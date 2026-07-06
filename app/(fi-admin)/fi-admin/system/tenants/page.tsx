import { PlatformTenantsClient } from "@/src/components/fi-admin/system/PlatformTenantsClient";
import { PlatformTenantsListClient } from "@/src/components/fi-admin/system/PlatformTenantsListClient";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { loadPlatformTenantsForAdmin } from "@/src/lib/fiOs/platformTenantLifecycle.server";
import type { FiPlatformTenantLifecycleRow } from "@/src/lib/fiOs/platformTenantLifecycleCore";

export const dynamic = "force-dynamic";

export default async function SystemTenantsPage() {
  let tenants: FiPlatformTenantLifecycleRow[] = [];
  let loadError: string | null = null;

  try {
    tenants = await loadPlatformTenantsForAdmin({
      includeArchived: true,
      includeDemo: true,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Platform</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Tenant management</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Create tenants, review archive safety checks, and hide demo or retired tenants from the
          production admin experience. Archive is reversible — no tenant data is hard-deleted.
        </p>
      </div>

      <PlatformTenantsClient />

      {loadError ? (
        <p className="text-sm text-red-400">Could not load tenants: {loadError}</p>
      ) : (
        <PlatformTenantsListClient tenants={tenants} />
      )}
    </div>
  );
}
