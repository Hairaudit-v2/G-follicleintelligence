"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiOsTeamTabId } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import { buildFiOsWorkspaceFocusLine } from "@/src/lib/fi-os/fiOsWorkspaceFocusCopy";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  getFiOsMinimalNavActiveId,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import { CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT } from "@/src/lib/fiAdmin/clinicOsShellSearchEvent";
import { CLINIC_OS_OPEN_CREATE_LEAD_EVENT } from "@/src/lib/fiAdmin/clinicOsShellCreateLeadEvent";

import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { ClinicOsGlobalSearch } from "@/src/components/fi-admin/search/ClinicOsGlobalSearch";
import { FiOsClinicSettingsNav } from "@/src/components/fi-os/FiOsClinicSettingsNav";
import { NewEnquiryDialog } from "@/src/components/fi-admin/leadflow/NewEnquiryDialog";
import { FiOsQuickCreatePalette } from "@/src/components/fi-os/FiOsQuickCreatePalette";
import { FiOsSidebar } from "@/src/components/fi-os/FiOsSidebar";
import { FiOsMinimalNavRail, FiOsMobileBottomNav } from "@/src/components/fi-os/FiOsMinimalNav";
import { FiOsMoreNavDrawer } from "@/src/components/fi-os/FiOsMoreNavDrawer";
import { FiOsSkipLink } from "@/src/components/fi-os/FiOsSkipLink";
import { FiOsTopBar } from "@/src/components/fi-os/FiOsTopBar";
import { fiOsChromeClasses, buildFiOsChromeViewportStyle } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  FiOsNavigationPendingProvider,
  FiOsNavigationProgressStrip,
  useFiOsNavigationPending,
} from "@/src/components/fi-os/FiOsNavigationPendingProvider";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/src/lib/dom/useBodyScrollLock";

/**
 * Authenticated FI OS workspace chrome: fixed primary rail, sticky command bar, scrollable main.
 * Visual language aligns with `FiOsLoginScreen` + `fiOsDesignTokens` / `fiOsChromeClasses`.
 */
export function FiOsAppShell(props: FiOsAppShellProps) {
  return (
    <Suspense fallback={<FiOsAppShellBody {...props} navigationPendingEnabled={false} />}>
      <FiOsNavigationPendingProvider>
        <FiOsAppShellBody {...props} navigationPendingEnabled />
      </FiOsNavigationPendingProvider>
    </Suspense>
  );
}

type FiOsAppShellProps = {
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
  /** Quality review primary nav (`view_security_audit` or clinical member). */
  showAuditOsNav?: boolean;
  /** `/configuration` hub link in primary sidebar. */
  showConfigurationHubNav?: boolean;
  /** Payments payments inbox (`/payments`) when `FI_PAYMENTS_ENABLED` is true. */
  showFiPaymentsInboxNav?: boolean;
  /** Surgery day board (`/procedure-day`) when `FI_PROCEDURE_DAY_ENABLED` is true. */
  showProcedureDayNav?: boolean;
  /** HR OS primary nav when tenant entitlement + role allow. */
  showHrOsNav?: boolean;
  /** D6G-G0B: capability-scoped Team tab ids for sidebar/More drawer (overrides showHrOsNav). */
  visibleTeamTabIds?: readonly FiOsTeamTabId[];
  /** Stage UI activation — workspace persona for nav emphasis (does not bypass Stage 2). */
  workspaceProfileKey?: FiWorkspaceProfileKey;
  /** Stage 2: serialized feature map; null skips clinic-settings strip filtering. */
  featureAccess?: Partial<Record<FiFeatureKey, boolean>> | null;
  effective: EffectiveBranding;
  branding: NormalizedTenantBranding;
  userEmail: string | null;
  impersonationDisplayName?: string | null;
  showFiPlatformSystemLink?: boolean;
  /** Limited clinic-floor PIN session label in the top bar. */
  staffPinSessionLabel?: string | null;
  staffPinLogoutTenantId?: string | null;
  staffPinOnBreak?: boolean;
  staffPinBreaksEnabled?: boolean;
  /** D2: Replace legacy sidebar with minimal rail / bottom bar (both rollout flags). */
  navCollapseActive?: boolean;
  /** D6G-B: show D6 /intelligence admin links in Reports section of More drawer. */
  showNavigationAdminSurfaces?: boolean;
  children: ReactNode;
};

