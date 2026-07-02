export type FinancialOsModuleGroup = "primary" | "more";

export type FinancialOsModule = {
  id: string;
  label: string;
  /** Route segment after `/fi-admin/[tenantId]/financial/`. */
  segment: string;
  group: FinancialOsModuleGroup;
};

/** Primary FinancialOS areas — surfaced in the in-page module switcher. */
export const FINANCIAL_OS_PRIMARY_MODULES: readonly FinancialOsModule[] = [
  { id: "dashboard", label: "Overview", segment: "dashboard", group: "primary" },
  { id: "payments", label: "Payments", segment: "payments", group: "primary" },
  {
    id: "payment-requests",
    label: "Payment requests",
    segment: "payment-requests",
    group: "primary",
  },
  { id: "installments", label: "Installments", segment: "installments", group: "primary" },
  { id: "providers", label: "Providers", segment: "providers", group: "primary" },
  {
    id: "finance-applications",
    label: "Finance applications",
    segment: "finance-applications",
    group: "primary",
  },
  { id: "super-release", label: "Super release", segment: "super-release", group: "primary" },
  {
    id: "international-transfers",
    label: "International transfers",
    segment: "international-transfers",
    group: "primary",
  },
  { id: "deposit-rules", label: "Deposit rules", segment: "deposit-rules", group: "primary" },
] as const;

/** Additional FinancialOS routes — preserved for direct URLs; listed under “More” in the switcher. */
export const FINANCIAL_OS_MORE_MODULES: readonly FinancialOsModule[] = [
  { id: "invoices", label: "Invoices", segment: "invoices", group: "more" },
  { id: "payment-pathways", label: "Payment pathways", segment: "payment-pathways", group: "more" },
  { id: "pathway-inbox", label: "Pathway inbox", segment: "pathway-inbox", group: "more" },
] as const;

export const FINANCIAL_OS_ALL_MODULES: readonly FinancialOsModule[] = [
  ...FINANCIAL_OS_PRIMARY_MODULES,
  ...FINANCIAL_OS_MORE_MODULES,
];

export function financialOsModuleHref(base: string, segment: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  return `${normalizedBase}/${segment}`;
}

export function resolveFinancialOsActiveModule(
  pathname: string,
  base: string
): FinancialOsModule | null {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "");
  if (!normalizedPath.startsWith(normalizedBase)) return null;

  const rest = normalizedPath.slice(normalizedBase.length).replace(/^\//, "");
  const segment = rest.split("/")[0]?.trim() ?? "";
  if (!segment) {
    return FINANCIAL_OS_PRIMARY_MODULES.find((m) => m.segment === "dashboard") ?? null;
  }

  return FINANCIAL_OS_ALL_MODULES.find((m) => m.segment === segment) ?? null;
}

export function financialOsModuleIsActive(
  pathname: string,
  base: string,
  module: FinancialOsModule
): boolean {
  const active = resolveFinancialOsActiveModule(pathname, base);
  return active?.id === module.id;
}
