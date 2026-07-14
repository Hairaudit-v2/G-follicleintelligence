/**
 * FI-UX-REBUILD D6G-C / S3.4D — Front Desk workspace.
 * Visible staff tabs: Today + Tomorrow only. Legacy routes stay catalogued for redirects.
 */

export const FI_OS_FRONT_DESK_NAV_ID = "front-desk" as const;

export type FiOsFrontDeskTabId = "today" | "tomorrow";

export type FiOsFrontDeskTab = {
  id: FiOsFrontDeskTabId;
  label: string;
  /** Path after `/fi-admin/[tenantId]/front-desk`. Empty string is the hub default. */
  segment: string;
  navSubItemId: string;
};

/** Staff-visible Front Desk tabs (exactly two). */
export const FI_OS_FRONT_DESK_TABS: readonly FiOsFrontDeskTab[] = [
  {
    id: "today",
    label: "Today",
    segment: "",
    navSubItemId: "front-desk-today",
  },
  {
    id: "tomorrow",
    label: "Tomorrow",
    segment: "tomorrow",
    navSubItemId: "front-desk-tomorrow",
  },
] as const;

/** Legacy deep-link routes that must remain live (not redirected). */
export const FI_OS_FRONT_DESK_LEGACY_ROUTES = [
  { id: "operations-centre", label: "Clinic flow", suffix: "operations" },
  { id: "reception-os", label: "Front desk", suffix: "reception-os" },
  { id: "reception-board", label: "Reception board", suffix: "reception" },
  { id: "reception-board-command", label: "Front desk", suffix: "reception-board" },
  { id: "tomorrow-board", label: "Tomorrow board", suffix: "tomorrow" },
] as const;

export function buildFiOsFrontDeskBase(tenantId: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/front-desk`;
}

export function buildFiOsFrontDeskTabHref(tenantId: string, tab: FiOsFrontDeskTab): string {
  const base = buildFiOsFrontDeskBase(tenantId);
  return tab.segment ? `${base}/${tab.segment}` : base;
}

export function buildFiOsFrontDeskLegacyHref(tenantId: string, suffix: string): string {
  const tid = tenantId.trim().replace(/\/+$/, "");
  return `/fi-admin/${tid}/${suffix.replace(/^\/+/, "")}`;
}

export function isFiOsFrontDeskConsolidatedPath(pathname: string, tenantBase: string): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === `${base}/front-desk` || path.startsWith(`${base}/front-desk/`);
}

export function resolveFrontDeskTabFromPath(
  pathname: string,
  tenantBase: string
): FiOsFrontDeskTabId | null {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === `${base}/front-desk` || path === `${base}/front-desk/`) {
    return "today";
  }
  if (!path.startsWith(`${base}/front-desk/`)) return null;
  const segment = path.slice(`${base}/front-desk/`.length).split("/")[0] ?? "";
  // Retired hub segments redirect to Today; treat as today for active-state during dual-run.
  if (segment === "clinic-flow" || segment === "reception-board") {
    return "today";
  }
  const tab = FI_OS_FRONT_DESK_TABS.find((t) => t.segment === segment);
  return tab?.id ?? null;
}

export function isFrontDeskTabActive(
  pathname: string,
  tenantBase: string,
  segment: string
): boolean {
  const base = tenantBase.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!segment) {
    return path === `${base}/front-desk` || path === `${base}/front-desk/`;
  }
  return (
    path === `${base}/front-desk/${segment}` || path.startsWith(`${base}/front-desk/${segment}/`)
  );
}

export type FiOsFrontDeskSidebarSubItem = {
  id: string;
  label: string;
  href: string;
  featureKey?: "dashboard" | "calendar";
};

export function buildFrontDeskSidebarSubItems(tenantId: string): FiOsFrontDeskSidebarSubItem[] {
  const tid = tenantId.trim();
  const consolidated = FI_OS_FRONT_DESK_TABS.map((tab) => ({
    id: tab.navSubItemId,
    label: tab.label,
    href: buildFiOsFrontDeskTabHref(tid, tab),
    featureKey: tab.id === "tomorrow" ? ("calendar" as const) : ("dashboard" as const),
  }));
  const legacy = FI_OS_FRONT_DESK_LEGACY_ROUTES.map((route) => ({
    id: route.id,
    label: `${route.label} (direct)`,
    href: buildFiOsFrontDeskLegacyHref(tid, route.suffix),
    featureKey: route.id === "tomorrow-board" ? ("calendar" as const) : ("dashboard" as const),
  }));
  return [...consolidated, ...legacy];
}
