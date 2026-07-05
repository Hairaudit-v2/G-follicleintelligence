"use client";

import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import type { FiOsSidebarWorkflowSection } from "@/src/lib/fi-os/fiOsSidebarWorkflow";

import { FiOsSidebar } from "@/src/components/fi-os/FiOsSidebar";

export function FiOsMoreNavDrawer({
  open,
  brandName,
  branding,
  effective,
  navSections,
  activeNavId,
  pathname,
  onClose,
  navPersistenceScope,
}: {
  open: boolean;
  brandName: string;
  branding: NormalizedTenantBranding;
  effective: EffectiveBranding;
  navSections: FiOsSidebarWorkflowSection[];
  activeNavId: string | null;
  pathname: string;
  onClose: () => void;
  navPersistenceScope: { tenantId: string; userEmail?: string | null };
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Clinic navigation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <FiOsSidebar
        variant="drawer"
        brandName={brandName}
        branding={branding}
        effective={effective}
        navSections={navSections}
        activeNavId={activeNavId}
        pathname={pathname}
        onNavigate={onClose}
        dense
        drawerTitle="All areas"
        onDrawerClose={onClose}
        compactExpandable
        navPersistenceScope={navPersistenceScope}
      />
    </div>
  );
}