function FiOsAppShellBody({
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
  showProcedureDayNav = false,
  showHrOsNav = false,
  visibleTeamTabIds,
  workspaceProfileKey = "default",
  featureAccess = null,
  effective,
  branding,
  userEmail,
  impersonationDisplayName,
  showFiPlatformSystemLink = false,
  staffPinSessionLabel = null,
  staffPinLogoutTenantId = null,
  staffPinOnBreak = false,
  staffPinBreaksEnabled = false,
  navCollapseActive = false,
  showNavigationAdminSurfaces = false,
  children,
  navigationPendingEnabled = true,
}: FiOsAppShellProps & { navigationPendingEnabled?: boolean }) {
  const pathname = usePathname() ?? "";
  const { isNavigationPending, onInternalNavClick } = useFiOsNavigationPending();
  const navigationPending = navigationPendingEnabled && isNavigationPending;
  /** Calendar owns vertical scroll inside `<main>`; FI OS primary rail must stay mounted for module navigation. */
  const isCalendarMainLocked = useMemo(() => isFiOsTenantCalendarPath(pathname), [pathname]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const quickCreateOpenRef = useRef(false);
  const topChromeRef = useRef<HTMLDivElement>(null);
  const bottomChromeRef = useRef<HTMLDivElement>(null);
  const [chromeViewportStyle, setChromeViewportStyle] = useState<CSSProperties>({});
  const [mobileNav, setMobileNav] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);
  const [kbdHint, setKbdHint] = useState("Ctrl+K");
  const [quickCreateKbdHint, setQuickCreateKbdHint] = useState("Ctrl+Shift+K");

  const accent = branding.accentColor;
  const brandName = branding.clinicDisplayName;
  const clinicLabel = branding.clinicDisplayName;

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
      showHrOsNav,
      showProcedureDayNav,
      showNavigationAdminSurfaces,
      showNavigationAdminSurfaces,
      visibleTeamTabIds,
      showNavigationAdminSurfaces
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
    showProcedureDayNav,
    showNavigationAdminSurfaces,
    visibleTeamTabIds,
    featureAccessMap,
  ]);

  const sidebarSections = useMemo(
    () =>
      buildFiOsSidebarWorkflowSections(sidebarItems, workspaceProfileKey, {
        tenantBase: base,
        forCollapsedShell: navCollapseActive,
        showNavigationAdminSurfaces,
        showProcedureDayNav,
        showSurgeryAdminSurfaces: showNavigationAdminSurfaces,
        showTeamAdminSurfaces: showNavigationAdminSurfaces,
        showReportsAdminSurfaces: showNavigationAdminSurfaces,
        showSettingsAdminSurfaces: showNavigationAdminSurfaces,
      }),
    [
      sidebarItems,
      workspaceProfileKey,
      base,
      navCollapseActive,
      showNavigationAdminSurfaces,
      showProcedureDayNav,
    ]
  );

  const workspaceFocusLine = useMemo(
    () =>
      buildFiOsWorkspaceFocusLine({
        workspaceProfile: workspaceProfileKey,
        featureAccess: featureAccessMap,
      }),
    [workspaceProfileKey, featureAccessMap]
  );
  const activeSidebarId = getFiOsShellActiveSidebarId(pathname, base);
  const minimalNavItems = useMemo(
    () => resolveFiOsMinimalNavItems(base, sidebarItems),
    [base, sidebarItems]
  );
  const activeMinimalNavId = navCollapseActive
    ? getFiOsMinimalNavActiveId(pathname, base)
    : null;
  const showLegacySidebar = !navCollapseActive;
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
    return () =>
      window.removeEventListener(CLINIC_OS_OPEN_CREATE_LEAD_EVENT, onOpenCreateLeadEvent);
  }, []);

  // Reference-counted body lock — stacks safely with global search / workspace drawers.
  useBodyScrollLock(mobileNav || quickCreateOpen || moreNavOpen);

  // Soft-nav: always release overlay locks so body never stays stuck after a route change.
  useEffect(() => {
    setMobileNav(false);
    setMoreNavOpen(false);
    setSearchOpen(false);
    setQuickCreateOpen(false);
    setCreateLeadOpen(false);
  }, [pathname]);

  useEffect(() => {
    function measureChromeViewport() {
      const topPx = topChromeRef.current?.getBoundingClientRect().height ?? 0;
      const bottomPx = bottomChromeRef.current?.getBoundingClientRect().height ?? 0;
      setChromeViewportStyle(buildFiOsChromeViewportStyle(topPx, bottomPx));
    }

    measureChromeViewport();
    const ro = new ResizeObserver(measureChromeViewport);
    if (topChromeRef.current) ro.observe(topChromeRef.current);
    if (bottomChromeRef.current) ro.observe(bottomChromeRef.current);
    window.addEventListener("resize", measureChromeViewport);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureChromeViewport);
    };
  }, [navCollapseActive, workspaceFocusLine, staffPinSessionLabel, impersonationDisplayName]);

  const closeMobile = () => setMobileNav(false);
  const closeMoreNav = () => setMoreNavOpen(false);
  const openQuickCreate = () => setQuickCreateOpen(true);
  const openMoreNav = () => setMoreNavOpen(true);

  return (
    <div
      className={cn("fi-os-shell", fiOsChromeClasses.shellRoot)}
      style={chromeViewportStyle}
      data-navigation-pending={navigationPending ? "true" : undefined}
      data-testid="fi-os-shell"
      onClickCapture={navigationPendingEnabled ? onInternalNavClick : undefined}
    >
      <FiOsSkipLink />
      <div className={fiOsChromeClasses.shellBody}>
        {showLegacySidebar ? (
          <FiOsSidebar
            variant="rail"
            brandName={brandName}
            branding={branding}
            effective={effective}
            navSections={sidebarSections}
            activeNavId={activeSidebarId}
            pathname={pathname}
            compactExpandable
            navPersistenceScope={{ tenantId, userEmail }}
          />
        ) : null}

        {navCollapseActive ? (
          <FiOsMinimalNavRail
            items={minimalNavItems}
            activeId={activeMinimalNavId}
            onMore={openMoreNav}
            branding={branding}
            brandName={brandName}
          />
        ) : null}

        <div
          className={cn(
            fiOsChromeClasses.mainColumn,
            navCollapseActive && fiOsChromeClasses.mainColumnMobileBottomNavPad
          )}
        >
          <div ref={topChromeRef} className="relative shrink-0" data-testid="fi-os-top-chrome">
            <FiOsNavigationProgressStrip active={navigationPending} />
            <FiOsTopBar
              tenantId={tenantId}
              clinicLabel={clinicLabel}
              accentHex={accent}
              branding={branding}
              workspaceProfileKey={workspaceProfileKey}
              workspaceFocusLine={workspaceFocusLine}
              userEmail={userEmail}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
              kbdHint={kbdHint}
              quickCreateKbdHint={quickCreateKbdHint}
              onOpenMobileNav={() => setMobileNav(true)}
              onOpenQuickCreate={openQuickCreate}
              hideMobileNav={navCollapseActive}
              compactCreateLabel={navCollapseActive}
              impersonationDisplayName={impersonationDisplayName ?? null}
              showFiPlatformSystemLink={showFiPlatformSystemLink}
              staffPinSessionLabel={staffPinSessionLabel}
              staffPinLogoutTenantId={staffPinLogoutTenantId}
              staffPinOnBreak={staffPinOnBreak}
              staffPinBreaksEnabled={staffPinBreaksEnabled}
            />
          </div>
          <main
            id="fi-os-main-content"
            tabIndex={-1}
            aria-busy={navigationPending || undefined}
            className={cn(
              isCalendarMainLocked
                ? fiOsChromeClasses.mainScrollCalendarLock
                : fiOsChromeClasses.mainScroll,
              !isCalendarMainLocked && fiOsChromeClasses.mainScrollFloatingAssistPad,
              "flex min-h-0 flex-col outline-none"
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

      {showLegacySidebar && mobileNav ? (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="FI OS navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={closeMobile}
          />
          <FiOsSidebar
            variant="drawer"
            brandName={brandName}
            branding={branding}
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

      {navCollapseActive ? (
        <div ref={bottomChromeRef} data-testid="fi-os-bottom-chrome">
          <FiOsMobileBottomNav
            items={minimalNavItems}
            activeId={activeMinimalNavId}
            onMore={openMoreNav}
          />
        </div>
      ) : null}

      <FiOsMoreNavDrawer
        open={navCollapseActive && moreNavOpen}
        brandName={brandName}
        branding={branding}
        effective={effective}
        navSections={sidebarSections}
        activeNavId={activeSidebarId}
        pathname={pathname}
        onClose={closeMoreNav}
        navPersistenceScope={{ tenantId, userEmail }}
      />

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
        <NewEnquiryDialog
          tenantId={tenantId}
          open={createLeadOpen}
          onOpenChange={setCreateLeadOpen}
          showTrigger={false}
        />
      ) : null}
    </div>
  );
}
