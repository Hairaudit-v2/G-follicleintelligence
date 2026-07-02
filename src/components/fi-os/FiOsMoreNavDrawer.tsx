"use client";

import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import type { FiOsSidebarWorkflowSection } from "@/src/lib/fi-os/fiOsSidebarWorkflow";

import { FiOsSidebar } from "@/src/components/fi-os/FiOsSidebar";

export function FiOsMoreNavDrawer({
  open,
  brandName,
  effective,
  navSections,
  activeNavId,
  pathname,
  onClose,
}: {
  open: boolean;
  brandName: string;
  effective: EffectiveBranding;
  navSections: FiOsSidebarWorkflowSection[];
  activeNavId: string | null;
  pathname: string;
  onClose: () => void;
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
        effective={effective}
        navSections={navSections}
        activeNavId={activeNavId}
        pathname={pathname}
        onNavigate={onClose}
        dense
        drawerTitle="All areas"
        onDrawerClose={onClose}
      />
    </div>
  );
}
