/**
 * FI OS D6G Role Visibility Matrix — Primary Rail + More menu.
 *
 * Canonical product roles for nav planning (map to SA-1 / workspace profiles as noted).
 * Ready to drive nav filtering; SA-1 module grants remain the enforcement source of truth.
 *
 * Key product rule (Evolved + similar tenants):
 * Front Desk / reception takes payments, records deposits, and chases outstanding balances
 * → Finance / Money is **Yes** for front_desk (operational payments), full for manager/admin.
 */

import type { StaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

// ---------------------------------------------------------------------------
// Roles (product matrix vocabulary)
// ---------------------------------------------------------------------------

export const FI_OS_D6G_VISIBILITY_ROLES = [
  "front_desk",
  "consultant",
  "clinical",
  "surgery",
  "manager",
  "admin",
  "auditor",
] as const;

export type FiOsD6gVisibilityRole = (typeof FI_OS_D6G_VISIBILITY_ROLES)[number];

/** Map product matrix role → SA-1 staff role key(s). */
export const FI_OS_D6G_ROLE_TO_STAFF_ROLE: Record<
  FiOsD6gVisibilityRole,
  readonly StaffRoleKey[]
> = {
  front_desk: ["reception"],
  consultant: ["consultant"],
  clinical: ["nurse", "doctor"],
  surgery: ["doctor"], // surgeon / surgical assistant map via normalizeStaffRoleKey → doctor
  manager: ["manager"],
  admin: ["owner", "platform_admin"],
  auditor: ["auditor"],
};

// ---------------------------------------------------------------------------
// Visibility levels
// ---------------------------------------------------------------------------

export type FiOsD6gNavVisibility =
  /** Not shown in More / not intended for this role. */
  | "no"
  /** Shown; operational use allowed (e.g. Front Desk payments). */
  | "yes"
  /** Shown with reduced surface (future: Payments-only vs full Finance). */
  | "limited"
  /** Read-only if shown (auditor path reserved). */
  | "read_only";

// ---------------------------------------------------------------------------
// Primary rail — all staff personas see the same six slots
// (Team / Reports may be disabled when SA-1/feature blocks targets)
// ---------------------------------------------------------------------------

export const FI_OS_D6G_PRIMARY_RAIL_ITEMS = [
  "Today",
  "Calendar",
  "Patients",
  "Team",
  "Reports",
  "More",
] as const;

export type FiOsD6gPrimaryRailItem = (typeof FI_OS_D6G_PRIMARY_RAIL_ITEMS)[number];

/**
 * Primary rail is identical for every role. Permission layers disable slots
 * (e.g. Team/Reports) when the user has no destination — they do not replace slots.
 */
export const FI_OS_D6G_PRIMARY_RAIL_VISIBILITY: Record<
  FiOsD6gVisibilityRole,
  Record<FiOsD6gPrimaryRailItem, "yes">
> = {
  front_desk: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
  consultant: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
  clinical: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
  surgery: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
  manager: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
  admin: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
  auditor: {
    Today: "yes",
    Calendar: "yes",
    Patients: "yes",
    Team: "yes",
    Reports: "yes",
    More: "yes",
  },
};

// ---------------------------------------------------------------------------
// More menu — groups / key destinations
// ---------------------------------------------------------------------------

/**
 * Product-facing More destinations (not every nav id).
 * Maps to D6G workflow groups / hubs used in the drawer.
 */
export const FI_OS_D6G_MORE_MENU_ITEMS = [
  "inbox",
  "pipeline",
  "front_desk",
  "clinical",
  "surgery",
  "team",
  "finance",
  "reports",
  "settings",
  "admin_intelligence",
] as const;

export type FiOsD6gMoreMenuItem = (typeof FI_OS_D6G_MORE_MENU_ITEMS)[number];

export const FI_OS_D6G_MORE_MENU_LABELS: Record<FiOsD6gMoreMenuItem, string> = {
  inbox: "Inbox",
  pipeline: "Pipeline",
  front_desk: "Front Desk",
  clinical: "Clinical",
  surgery: "Surgery",
  team: "Team",
  finance: "Finance / Money",
  reports: "Reports",
  settings: "Settings",
  admin_intelligence: "Admin / Intelligence",
};

/**
 * More-menu visibility by product role.
 *
 * Finance rule (authoritative product decision):
 * - front_desk → yes (take payments, deposits, chase balances)
 * - consultant → no
 * - clinical → no
 * - surgery → no
 * - manager → yes (full)
 * - admin → yes (full)
 * - auditor → no (read_only reserved for later)
 */
export const FI_OS_D6G_MORE_MENU_VISIBILITY: Record<
  FiOsD6gVisibilityRole,
  Record<FiOsD6gMoreMenuItem, FiOsD6gNavVisibility>
> = {
  front_desk: {
    inbox: "yes",
    pipeline: "yes",
    front_desk: "yes",
    clinical: "limited", // operational links only; not clinical charting
    surgery: "no",
    team: "limited", // roster override via SA-1 grant only
    finance: "yes", // payments / deposits / outstanding balances
    reports: "no",
    settings: "limited", // personal (e.g. Clinic guide); not admin config
    admin_intelligence: "no",
  },
  consultant: {
    inbox: "limited", // pipeline-related only if CRM-enabled
    pipeline: "yes",
    front_desk: "limited",
    clinical: "yes",
    surgery: "limited",
    team: "no",
    finance: "no",
    reports: "limited", // conversion-oriented if analytics granted
    settings: "limited",
    admin_intelligence: "no",
  },
  clinical: {
    inbox: "no",
    pipeline: "no",
    front_desk: "limited",
    clinical: "yes",
    surgery: "yes", // procedure-day / case workflow when entitled
    team: "no",
    finance: "no",
    reports: "no",
    settings: "limited",
    admin_intelligence: "no",
  },
  surgery: {
    inbox: "no",
    pipeline: "no",
    front_desk: "limited",
    clinical: "yes",
    surgery: "yes",
    team: "no",
    finance: "no",
    reports: "no",
    settings: "limited",
    admin_intelligence: "no",
  },
  manager: {
    inbox: "yes",
    pipeline: "yes",
    front_desk: "yes",
    clinical: "yes",
    surgery: "yes",
    team: "yes",
    finance: "yes",
    reports: "yes",
    settings: "yes",
    admin_intelligence: "yes",
  },
  admin: {
    inbox: "yes",
    pipeline: "yes",
    front_desk: "yes",
    clinical: "yes",
    surgery: "yes",
    team: "yes",
    finance: "yes",
    reports: "yes",
    settings: "yes",
    admin_intelligence: "yes",
  },
  auditor: {
    inbox: "no",
    pipeline: "no",
    front_desk: "no",
    clinical: "limited", // audit-oriented patient/imaging paths
    surgery: "limited",
    team: "no",
    finance: "no", // future: read_only for deposit/clearance audit
    reports: "yes",
    settings: "no",
    admin_intelligence: "limited",
  },
};

// ---------------------------------------------------------------------------
// Finance detail (payments split recommendation)
// ---------------------------------------------------------------------------

export type FiOsD6gFinanceSurface =
  | "money_hub"
  | "take_payment"
  | "record_deposit"
  | "chase_outstanding"
  | "invoices_ledger"
  | "revenue_margin"
  | "clearance_automation";

/**
 * Recommended finance sub-surface visibility.
 * Today Money is a single hub; this documents the intended Front Desk vs Manager split.
 */
export const FI_OS_D6G_FINANCE_SURFACE_VISIBILITY: Record<
  FiOsD6gVisibilityRole,
  Record<FiOsD6gFinanceSurface, FiOsD6gNavVisibility>
> = {
  front_desk: {
    money_hub: "yes",
    take_payment: "yes",
    record_deposit: "yes",
    chase_outstanding: "yes",
    invoices_ledger: "limited", // status / amounts needed to chase — not full ledger admin
    revenue_margin: "no",
    clearance_automation: "no",
  },
  consultant: {
    money_hub: "no",
    take_payment: "no",
    record_deposit: "no",
    chase_outstanding: "no",
    invoices_ledger: "no",
    revenue_margin: "no",
    clearance_automation: "no",
  },
  clinical: {
    money_hub: "no",
    take_payment: "no",
    record_deposit: "no",
    chase_outstanding: "no",
    invoices_ledger: "no",
    revenue_margin: "no",
    clearance_automation: "no",
  },
  surgery: {
    money_hub: "no",
    take_payment: "no",
    record_deposit: "no",
    chase_outstanding: "no",
    invoices_ledger: "no",
    revenue_margin: "no",
    clearance_automation: "no",
  },
  manager: {
    money_hub: "yes",
    take_payment: "yes",
    record_deposit: "yes",
    chase_outstanding: "yes",
    invoices_ledger: "yes",
    revenue_margin: "yes",
    clearance_automation: "yes",
  },
  admin: {
    money_hub: "yes",
    take_payment: "yes",
    record_deposit: "yes",
    chase_outstanding: "yes",
    invoices_ledger: "yes",
    revenue_margin: "yes",
    clearance_automation: "yes",
  },
  auditor: {
    money_hub: "no",
    take_payment: "no",
    record_deposit: "no",
    chase_outstanding: "no",
    invoices_ledger: "read_only", // reserved — not enabled by default
    revenue_margin: "no",
    clearance_automation: "read_only",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function d6gMoreVisibility(
  role: FiOsD6gVisibilityRole,
  item: FiOsD6gMoreMenuItem
): FiOsD6gNavVisibility {
  return FI_OS_D6G_MORE_MENU_VISIBILITY[role][item];
}

export function d6gCanAccessFinance(role: FiOsD6gVisibilityRole): boolean {
  const v = FI_OS_D6G_MORE_MENU_VISIBILITY[role].finance;
  return v === "yes" || v === "limited" || v === "read_only";
}

/** Markdown-friendly matrix for docs / audits. */
export function formatD6gRoleVisibilityMatrixMarkdown(): string {
  const roles = [...FI_OS_D6G_VISIBILITY_ROLES];
  const rail = [...FI_OS_D6G_PRIMARY_RAIL_ITEMS];
  const more = [...FI_OS_D6G_MORE_MENU_ITEMS];

  const cell = (v: FiOsD6gNavVisibility | "yes") => {
    if (v === "yes") return "✅";
    if (v === "limited") return "◐";
    if (v === "read_only") return "👁";
    return "❌";
  };

  const lines: string[] = [];
  lines.push("# FI OS D6G Role Visibility Matrix");
  lines.push("");
  lines.push("## Primary Rail (same 6 items for all roles)");
  lines.push("");
  lines.push(`| Item | ${roles.join(" | ")} |`);
  lines.push(`| --- | ${roles.map(() => "---").join(" | ")} |`);
  for (const item of rail) {
    const row = roles.map((r) => cell(FI_OS_D6G_PRIMARY_RAIL_VISIBILITY[r][item]));
    lines.push(`| ${item} | ${row.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## More menu");
  lines.push("");
  lines.push(`| Destination | ${roles.join(" | ")} |`);
  lines.push(`| --- | ${roles.map(() => "---").join(" | ")} |`);
  for (const item of more) {
    const label = FI_OS_D6G_MORE_MENU_LABELS[item];
    const row = roles.map((r) => cell(FI_OS_D6G_MORE_MENU_VISIBILITY[r][item]));
    lines.push(`| ${label} | ${row.join(" | ")} |`);
  }
  lines.push("");
  lines.push("### Legend");
  lines.push("");
  lines.push("- ✅ Yes — full intended access for this surface");
  lines.push("- ◐ Limited — operational subset only");
  lines.push("- 👁 Read-only — reserved / not default-enabled");
  lines.push("- ❌ No");
  lines.push("");
  lines.push("### Finance note");
  lines.push("");
  lines.push(
    "**Front Desk** must access **Finance / Money** to take payments, record deposits, and chase outstanding balances (Evolved and similar tenants)."
  );
  lines.push("");
  lines.push(
    "**Future split (recommended):** Front Desk → simplified Payments / Deposits / Outstanding; Manager/Admin → full Money hub (ledger, margin, clearance automation)."
  );
  lines.push("");
  return lines.join("\n");
}
