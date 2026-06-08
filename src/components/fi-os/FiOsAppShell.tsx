"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { FI_ADMIN_NEUTRAL_ACCENT, safeBrandingColourHex } from "@/src/lib/fi/foundation/brandingCss";
import { getFiOsShellActiveSidebarId, resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import { CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT } from "@/src/lib/fiAdmin/clinicOsShellSearchEvent";

import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { ClinicOsGlobalSearch } from "@/src/components/fi-admin/search/ClinicOsGlobalSearch";
import { FiOsClinicSettingsNav } from "@/src/components/fi-os/FiOsClinicSettingsNav";
import { FiOsQuickCreatePalette } from "@/src/components/fi-os/FiOsQuickCreatePalette";
import { FiOsSidebar } from "@/src/components/fi-os/FiOsSidebar";
import { FiOsTopBar } from "@/src/components/fi-os/FiOsTopBar";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { cn } from "@/lib/utils";

/**
 * Authenticated FI OS workspace chrome: fixed primary rail, sticky command bar, scrollable main.
 * Visual language aligns with `FiOsLoginScreen` + `fiOsDesignTokens` / `fiOsChromeClasses`.
 */
export function FiOsAppShell({
  tenantId,
  base,
  showCrmNav,
  showBookingsBoard = showCrmNav,
  tenantBackendAdminRole = null,
  showStaffAndServicesNav = false,
  showAdminUsersNav = false,
  effective,
  userEmail,
  impersonationDisplayName,
  showFiPlatformSystemLink = false,
  children,
}: {
  tenantId: string;
  base: string;
  showCrmNav: boolean;
  showBookingsBoard?: boolean;
  /** Active fi_tenant_admin_users role for sidebar clinical gating (non-clinical personas). */
  tenantBackendAdminRole?: FiTenantAdminRole | null;
  /** Staff + Services settings links (CRM shell or bookings operator). */
  showStaffAndServicesNav?: boolean;
  /** Admin Users settings link (clinic_admin / legacy tenant admins). */
  showAdminUsersNav?: boolean;
  effective: EffectiveBranding;
  userEmail: string | null;
  impersonationDisplayName?: string | null;
  showFiPlatformSystemLink?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isCalendarMainLocked = useMemo(() => isFiOsTenantCalendarPath(pathname), [pathname]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateOpenRef = useRef(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [kbdHint, setKbdHint] = useState("Ctrl+K");
  const [quickCreateKbdHint, setQuickCreateKbdHint] = useState("Ctrl+Shift+K");

  const accent = safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT);
  const brandName = effective.brand_name?.trim() || "Follicle Intelligence";
  const clinicLabel =
    effective.clinic_display_name?.trim() || effective.brand_name?.trim() || "Clinic workspace";

  const sidebarItems = resolveFiOsPrimarySidebarItems(base, showCrmNav, showBookingsBoard, tenantBackendAdminRole ?? null);
  const activeSidebarId = getFiOsShellActiveSidebarId(pathname, base);
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const pf = typeof navigator !== "undefined" ? navigator.platform : "";
    const apple = /Mac|iPhone|iPad|iPod/i.test(pf) || /Mac OS/.test(ua);
    setKbdHint(apple ? "⌘K" : "Ctrl+K");
    setQuickCreateKbdHint(apple ? "⇧⌘K" : "Ctrl+Shift+K");
  }, []);

  useEffect(() => {
    quickCreateOpenRef.current = quickCreateOpen;
  }, [quickCreateOpen]);

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setQuickCreateOpen(true);
        return;
      }
      if (mod && (e.key === "k" || e.key === "K") && !e.shiftKey) {
        if (quickCreateOpenRef.current) return;
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  useEffect(() => {
    function onOpenSearchEvent() {
      setSearchOpen(true);
    }
    window.addEventListener(CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT, onOpenSearchEvent);
    return () => window.removeEventListener(CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT, onOpenSearchEvent);
  }, []);

  useEffect(() => {
    if (!mobileNav && !quickCreateOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNav, quickCreateOpen]);

  const closeMobile = () => setMobileNav(false);

  return (
    <div className={fiOsChromeClasses.shellRoot}>
      <div className={fiOsChromeClasses.shellBody}>
        <FiOsSidebar
          variant="rail"
          brandName={brandName}
          effective={effective}
          navItems={sidebarItems}
          activeNavId={activeSidebarId}
        />

        <div className={fiOsChromeClasses.mainColumn}>
          <FiOsTopBar
            tenantId={tenantId}
            clinicLabel={clinicLabel}
            accentHex={accent}
            userEmail={userEmail}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            kbdHint={kbdHint}
            quickCreateKbdHint={quickCreateKbdHint}
            onOpenMobileNav={() => setMobileNav(true)}
            onOpenQuickCreate={() => setQuickCreateOpen(true)}
            impersonationDisplayName={impersonationDisplayName ?? null}
            showFiPlatformSystemLink={showFiPlatformSystemLink}
          />
          <main
            className={cn(
              isCalendarMainLocked ? fiOsChromeClasses.mainScrollCalendarLock : fiOsChromeClasses.mainScroll,
              "flex min-h-0 flex-col"
            )}
          >
            <FiOsClinicSettingsNav
              tenantId={tenantId}
              showStaffAndServicesNav={showStaffAndServicesNav}
              showAdminUsersNav={showAdminUsersNav}
            />
            {children}
          </main>
        </div>
      </div>

      {mobileNav ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="FI OS navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={closeMobile}
          />
          <FiOsSidebar
            variant="drawer"
            brandName={brandName}
            effective={effective}
            navItems={sidebarItems}
            activeNavId={activeSidebarId}
            onNavigate={closeMobile}
            dense
            onDrawerClose={closeMobile}
          />
        </div>
      ) : null}

      <ClinicOsGlobalSearch
        tenantId={tenantId}
        base={base}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />

      <FiOsQuickCreatePalette
        tenantId={tenantId}
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
      />
    </div>
  );
}
