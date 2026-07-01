"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type HrOsNavItem = {
  label: string;
  href: string;
  segment: string;
};

export function buildHrOsNavItems(tenantId: string): HrOsNavItem[] {
  const base = `/fi-admin/${tenantId}/hr-os`;
  return [
    { label: "Workforce Dashboard", href: base, segment: "" },
    { label: "Sync Health", href: `${base}/sync-health`, segment: "sync-health" },
    {
      label: "Staff Reconciliation",
      href: `${base}/staff-reconciliation`,
      segment: "staff-reconciliation",
    },
    { label: "Duplicate Review", href: `${base}/duplicates`, segment: "duplicates" },
    { label: "Offboarding Centre", href: `${base}/offboarding`, segment: "offboarding" },
    { label: "Credentials", href: `${base}/credentials`, segment: "credentials" },
    { label: "Certifications", href: `${base}/certifications`, segment: "certifications" },
    { label: "Compliance", href: `${base}/compliance`, segment: "compliance" },
  ];
}

function isActive(pathname: string, base: string, segment: string): boolean {
  if (!segment) return pathname === base || pathname === `${base}/`;
  return pathname.startsWith(`${base}/${segment}`);
}

export function HrOsSubNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = `/fi-admin/${tenantId}/hr-os`;
  const items = buildHrOsNavItems(tenantId);

  return (
    <nav
      aria-label="HR OS navigation"
      className="mb-8 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {items.map((item) => {
        const active = isActive(pathname, base, item.segment);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                : "border-white/[0.08] bg-[#0F1629]/60 text-slate-400 hover:border-white/[0.14] hover:text-slate-200"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}