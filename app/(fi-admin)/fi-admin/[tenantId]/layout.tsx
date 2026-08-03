import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { fiAdminAmbientBackgroundStyle } from "@/src/components/fi-admin/dashboard-ui";
import { FiOsAppShell } from "@/src/components/fi-os/FiOsAppShell";
import { GuidedAssistMount } from "@/src/components/onboarding-os/GuidedAssistMount";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { buildNormalizedBrandingCssVariables } from "@/src/lib/fi/foundation/brandingCss";
import type { EffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { resolveEffectiveBranding } from "@/src/lib/fi/foundation/tenantSettings";
import { normalizeEffectiveBrandingForShell } from "@/src/lib/fi/foundation/tenantBrandingResolver.server";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { emptyNormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadHubspotInboxSummary } from "@/src/lib/onboarding-os/hubspotInboxSummary.server";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  resolveFiOsAuthUserDisplayNameById,
  resolveFiOsAuthUserEmail,
} from "@/src/lib/fiOs/fiOsAuthDisplay.server";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import {
  assertFiTenantExists,
  assertFiTenantPortalAccess,
} from "@/src/lib/fiOs/fiOsPortalGate.server";
import { isStaffPinRestrictedRoute } from "@/src/lib/staffPin/staffPinPermissions";
import { getStaffPinClinicSessionIfValid } from "@/src/lib/staffPin/staffPinSession.server";
import { loadPinBreakSessionState } from "@/src/lib/workforce/staffTimeClock.server";
import { loadWorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicy.server";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { loadFiOsFeatureAccessMapOrNullForViewer } from "@/src/lib/fi-os/featureAccess.server";
import { getStaffAccessNavFeatureOverrides } from "@/src/lib/staffAccess/staffAccess.server";
import { resolveTeamWorkspaceAccessForViewer } from "@/src/lib/staffAccess/staffTeamAccess.server";
import { enforceFiFeatureRouteOrRedirect } from "@/src/lib/fi-os/featureRouteGuard.server";
import { loadWorkspaceProfileKeyForViewer } from "@/src/lib/fi-os/workspaceProfile.server";
import { loadHrOsNavVisibleForViewer } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { loadTrichoscopyNavVisibleForViewer } from "@/src/lib/platform/entitlements/trichoscopyRouteGate.server";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";
import { readFiProcedureDayEnabled } from "@/src/lib/procedureDay/procedureDayEnv.server";
import { readFiStaffUatModeEnabled } from "@/src/lib/fiOs/staffUatEnv.server";
import { StaffUatLayoutMount } from "@/src/components/fi-admin/staff-uat/StaffUatLayoutMount";
import { isFiAdminTokenPublicRoute } from "@/src/lib/fiOs/fiAdminPublicRoutesCore";
import { TenantBrandedSurface } from "@/src/components/brand/TenantBrandedSurface";
import { isNavCollapseEnabledForTenant } from "@/src/lib/fiOs/navCollapseRollout.server";
import { canViewFiOsNavigationAudit } from "@/src/lib/fiOs/navigation/fiOsNavigationAuditAccess.server";
import { isWorkspaceShellEnabledForTenant } from "@/src/lib/fiOs/workspaceShell/workspaceShellRollout.server";
import { WorkspaceShellMount } from "@/src/components/fi-os/workspace/WorkspaceShellMount";
import { isGlobalCommandCentrePresentationPath } from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentrePresentationModel";
import { isFiOsTenantCalendarPath } from "@/src/lib/fiAdmin/fiOsTenantCalendarRoute";
import {
  canAccessTenantReminderSettings,
  canManageTenantAdminUsersRoute,
  canViewSecurityAuditNav,
  canViewTaxLocalisationRoute,
  canViewTenantConfigurationHub,
  loadActiveTenantAdminProfileForSession,
} from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { resolvePilotControlPageAccess } from "@/src/lib/pilotControl/ui/pilotControlPageAccess.server";

const NEUTRAL_EFFECTIVE: EffectiveBranding = {
  brand_name: null,
  logo_url: null,
  primary_colour: null,
  secondary_colour: null,
  accent_colour: null,
  support_email: null,
  default_timezone: null,
  website_url: null,
  clinic_display_name: null,
  booking_url: null,
  public_intake_url: null,
  clinic_phone: null,
  clinic_email: null,
  address: null,
  clinic_timezone: null,
};

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const base = `/fi-admin/${tenantId}`;
  const pathname = headers().get("x-pathname") ?? "";
  const isStaffPinLogin =
    pathname.includes("/staff-pin-login") || pathname.includes("/staff-time-clock");
  const isTokenPublicRoute = isFiAdminTokenPublicRoute(pathname);
  const isCommandCentrePresentation = isGlobalCommandCentrePresentationPath(pathname);
  const workspaceShellEnabled = isWorkspaceShellEnabledForTenant(tenantId);
  const navCollapseActive = isNavCollapseEnabledForTenant(tenantId);
  const pinSession = isStaffPinLogin ? null : await getStaffPinClinicSessionIfValid(tenantId);

  let effective: EffectiveBranding = NEUTRAL_EFFECTIVE;
  let branding: NormalizedTenantBranding = emptyNormalizedTenantBranding();
  try {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ) {
      effective = await resolveEffectiveBranding({ tenantId });
      branding = await normalizeEffectiveBrandingForShell(tenantId, effective);
    }
  } catch {
    effective = NEUTRAL_EFFECTIVE;
    branding = emptyNormalizedTenantBranding();
  }

  if (isCommandCentrePresentation) {
    if (pinSession) {
      await assertFiTenantExists(tenantId);
    } else {
      await assertFiTenantPortalAccess(tenantId);
    }
    return <div className="min-h-[100dvh] bg-[#03060d]">{children}</div>;
  }

  if (isStaffPinLogin || isTokenPublicRoute) {
    await assertFiTenantExists(tenantId);
    return (
      <TenantBrandedSurface branding={branding} className="min-h-[100dvh]">
        {children}
      </TenantBrandedSurface>
    );
  }

  if (pinSession) {
    await assertFiTenantExists(tenantId);
    if (isStaffPinRestrictedRoute(pathname, base)) {
      redirect(`${base}/calendar`);
    }
  } else {
    await assertFiTenantPortalAccess(tenantId);
  }

  await enforceFiFeatureRouteOrRedirect({
    tenantId,
    pathname,
    tenantBase: base,
    pinFloorMode: Boolean(pinSession),
  });

  const sessionAuthId = await resolveAuthUserId(null);
  let impersonationDisplayName: string | null = null;
  let showFiPlatformSystemLink = false;
  if (sessionAuthId) {
    const os = await loadFiOsIdentity(sessionAuthId);
    showFiPlatformSystemLink = Boolean(os && isFiOsPlatformAdminRole(os.osRole));
    const target = await getFiOsImpersonationTargetAuthUserId(sessionAuthId);
    if (target) {
      impersonationDisplayName = await resolveFiOsAuthUserDisplayNameById(target);
    }
  }
  const pinFloorMode = Boolean(pinSession);
  const timeClockPolicy = pinSession ? await loadWorkforceTimeClockPolicy(tenantId) : null;
  const pinBreakState =
    pinSession && timeClockPolicy?.breaksEnabled
      ? await loadPinBreakSessionState(tenantId, pinSession.staffId)
      : null;
  const [
    showCrmNav,
    showBookingsBoard,
    userEmail,
    showAdminUsersNav,
    adminProf,
    showTaxLocalisationSettingsNav,
    showRemindersSettingsNav,
    showAuditOsNav,
    showConfigurationHubNav,
    featureAccessMap,
    workspaceProfileKey,
    showHrOsNav,
    showTrichoscopyNav,
  ] = pinFloorMode
    ? [
        false,
        true,
        pinSession!.staffName,
        false,
        null,
        false,
        false,
        false,
        false,
        null,
        "default" as const,
        false,
        false,
      ]
    : await Promise.all([
        getCrmShellNavAllowed(tenantId),
        getBookingsBoardNavAllowed(tenantId),
        resolveFiOsAuthUserEmail(),
        canManageTenantAdminUsersRoute(tenantId),
        sessionAuthId
          ? loadActiveTenantAdminProfileForSession(tenantId, sessionAuthId)
          : Promise.resolve(null),
        canViewTaxLocalisationRoute(tenantId),
        canAccessTenantReminderSettings(tenantId),
        canViewSecurityAuditNav(tenantId),
        canViewTenantConfigurationHub(tenantId),
        loadFiOsFeatureAccessMapOrNullForViewer(tenantId),
        loadWorkspaceProfileKeyForViewer(tenantId),
        loadHrOsNavVisibleForViewer(tenantId),
        loadTrichoscopyNavVisibleForViewer(tenantId),
      ]);
  const tenantBackendAdminRole = pinFloorMode ? null : (adminProf?.adminRole ?? null);
  const showStaffAndServicesNav = pinFloorMode ? false : showCrmNav || showBookingsBoard;
  const showNavigationAdminSurfaces = pinFloorMode
    ? false
    : await canViewFiOsNavigationAudit(tenantId);

  let featureAccessRecord =
    pinFloorMode || !featureAccessMap
      ? null
      : (Object.fromEntries(featureAccessMap) as Record<FiFeatureKey, boolean>);

  // SA-1: overlay adaptive staff entitlements onto nav visibility (server-resolved). Blocked
  // modules are also excluded from navigation; route guards remain the authoritative enforcement.
  if (!pinFloorMode) {
    const staffNavOverrides = await getStaffAccessNavFeatureOverrides(tenantId);
    if (staffNavOverrides) {
      featureAccessRecord = {
        ...(featureAccessRecord ?? {}),
        ...(staffNavOverrides as Partial<Record<FiFeatureKey, boolean>>),
      } as Record<FiFeatureKey, boolean>;
    }
  }

  const showFiPaymentsInboxNav = pinFloorMode ? false : readFiPaymentsEnabled();
  const showProcedureDayNav = pinFloorMode ? false : readFiProcedureDayEnabled();
  const showPilotControlNav = pinFloorMode
    ? false
    : (await resolvePilotControlPageAccess(tenantId).catch(() => ({
        allowed: false as const,
        reason: "forbidden" as const,
      }))).allowed;
  const inboxSummary =
    pinFloorMode || !showCrmNav
      ? { isConnected: false, pendingCount: 0, integrationId: null }
      : await loadHubspotInboxSummary(tenantId);
  const teamWorkspaceAccess = pinFloorMode
    ? null
    : await resolveTeamWorkspaceAccessForViewer(tenantId);
  const visibleTeamTabIds =
    teamWorkspaceAccess?.allowed === true ? teamWorkspaceAccess.tabAccess.visibleTabIds : undefined;
  const staffUatModeEnabled = readFiStaffUatModeEnabled();
  const staffUatRole = pinFloorMode
    ? "receptionist_pin"
    : tenantBackendAdminRole?.trim() || "clinic_staff";

  const isCalendarFillSurface = isFiOsTenantCalendarPath(pathname);

  const mainSurface = (
    <div
      className={cn(
        fiOsChromeClasses.tenantMainSurface,
        isCalendarFillSurface
          ? fiOsChromeClasses.tenantMainSurfaceFill
          : fiOsChromeClasses.tenantMainSurfaceScroll
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.38]"
        style={fiAdminAmbientBackgroundStyle}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1528]/45 via-transparent to-[#02060d]/85"
        aria-hidden
      />
      <div
        className={cn(
          fiOsChromeClasses.tenantMainSurfaceInnerPad,
          isCalendarFillSurface
            ? fiOsChromeClasses.tenantMainSurfaceInnerFill
            : fiOsChromeClasses.tenantMainSurfaceInnerScroll
        )}
      >
        <StaffUatLayoutMount tenantId={tenantId} role={staffUatRole} enabled={staffUatModeEnabled}>
          {workspaceShellEnabled ? (
            <WorkspaceShellMount tenantId={tenantId}>{children}</WorkspaceShellMount>
          ) : (
            children
          )}
        </StaffUatLayoutMount>
      </div>
    </div>
  );

  return (
    <div style={buildNormalizedBrandingCssVariables(branding)}>
      <FiOsAppShell
        tenantId={tenantId}
        base={base}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
        tenantBackendAdminRole={tenantBackendAdminRole}
        showStaffAndServicesNav={showStaffAndServicesNav}
        showAdminUsersNav={showAdminUsersNav}
        showTaxLocalisationSettingsNav={showTaxLocalisationSettingsNav}
        showRemindersSettingsNav={showRemindersSettingsNav}
        showAuditOsNav={showAuditOsNav}
        showConfigurationHubNav={showConfigurationHubNav}
        showHubspotImportNav={showCrmNav}
        showFiPaymentsInboxNav={showFiPaymentsInboxNav}
        showProcedureDayNav={showProcedureDayNav}
        showHrOsNav={showHrOsNav}
        showTrichoscopyNav={showTrichoscopyNav}
        visibleTeamTabIds={visibleTeamTabIds}
        workspaceProfileKey={workspaceProfileKey}
        featureAccess={featureAccessRecord}
        effective={effective}
        branding={branding}
        userEmail={userEmail}
        impersonationDisplayName={impersonationDisplayName}
        showFiPlatformSystemLink={pinFloorMode ? false : showFiPlatformSystemLink}
        staffPinSessionLabel={pinFloorMode ? `${pinSession!.staffName} · PIN session` : null}
        staffPinLogoutTenantId={pinFloorMode ? tenantId : null}
        staffPinOnBreak={pinBreakState?.onBreak ?? false}
        staffPinBreaksEnabled={timeClockPolicy?.breaksEnabled ?? false}
        navCollapseActive={navCollapseActive}
        showNavigationAdminSurfaces={showNavigationAdminSurfaces}
        showPilotControlNav={showPilotControlNav}
        inboxPendingCount={inboxSummary.pendingCount}
      >
        {mainSurface}
        {!pinFloorMode && !isCommandCentrePresentation ? (
          <GuidedAssistMount tenantId={tenantId} />
        ) : null}
      </FiOsAppShell>
    </div>
  );
}
