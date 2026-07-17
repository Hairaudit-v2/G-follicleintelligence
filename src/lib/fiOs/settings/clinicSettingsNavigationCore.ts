export const FI_OS_SETTINGS_GROUP_ORDER = [
  "clinic",
  "roles-permissions",
  "templates",
  "integrations",
  "billing",
  "security",
] as const;

export type FiOsSettingsGroupId = (typeof FI_OS_SETTINGS_GROUP_ORDER)[number];

export type FiOsSettingsDestination = {
  id: string;
  label: string;
  href: string;
  /** Contextual destinations stay available but are not treated as primary IA peers. */
  contextual?: boolean;
};

export type FiOsSettingsGroup = {
  id: FiOsSettingsGroupId;
  label: string;
  destinations: FiOsSettingsDestination[];
};

export type BuildFiOsClinicSettingsGroupsOptions = {
  showConfiguration: boolean;
  showClinicOperations: boolean;
  showTemplates: boolean;
  showTaxLocalisation: boolean;
  showBilling: boolean;
  showSecurity: boolean;
  showHubspotImport: boolean;
};

function destination(
  base: string,
  id: string,
  label: string,
  suffix: string,
  opts?: { contextual?: boolean }
): FiOsSettingsDestination {
  return {
    id,
    label,
    href: `${base}/${suffix}`,
    ...(opts?.contextual ? { contextual: true } : {}),
  };
}

/**
 * FI-UX-STRUCTURE-2C.1B — six-group mounted Settings information architecture.
 * FI-UX-STRUCTURE-2C.2 — HubSpot entry via Integrations hub (Config) or canonical
 * HubSpot workspace (CRM-read); temporary HubSpot import peer removed.
 *
 * Groups existing destinations only. Does not change route guards, permissions, or page behaviour
 * beyond session-default tab landing documented in hubspotWorkspaceRoutes.
 */
export function buildFiOsClinicSettingsGroups(
  tenantBase: string,
  options: BuildFiOsClinicSettingsGroupsOptions
): FiOsSettingsGroup[] {
  const base = tenantBase.replace(/\/+$/, "");
  const clinic: FiOsSettingsDestination[] = [];

  if (options.showConfiguration) {
    clinic.push(destination(base, "clinic-configuration", "Configuration", "configuration"));
  }
  if (options.showClinicOperations) {
    clinic.push(
      destination(base, "clinic-services", "Services", "services"),
      destination(base, "clinic-rooms", "Rooms", "rooms"),
      destination(base, "clinic-setup", "Clinic setup", "settings/clinic-setup")
    );
  }
  if (options.showTaxLocalisation) {
    clinic.push(
      destination(
        base,
        "clinic-tax-localisation",
        "Tax & localisation",
        "settings/tax-localisation"
      )
    );
  }
  if (clinic.length > 0) {
    clinic.push(
      destination(base, "clinic-guide", "Clinic guide", "settings/clinic-guide", {
        contextual: true,
      })
    );
  }

  const integrations: FiOsSettingsDestination[] = [];
  if (options.showConfiguration) {
    // Configuration-hub sessions enter HubSpot through Integrations → Manage (all surfaces).
    // Temporary peer "HubSpot import" removed after FI-UX-STRUCTURE-2C.2 parity proof.
    integrations.push(
      destination(base, "integrations", "Integrations", "settings/integrations"),
      destination(
        base,
        "integrations-hairaudit",
        "HairAudit discovery",
        "settings/hairaudit-discovery"
      )
    );
  } else if (options.showHubspotImport) {
    // CRM-read sessions without Configuration hub: single Integrations entry into the
    // canonical HubSpot workspace (session default = import-review).
    integrations.push({
      id: "integrations-hubspot",
      label: "HubSpot",
      href: `${base}/settings/integrations/hubspot?tab=import-review`,
    });
  }

  const groups: FiOsSettingsGroup[] = [];
  if (clinic.length > 0) {
    groups.push({ id: "clinic", label: "Clinic", destinations: clinic });
  }
  if (options.showSecurity) {
    groups.push({
      id: "roles-permissions",
      label: "Roles & permissions",
      destinations: [
        destination(base, "roles-permissions", "Roles & permissions", "settings/staff-access"),
      ],
    });
  }
  if (options.showTemplates) {
    groups.push({
      id: "templates",
      label: "Templates",
      destinations: [destination(base, "templates", "Templates", "settings/templates")],
    });
  }
  if (integrations.length > 0) {
    groups.push({ id: "integrations", label: "Integrations", destinations: integrations });
  }
  if (options.showBilling) {
    groups.push({
      id: "billing",
      label: "Billing",
      destinations: [destination(base, "billing", "Billing", "settings/payments")],
    });
  }
  if (options.showSecurity) {
    groups.push({
      id: "security",
      label: "Security",
      destinations: [destination(base, "security", "Security", "settings/admin-users")],
    });
  }

  return groups;
}

export function primaryFiOsSettingsDestinations(
  group: FiOsSettingsGroup
): FiOsSettingsDestination[] {
  return group.destinations.filter((item) => !item.contextual);
}

export function isFiOsSettingsDestinationActive(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  const target = href.split("?")[0]!.replace(/\/+$/, "");
  return path === target || path.startsWith(`${target}/`);
}

export function isFiOsSettingsGroupActive(pathname: string, group: FiOsSettingsGroup): boolean {
  return group.destinations.some((item) => isFiOsSettingsDestinationActive(pathname, item.href));
}
