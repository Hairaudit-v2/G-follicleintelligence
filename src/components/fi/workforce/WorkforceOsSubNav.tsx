"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type WorkforceOsNavItem = {
  label: string;
  href: string;
  segment: string;
};

export function buildWorkforceOsNavItems(tenantId: string): WorkforceOsNavItem[] {
  const base = `/fi-admin/${tenantId}/workforce-os`;
  return [
    { label: "Command Centre", href: base, segment: "" },
    { label: "Planning", href: `${base}/planning`, segment: "planning" },
    {
      label: "Procedure Staffing",
      href: `${base}/procedure-staffing`,
      segment: "procedure-staffing",
    },
    { label: "Payroll", href: `${base}/payroll`, segment: "payroll" },
    { label: "Shift Cost", href: `${base}/shift-cost`, segment: "shift-cost" },
    { label: "Recruitment", href: `${base}/recruitment`, segment: "recruitment" },
    {
      label: "HR Reconciliation",
      href: `${base}/hr-reconciliation`,
      segment: "hr-reconciliation",
    },
    { label: "Members", href: `${base}/directory`, segment: "members" },
  ];
}

export function isWorkforceOsNavActive(pathname: string, base: string, segment: string): boolean {
  if (!segment) {
    return pathname === base || pathname === `${base}/`;
  }
  if (segment === "members") {
    return (
      pathname.startsWith(`${base}/directory`) || pathname.startsWith(`${base}/staff/`)
    );
  }
  return pathname === `${base}/${segment}` || pathname.startsWith(`${base}/${segment}/`);
}

export function WorkforceOsSubNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const items = buildWorkforceOsNavItems(tenantId);

  return (
    <nav
      aria-label="WorkforceOS navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {items.map((item) => {
        const active = isWorkforceOsNavActive(pathname, base, item.segment);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
                : "border-white/[0.08] bg-[#0F1629]/60 text-slate-400 hover:border-white/[0.14] hover:text-slate-200"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href={`/fi-admin/${tenantId}/staff`}
        className="ml-auto rounded-full border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:border-white/[0.12] hover:text-[#94A3B8]"
      >
        FI Staff directory
      </Link>
    </nav>
  );
}