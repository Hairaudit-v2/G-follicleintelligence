"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";

function featureOn(access: ReadonlyMap<FiFeatureKey, boolean> | null, key: FiFeatureKey): boolean {
  if (!access) return true;
  return access.get(key) !== false;
}

/**
 * Secondary strip for clinic settings routes (Configuration, Staff, Services, Reminders, Tax & localisation, Admin Users).
 */
export function FiOsClinicSettingsNav({
  tenantId,
  showStaffAndServicesNav,
  showAdminUsersNav,
  showConfigurationHubNav = true,
  showTaxLocalisationSettingsNav = true,
  showRemindersSettingsNav = true,
  featureAccess: featureAccessProp = null,
}: {
  tenantId: string;
  showStaffAndServicesNav: boolean;
  showAdminUsersNav: boolean;
  showConfigurationHubNav?: boolean;
  showTaxLocalisationSettingsNav?: boolean;
  showRemindersSettingsNav?: boolean;
  featureAccess?: Partial<Record<FiFeatureKey, boolean>> | null;
}) {
  const pathname = usePathname() ?? "";
  const base = `/fi-admin/${tenantId.trim()}`;
  const re = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(configuration|staff|services|settings|rooms)(/|$)`
  );

  const featureAccess = useMemo(() => {
    if (!featureAccessProp) return null;
    return applyPartialFeatureOverrides(
      buildDefaultFeatureAccessAllEnabled(),
      featureAccessProp as Partial<Record<FiFeatureKey, boolean>>
    );
  }, [featureAccessProp]);

  if (!re.test(pathname)) return null;

  const linkCls = (href: string) =>
    cn(
      "rounded-md px-2.5 py-1 text-xs font-medium transition",
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
    );

  const showConfiguration = showConfigurationHubNav && featureOn(featureAccess, "settings");
  const showStaffLink = showStaffAndServicesNav && featureOn(featureAccess, "staff");
  const showServicesBlock = showStaffAndServicesNav && featureOn(featureAccess, "settings");
  const showReminders = showRemindersSettingsNav && featureOn(featureAccess, "settings");
  const showTax = showTaxLocalisationSettingsNav && featureOn(featureAccess, "settings");
  const showAdminUsers = showAdminUsersNav && featureOn(featureAccess, "settings");
  const showHubspot = showConfigurationHubNav && featureOn(featureAccess, "crm") && featureOn(featureAccess, "settings");

  if (!showConfiguration && !showStaffLink && !showServicesBlock && !showReminders && !showTax && !showAdminUsers && !showHubspot) {
    return null;
  }

  return (
    <div className="border-b border-white/[0.08] bg-[#060d18]/80 px-3 py-2 sm:px-4">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1.5">
        <span className="pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Clinic settings</span>
        {showConfiguration ? (
          <Link href={`${base}/configuration`} className={linkCls(`${base}/configuration`)}>
            Configuration
          </Link>
        ) : null}
        {showStaffLink ? (
          <Link href={`${base}/staff`} className={linkCls(`${base}/staff`)}>
            Staff
          </Link>
        ) : null}
        {showServicesBlock ? (
          <>
            <Link href={`${base}/services`} className={linkCls(`${base}/services`)}>
              Services
            </Link>
            <Link href={`${base}/rooms`} className={linkCls(`${base}/rooms`)}>
              Rooms
            </Link>
            <Link href={`${base}/settings/clinic-setup`} className={linkCls(`${base}/settings/clinic-setup`)}>
              Clinic setup
            </Link>
          </>
        ) : null}
        {showReminders ? (
          <Link href={`${base}/settings/reminders`} className={linkCls(`${base}/settings/reminders`)}>
            Reminders
          </Link>
        ) : null}
        {showTax ? (
          <Link href={`${base}/settings/tax-localisation`} className={linkCls(`${base}/settings/tax-localisation`)}>
            Tax &amp; Localisation
          </Link>
        ) : null}
        {(showReminders || showTax) ? (
          <Link href={`${base}/settings/payments`} className={linkCls(`${base}/settings/payments`)}>
            Payments
          </Link>
        ) : null}
        {showAdminUsers ? (
          <Link
            href={`${base}/settings/admin-users`}
            className={linkCls(`${base}/settings/admin-users`)}
            title="Manage non-clinical platform access for trusted administrators, finance teams, owners, auditors, and operational staff."
          >
            Admin Users
          </Link>
        ) : null}
        {showHubspot ? (
          <Link href={`${base}/settings/imports/hubspot`} className={linkCls(`${base}/settings/imports/hubspot`)}>
            HubSpot import
          </Link>
        ) : null}
      </div>
    </div>
  );
}
