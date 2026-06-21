"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { FI_ADMIN_NEUTRAL_ACCENT, safeBrandingColourHex } from "@/src/lib/fi/foundation/brandingCss";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import { buildFiOsWorkspaceFocusLine } from "@/src/lib/fi-os/fiOsWorkspaceFocusCopy";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import { CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT } from "@/src/lib/fiAdmin/clinicOsShellSearchEvent";
import { CLINIC_OS_OPEN_CREATE_LEAD_EVENT } from "@/src/lib/fiAdmin/clinicOsShellCreateLeadEvent";

import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { ClinicOsGlobalSearch } from "@/src/components/fi-admin/search/ClinicOsGlobalSearch";
import { FiOsClinicSettingsNav } from "@/src/components/fi-os/FiOsClinicSettingsNav";
import { FiOsCreateLeadModal } from "@/src/components/fi-os/FiOsCreateLeadModal";
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
  showTaxLocalisationSettingsNav = true,
  showRemindersSettingsNav = true,
  showAuditOsNav = true,
  showConfigurationHubNav = true,
  showFiPaymentsInboxNav = false,
  showHrOsNav = false,
  workspaceProfileKey = "default",
  featureAccess = null,
  effective,
  userEmail,
  impersonationDisplayName,
  showFiPlatformSystemLink = false,
  staffPinSessionLabel = null,
  staffPinLogoutTenantId = null,
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
  /** Admin Users settings link (`manage_admin_users` capability or legacy super-roles). */
  showAdminUsersNav?: boolean;
  /** Tax & localisation settings link (finance capability or clinical member). */
  showTaxLocalisationSettingsNav?: boolean;
  /** Reminder templates settings link (`manage_operations` or clinical member). */
  showRemindersSettingsNav?: boolean;
  /** AuditOS primary nav (`view_security_audit` or clinical member). */
  showAuditOsNav?: boolean;
  /** `/configuration` hub link in primary sidebar. */
  showConfigurationHubNav?: boolean;
  /** RevenueOS payments inbox (`/payments`) when `FI_PAYMENTS_ENABLED` is true. */
  showFiPaymentsInboxNav?: boolean;
  /** HR OS primary nav when tenant entitlement + role allow. */
  showHrOsNav?: boolean;
  /** Stage UI activation — workspace persona for nav emphasis (does not bypass Stage 2). */
  workspaceProfileKey?: FiWorkspaceProfileKey;
  /** Stage 2: serialized feature map; null skips clinic-settings strip filtering. */
  featureAccess?: Partial<Record<FiFeatureKey, boolean>> | null;
  effective: EffectiveBranding;
  userEmail: string | null;
  impersonationDisplayName?: string | null;
  showFiPlatformSystemLink?: boolean;
  /** Limited clinic-floor PIN session label in the top bar. */
  staffPinSessionLabel?: string | null;
  staffPinLogoutTenantId?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isCalendarMainLocked = useMemo(() => isFiOsTenantCalendarPath(pathname), [pathname]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const quickCreateOpenRef = useRef(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [kbdHint, setKbdHint] = useState("Ctrl+K");
  const [quickCreateKbdHint, setQuickCreateKbdHint] = useState("Ctrl+Shift+K");

  const accent = safeBrandingColourHex(effective.accent_colour, FI_ADMIN_NEUTRAL_ACCENT);
  const brandName = effective.brand_name?.trim() || "Follicle Intelligence";
  const clinicLabel =
    effective.clinic_display_name?.trim() || effective.brand_name?.trim() || "Clinic workspace";

  const featureAccessMap = useMemo(() => {
    if (!featureAccess) return null;
    return applyPartialFeatureOverrides(
      buildDefaultFeatureAccessAllEnabled(),
      featureAccess as Partial<Record<FiFeatureKey, boolean>>
    );
  }, [featureAccess]);

  const sidebarItems = useMemo(() => {
    const raw = resolveFiOsPrimarySidebarItems(
      base,
      showCrmNav,
      showBookingsBoard,
      tenantBackendAdminRole ?? null,
      showAuditOsNav,
      showConfigurationHubNav,
      showFiPaymentsInboxNav,
      showHrOsNav
    );
    return filterFiOsPrimarySidebarItemsByFeatureAccess(raw, featureAccessMap);
  }, [
    base,
    showCrmNav,
    showBookingsBoard,
    tenantBackendAdminRole,
    showAuditOsNav,
    showConfigurationHubNav,
    showFiPaymentsInboxNav,
    showHrOsNav,
    featureAccessMap,
  ]);

  const sidebarSections = useMemo(
    () => buildFiOsSidebarWorkflowSections(sidebarItems, workspaceProfileKey),
    [sidebarItems, workspaceProfileKey]
  );

  const workspaceFocusLine = useMemo(
    () => buildFiOsWorkspaceFocusLine({ workspaceProfile: workspaceProfileKey, featureAccess: featureAccessMap }),
    [workspaceProfileKey, featureAccessMap]
  );
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
    function onOpenCreateLeadEvent() {
      setCreateLeadOpen(true);
    }
    window.addEventListener(CLINIC_OS_OPEN_CREATE_LEAD_EVENT, onOpenCreateLeadEvent);
    return () => window.removeEventListener(CLINIC_OS_OPEN_CREATE_LEAD_EVENT, onOpenCreateLeadEvent);
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
          navSections={sidebarSections}
          activeNavId={activeSidebarId}
          pathname={pathname}
        />

        <div className={fiOsChromeClasses.mainColumn}>
          <FiOsTopBar
            tenantId={tenantId}
            clinicLabel={clinicLabel}
            accentHex={accent}
            workspaceProfileKey={workspaceProfileKey}
            workspaceFocusLine={workspaceFocusLine}
            userEmail={userEmail}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            kbdHint={kbdHint}
            quickCreateKbdHint={quickCreateKbdHint}
            onOpenMobileNav={() => setMobileNav(true)}
            onOpenQuickCreate={() => setQuickCreateOpen(true)}
            impersonationDisplayName={impersonationDisplayName ?? null}
            showFiPlatformSystemLink={showFiPlatformSystemLink}
            staffPinSessionLabel={staffPinSessionLabel}
            staffPinLogoutTenantId={staffPinLogoutTenantId}
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
              showConfigurationHubNav={showConfigurationHubNav}
              showTaxLocalisationSettingsNav={showTaxLocalisationSettingsNav}
              showRemindersSettingsNav={showRemindersSettingsNav}
              featureAccess={featureAccess}
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
            navSections={sidebarSections}
            activeNavId={activeSidebarId}
            pathname={pathname}
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
        onOpenCreateLead={() => setCreateLeadOpen(true)}
      />

      {showCrmNav ? (
        <FiOsCreateLeadModal tenantId={tenantId} open={createLeadOpen} onOpenChange={setCreateLeadOpen} />
      ) : null}
    </div>
  );
}
