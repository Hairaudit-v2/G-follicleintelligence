"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
} from "@/src/config/fiFeatureAccessRegistry";
import {
  buildFiOsClinicSettingsGroups,
  isFiOsSettingsDestinationActive,
  isFiOsSettingsGroupActive,
} from "@/src/lib/fiOs/settings/clinicSettingsNavigationCore";

function featureOn(access: ReadonlyMap<FiFeatureKey, boolean> | null, key: FiFeatureKey): boolean {
  if (!access) return true;
  return access.get(key) !== false;
}

/**
 * Six-group Settings information architecture for mounted clinic settings routes.
 * FI-UX-STRUCTURE-2C.1B groups; FI-UX-STRUCTURE-2C.2 removes temporary HubSpot import peer
 * once Configuration-hub sessions reach all HubSpot surfaces via Integrations → Manage.
 */
export function FiOsClinicSettingsNav({
  tenantId,
  showStaffAndServicesNav,
  showAdminUsersNav,
  showConfigurationHubNav = true,
  showHubspotImportNav = false,
  showTaxLocalisationSettingsNav = true,
  showRemindersSettingsNav = true,
  featureAccess: featureAccessProp = null,
}: {
  tenantId: string;
  showStaffAndServicesNav: boolean;
  showAdminUsersNav: boolean;
  showConfigurationHubNav?: boolean;
  /**
   * CRM-read members without Configuration hub: expose Integrations → canonical HubSpot
   * workspace (import-review). Configuration-hub sessions use Integrations hub instead.
   */
  showHubspotImportNav?: boolean;
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

  const linkCls = (active: boolean) =>
    cn(
      "inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/50",
      active
        ? "fi-tenant-tab-active text-slate-100"
        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
    );

  const showConfiguration = showConfigurationHubNav && featureOn(featureAccess, "settings");
  const showServicesBlock = showStaffAndServicesNav && featureOn(featureAccess, "settings");
  const showReminders = showRemindersSettingsNav && featureOn(featureAccess, "settings");
  const showTax = showTaxLocalisationSettingsNav && featureOn(featureAccess, "settings");
  const showAdminUsers = showAdminUsersNav && featureOn(featureAccess, "settings");
  const showHubspotImport =
    (showConfigurationHubNav &&
      featureOn(featureAccess, "crm") &&
      featureOn(featureAccess, "settings")) ||
    (showHubspotImportNav && featureOn(featureAccess, "crm"));

  const groups = buildFiOsClinicSettingsGroups(base, {
    showConfiguration,
    showClinicOperations: showServicesBlock,
    showTemplates: showReminders,
    showTaxLocalisation: showTax,
    showBilling: showReminders || showTax,
    showSecurity: showAdminUsers,
    showHubspotImport,
  });

  if (groups.length === 0) return null;

  return (
    <nav
      aria-label="Clinic settings"
      className="shrink-0 border-b border-white/[0.08] bg-[#060d18]/80 px-3 py-2 sm:px-4"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1.5">
        <span className="pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Settings
        </span>
        {groups.map((group) => {
          const active = isFiOsSettingsGroupActive(pathname, group);

          if (group.destinations.length === 1) {
            const item = group.destinations[0]!;
            return (
              <Link
                key={group.id}
                href={item.href}
                className={linkCls(active)}
                aria-current={active ? "page" : undefined}
              >
                {group.label}
              </Link>
            );
          }

          return (
            <DropdownMenu key={group.id}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={linkCls(active)}
                  aria-current={active ? "page" : undefined}
                >
                  {group.label}
                  <ChevronDown className="ml-1 h-3 w-3" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {group.destinations.map((item) => {
                  const itemActive = isFiOsSettingsDestinationActive(pathname, item.href);
                  return (
                    <DropdownMenuItem key={item.id} asChild>
                      <Link href={item.href} aria-current={itemActive ? "page" : undefined}>
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </nav>
  );
}
