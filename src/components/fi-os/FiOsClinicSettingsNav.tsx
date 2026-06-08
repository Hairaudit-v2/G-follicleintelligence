"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

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
}: {
  tenantId: string;
  showStaffAndServicesNav: boolean;
  showAdminUsersNav: boolean;
  showConfigurationHubNav?: boolean;
  showTaxLocalisationSettingsNav?: boolean;
  showRemindersSettingsNav?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const base = `/fi-admin/${tenantId.trim()}`;
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(configuration|staff|services|settings)(/|$)`);
  if (!re.test(pathname)) return null;

  const linkCls = (href: string) =>
    cn(
      "rounded-md px-2.5 py-1 text-xs font-medium transition",
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
    );

  return (
    <div className="border-b border-white/[0.08] bg-[#060d18]/80 px-3 py-2 sm:px-4">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1.5">
        <span className="pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Clinic settings</span>
        {showConfigurationHubNav ? (
          <Link href={`${base}/configuration`} className={linkCls(`${base}/configuration`)}>
            Configuration
          </Link>
        ) : null}
        {showStaffAndServicesNav ? (
          <>
            <Link href={`${base}/staff`} className={linkCls(`${base}/staff`)}>
              Staff
            </Link>
            <Link href={`${base}/services`} className={linkCls(`${base}/services`)}>
              Services
            </Link>
          </>
        ) : null}
        {showRemindersSettingsNav ? (
          <Link href={`${base}/settings/reminders`} className={linkCls(`${base}/settings/reminders`)}>
            Reminders
          </Link>
        ) : null}
        {showTaxLocalisationSettingsNav ? (
          <Link href={`${base}/settings/tax-localisation`} className={linkCls(`${base}/settings/tax-localisation`)}>
            Tax &amp; Localisation
          </Link>
        ) : null}
        {showAdminUsersNav ? (
          <Link
            href={`${base}/settings/admin-users`}
            className={linkCls(`${base}/settings/admin-users`)}
            title="Manage non-clinical platform access for trusted administrators, finance teams, owners, auditors, and operational staff."
          >
            Admin Users
          </Link>
        ) : null}
      </div>
    </div>
  );
}
