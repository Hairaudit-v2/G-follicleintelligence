"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { TenantBrandMark } from "@/src/components/brand/TenantBrandMark";
import type { FiOsSidebarWorkflowSection } from "@/src/lib/fi-os/fiOsSidebarWorkflow";

import { FiOsModuleNav } from "@/src/components/fi-os/FiOsModuleNav";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export function FiOsSidebar({
  brandName,
  branding,
  effective: _effective,
  navSections,
  activeNavId,
  pathname,
  variant,
  onNavigate,
  dense,
  drawerTitle = "FI OS",
  onDrawerClose,
  compactExpandable = false,
  navPersistenceScope,
}: {
  brandName: string;
  branding: NormalizedTenantBranding;
  effective: EffectiveBranding;
  navSections: FiOsSidebarWorkflowSection[];
  activeNavId: string | null;
  pathname?: string;
  variant: "rail" | "drawer";
  onNavigate?: () => void;
  dense?: boolean;
  drawerTitle?: string;
  onDrawerClose?: () => void;
  compactExpandable?: boolean;
  navPersistenceScope?: { tenantId: string; userEmail?: string | null };
}) {
  const logoSrc = branding.logoUrl;

  const brandBlock =
    variant === "rail" ? (
      <Link
        href="/fi-admin"
        className={cn(
          "mb-1 flex shrink-0 items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 transition",
          "hover:border-white/[0.12] hover:bg-white/[0.05]",
          fiOsChromeClasses.glassCard
        )}
      >
        <TenantBrandMark branding={branding} size="md" />
        <div className="min-w-0">
          <p
            className="text-[0.6rem] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--fi-tenant-accent)" }}
          >
            Clinic OS
          </p>
          <p className="truncate text-sm font-semibold text-slate-50">{brandName}</p>
        </div>
      </Link>
    ) : (
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-3 py-3">
        <span className="text-sm font-semibold text-slate-50">{drawerTitle}</span>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-slate-400 hover:bg-white/[0.05]"
          aria-label="Close navigation"
          onClick={onDrawerClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );

  const logoStrip =
    logoSrc && variant === "rail" ? (
      <div
        className="mt-2 flex shrink-0 justify-center rounded-xl border border-white/[0.06] py-2"
        style={{ backgroundColor: "var(--fi-tenant-brand-bg)" }}
      >
        <TenantBrandMark branding={branding} size="lg" />
      </div>
    ) : null;

  if (variant === "drawer") {
    return (
      <div className={fiOsChromeClasses.sidebarDrawer}>
        {brandBlock}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-2">
          <FiOsModuleNav
            sections={navSections}
            activeId={activeNavId}
            pathname={pathname}
            onNavigate={onNavigate}
            dense={dense}
            compactExpandable={compactExpandable}
            navPersistenceScope={navPersistenceScope}
          />
        </div>
      </div>
    );
  }

  return (
    <aside className={fiOsChromeClasses.sidebarRail}>
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(500px 240px at 0% 0%, rgba(34, 193, 255, 0.08), transparent 55%), radial-gradient(400px 200px at 100% 100%, rgba(124, 58, 237, 0.05), transparent 45%)",
        }}
        aria-hidden
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-2.5">
        {brandBlock}
        {logoStrip}
        <FiOsModuleNav
          sections={navSections}
          activeId={activeNavId}
          pathname={pathname}
          onNavigate={onNavigate}
          dense={dense}
          compactExpandable={compactExpandable}
          navPersistenceScope={navPersistenceScope}
        />
      </div>
    </aside>
  );
}
