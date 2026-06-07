"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { BrandLogoImage } from "@/src/components/brand/BrandLogoImage";
import { resolveTenantLogoSource } from "@/src/lib/brand/resolveTenantLogo";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

import { FiOsModuleNav } from "@/src/components/fi-os/FiOsModuleNav";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export function FiOsSidebar({
  brandName,
  effective,
  navItems,
  activeNavId,
  variant,
  onNavigate,
  dense,
  drawerTitle = "FI OS",
  onDrawerClose,
}: {
  brandName: string;
  effective: EffectiveBranding;
  navItems: FiOsPrimarySidebarItem[];
  activeNavId: string | null;
  variant: "rail" | "drawer";
  onNavigate?: () => void;
  dense?: boolean;
  drawerTitle?: string;
  onDrawerClose?: () => void;
}) {
  const logoSrc = resolveTenantLogoSource(effective.logo_url);

  const brandBlock =
    variant === "rail" ? (
      <Link
        href="/fi-admin"
        className={cn(
          "mb-1 flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 transition",
          "hover:border-white/[0.12] hover:bg-white/[0.05]",
          fiOsChromeClasses.glassCard,
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/15 bg-slate-950/50 text-xs font-bold tracking-tight text-cyan-400">
          FI
        </div>
        <div className="min-w-0">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">FI OS</p>
          <p className="truncate text-sm font-semibold text-slate-50">{brandName}</p>
        </div>
      </Link>
    ) : (
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-3">
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
      <div className="mt-2 flex justify-center rounded-xl border border-white/[0.06] bg-black/20 py-2">
        <BrandLogoImage
          logoUrl={effective.logo_url}
          alt={brandName}
          width={120}
          height={36}
          className="h-8 w-auto max-w-[140px] object-contain opacity-90"
        />
      </div>
    ) : null;

  if (variant === "drawer") {
    return (
      <div className={fiOsChromeClasses.sidebarDrawer}>
        {brandBlock}
        <FiOsModuleNav items={navItems} activeId={activeNavId} onNavigate={onNavigate} dense={dense} />
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
      <div className="relative flex min-h-0 flex-1 flex-col px-2.5">
        {brandBlock}
        {logoStrip}
        <FiOsModuleNav items={navItems} activeId={activeNavId} onNavigate={onNavigate} dense={dense} />
      </div>
    </aside>
  );
}
