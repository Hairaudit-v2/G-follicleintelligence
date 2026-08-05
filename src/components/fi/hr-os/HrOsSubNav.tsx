"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type HrOsNavItem = {
  label: string;
  href: string;
  segment: string;
};

/**
 * A2: onboarding, roster, certifications and compliance retired into /team tabs,
 * so those entries link out to the canonical path (and never show as active
 * here). The remaining entries are HR OS surfaces with no /team equivalent.
 */
export function buildHrOsNavItems(tenantId: string): HrOsNavItem[] {
  const base = `/fi-admin/${tenantId}/hr-os`;
  const team = `/fi-admin/${tenantId}/team`;
  return [
    { label: "HR dashboard", href: base, segment: "" },
    { label: "Sync health", href: `${base}/sync-health`, segment: "sync-health" },
    {
      label: "Staff reconciliation",
      href: `${base}/staff-reconciliation`,
      segment: "staff-reconciliation",
    },
    { label: "Duplicate review", href: `${base}/duplicates`, segment: "duplicates" },
    { label: "Offboarding", href: `${base}/offboarding`, segment: "offboarding" },
    { label: "Credentials", href: `${base}/credentials`, segment: "credentials" },
    { label: "Onboarding", href: `${team}/onboarding`, segment: "team-onboarding" },
    { label: "Roster", href: `${team}/roster`, segment: "team-roster" },
    { label: "Training", href: `${team}/training`, segment: "team-training" },
    { label: "Compliance", href: `${team}/compliance`, segment: "team-compliance" },
  ];
}

function isActive(pathname: string, base: string, segment: string): boolean {
  if (!segment) return pathname === base || pathname === `${base}/`;
  // Cross-links into the Team workspace never render this nav, so they are never active.
  if (segment.startsWith("team-")) return false;
  return pathname.startsWith(`${base}/${segment}`);
}

export function HrOsSubNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = `/fi-admin/${tenantId}/hr-os`;
  const items = buildHrOsNavItems(tenantId);

  return (
    <nav
      aria-label="Team navigation"
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
